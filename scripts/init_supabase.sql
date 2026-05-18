-- =============================================================================
-- UTI RAG Backend — Schema completo
-- =============================================================================
-- Refleja el estado real del proyecto Supabase tras la refactorización.
-- Para un deploy desde cero, ejecutar de arriba a abajo. Idempotente: todos
-- los CREATE usan IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- ----- 1. Extensiones --------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector       WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm      WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent     WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto     WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"  WITH SCHEMA extensions;

-- ----- 2. Text-search config: spanish + unaccent ----------------------------
-- Combina el stemmer español con remoción de tildes. Usado por:
--   * la columna generada `document_chunks.fts_content`
--   * las RPCs `match_chunks_fts` y `match_chunks_hybrid` via websearch_to_tsquery
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'spanish_unaccent') THEN
        CREATE TEXT SEARCH CONFIGURATION public.spanish_unaccent (COPY = pg_catalog.spanish);
        ALTER TEXT SEARCH CONFIGURATION public.spanish_unaccent
            ALTER MAPPING FOR hword, hword_part, word
            WITH unaccent, spanish_stem;
    END IF;
END$$;

-- ----- 3. ENUMs --------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
        CREATE TYPE document_status AS ENUM ('pending', 'processing', 'ready', 'error', 'archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ingestion_status') THEN
        CREATE TYPE ingestion_status AS ENUM (
            'queued','extracting','converting','chunking','embedding','indexing','done','failed'
        );
    END IF;
END$$;

-- ----- 4. Tablas -------------------------------------------------------------

-- 4.1 Documentos institucionales
CREATE TABLE IF NOT EXISTS documents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename          TEXT NOT NULL,
    file_hash         TEXT,                                 -- SHA-256 del PDF (dedup)
    file_size_bytes   BIGINT,
    mime_type         TEXT NOT NULL DEFAULT 'application/pdf',
    storage_path      TEXT,                                 -- path local del PDF para reindex
    category          TEXT,
    tags              TEXT[] NOT NULL DEFAULT '{}',
    language          TEXT NOT NULL DEFAULT 'es',
    status            document_status NOT NULL DEFAULT 'pending',
    version           INTEGER NOT NULL DEFAULT 1,
    page_count        INTEGER,
    chunk_count       INTEGER NOT NULL DEFAULT 0,
    description       TEXT,
    uploaded_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_category    ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_tags        ON documents USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_created_at  ON documents(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_file_hash
    ON documents(file_hash) WHERE file_hash IS NOT NULL;

-- 4.2 Jobs de ingesta (trazabilidad del pipeline)
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id           UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    celery_task_id   TEXT,
    status           ingestion_status NOT NULL DEFAULT 'queued',
    started_at       TIMESTAMPTZ,
    finished_at      TIMESTAMPTZ,
    error_message    TEXT,
    steps_log        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{step, message, ts, duration_ms, extra}]
    chunk_count      INTEGER,
    embedding_model  TEXT,
    embedding_dim    INTEGER,
    triggered_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_doc_id         ON ingestion_jobs(doc_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status         ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_celery_task_id ON ingestion_jobs(celery_task_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created_at     ON ingestion_jobs(created_at DESC);

-- 4.3 Chunks vectorizados
CREATE TABLE IF NOT EXISTS document_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id          UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    job_id          UUID REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    content_hash    TEXT,                                 -- SHA-256 del content (dedup intra-doc)
    embedding       vector(1024),                         -- BAAI/bge-m3
    token_count     INTEGER,
    char_count      INTEGER GENERATED ALWAYS AS (char_length(content)) STORED,
    page_number     INTEGER,
    heading_path    TEXT,                                 -- "Cap. III > Art. 47"
    section_level   TEXT,                                 -- "h1" | "h2" | ...
    fts_content     tsvector GENERATED ALWAYS AS
                    (to_tsvector('spanish_unaccent'::regconfig, content)) STORED,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Idempotencia: re-ingestar el mismo documento no duplica chunks
    CONSTRAINT document_chunks_doc_content_hash_uniq UNIQUE (doc_id, content_hash),
    CONSTRAINT document_chunks_doc_chunk_index_uniq  UNIQUE (doc_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc_id      ON document_chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_chunks_job_id      ON document_chunks(job_id);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata    ON document_chunks USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_chunks_page_number ON document_chunks(page_number)
    WHERE page_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_fts         ON document_chunks USING gin(fts_content);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
    ON document_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 100);

-- 4.4 Sesiones y mensajes de chat (observabilidad)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_token   TEXT UNIQUE,
    title           TEXT,
    model_name      TEXT NOT NULL DEFAULT 'qwen2.5:14b',
    message_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id     ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_token       ON chat_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_active ON chat_sessions(last_active_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role                TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content             TEXT NOT NULL,
    retrieved_chunk_ids UUID[] NOT NULL DEFAULT '{}',
    latency_ms          INTEGER,
    input_tokens        INTEGER,
    output_tokens       INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS retrieval_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id        UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    chunk_id          UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    retrieval_method  TEXT NOT NULL CHECK (retrieval_method IN ('vector','fts','hybrid')),
    score             DOUBLE PRECISION,
    rank              INTEGER NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_message_id ON retrieval_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_chunk_id   ON retrieval_logs(chunk_id);

-- ----- 5. Triggers -----------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION update_session_stats() RETURNS trigger AS $$
BEGIN
    UPDATE chat_sessions
       SET message_count  = message_count + 1,
           last_active_at = NOW()
     WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_update_session ON chat_messages;
CREATE TRIGGER trg_chat_update_session
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_session_stats();

-- ----- 6. Helper: is_admin() (lee user_metadata.role del JWT) ---------------
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
        false
    );
$$;

-- ----- 7. RPCs de retrieval --------------------------------------------------

-- 7.1 Vector search (HNSW + cosine)
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding vector,
    match_count     INT     DEFAULT 5,
    min_similarity  FLOAT   DEFAULT 0.4,
    filter_doc_ids  UUID[]  DEFAULT NULL
) RETURNS TABLE (
    id UUID, doc_id UUID, content TEXT, metadata JSONB, similarity FLOAT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;
    RETURN QUERY
    SELECT dc.id, dc.doc_id, dc.content, dc.metadata,
           (1 - (dc.embedding <=> query_embedding))::FLOAT AS similarity
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.doc_id
     WHERE d.status = 'ready'
       AND (filter_doc_ids IS NULL OR dc.doc_id = ANY(filter_doc_ids))
       AND 1 - (dc.embedding <=> query_embedding) > min_similarity
     ORDER BY dc.embedding <=> query_embedding
     LIMIT match_count;
END;
$$;

-- 7.2 Full-text search (tsvector + spanish_unaccent)
CREATE OR REPLACE FUNCTION match_chunks_fts(
    query_text     TEXT,
    match_count    INT    DEFAULT 10,
    filter_doc_ids UUID[] DEFAULT NULL
) RETURNS TABLE (
    id UUID, doc_id UUID, content TEXT, metadata JSONB, score FLOAT
) LANGUAGE sql STABLE AS $$
    SELECT dc.id, dc.doc_id, dc.content, dc.metadata,
           ts_rank_cd(dc.fts_content,
                      websearch_to_tsquery('spanish_unaccent', query_text), 32)::FLOAT AS score
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.doc_id
     WHERE d.status = 'ready'
       AND (filter_doc_ids IS NULL OR dc.doc_id = ANY(filter_doc_ids))
       AND dc.fts_content @@ websearch_to_tsquery('spanish_unaccent', query_text)
     ORDER BY score DESC
     LIMIT match_count;
$$;

-- 7.3 Híbrido con Reciprocal Rank Fusion nativo
CREATE OR REPLACE FUNCTION match_chunks_hybrid(
    query_embedding vector,
    query_text      TEXT,
    match_count     INT    DEFAULT 10,
    rrf_k           INT    DEFAULT 60,
    filter_doc_ids  UUID[] DEFAULT NULL
) RETURNS TABLE (
    id UUID, doc_id UUID, content TEXT, metadata JSONB, score FLOAT
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_query_embedding vector := query_embedding;
    v_query_text TEXT := query_text;
    v_match_count INT := match_count;
    v_rrf_k INT := rrf_k;
    v_filter_doc_ids UUID[] := filter_doc_ids;
BEGIN
    SET LOCAL hnsw.ef_search = 100;
    RETURN QUERY
    WITH vector_ranked AS (
        SELECT dc.id as v_id, dc.doc_id as v_doc_id, dc.content as v_content, dc.metadata as v_metadata,
               ROW_NUMBER() OVER (ORDER BY dc.embedding <=> v_query_embedding) AS v_rank
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.doc_id
         WHERE d.status = 'ready'
           AND (v_filter_doc_ids IS NULL OR dc.doc_id = ANY(v_filter_doc_ids))
           AND dc.embedding IS NOT NULL
         LIMIT v_match_count * 3
    ),
    fts_ranked AS (
        SELECT dc.id as f_id, dc.doc_id as f_doc_id, dc.content as f_content, dc.metadata as f_metadata,
               ROW_NUMBER() OVER (
                   ORDER BY ts_rank_cd(dc.fts_content,
                                       websearch_to_tsquery('spanish_unaccent', v_query_text), 32) DESC
               ) AS f_rank
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.doc_id
         WHERE d.status = 'ready'
           AND (v_filter_doc_ids IS NULL OR dc.doc_id = ANY(v_filter_doc_ids))
           AND dc.fts_content @@ websearch_to_tsquery('spanish_unaccent', v_query_text)
         LIMIT v_match_count * 3
    ),
    fused AS (
        SELECT COALESCE(v.v_id, f.f_id)             AS id,
               COALESCE(v.v_doc_id,   f.f_doc_id)   AS doc_id,
               COALESCE(v.v_content,  f.f_content)  AS content,
               COALESCE(v.v_metadata, f.f_metadata) AS metadata,
               COALESCE(1.0 / (v_rrf_k + v.v_rank), 0.0)::FLOAT +
               COALESCE(1.0 / (v_rrf_k + f.f_rank), 0.0)::FLOAT AS score
          FROM vector_ranked v
          FULL OUTER JOIN fts_ranked f ON v.v_id = f.f_id
    )
    SELECT id, doc_id, content, metadata, score
      FROM fused
     ORDER BY score DESC
     LIMIT v_match_count;
END;
$$;

-- ----- 8. RLS ----------------------------------------------------------------
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_logs   ENABLE ROW LEVEL SECURITY;

-- Documentos: lectura pública, escritura solo admin
DROP POLICY IF EXISTS documents_public_read   ON documents;
DROP POLICY IF EXISTS documents_admin_insert  ON documents;
DROP POLICY IF EXISTS documents_admin_update  ON documents;
DROP POLICY IF EXISTS documents_admin_delete  ON documents;
CREATE POLICY documents_public_read  ON documents FOR SELECT USING (true);
CREATE POLICY documents_admin_insert ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY documents_admin_update ON documents FOR UPDATE USING (is_admin());
CREATE POLICY documents_admin_delete ON documents FOR DELETE USING (is_admin());

-- Chunks: lectura pública, escritura solo admin
DROP POLICY IF EXISTS chunks_public_read   ON document_chunks;
DROP POLICY IF EXISTS chunks_admin_insert  ON document_chunks;
DROP POLICY IF EXISTS chunks_admin_delete  ON document_chunks;
CREATE POLICY chunks_public_read  ON document_chunks FOR SELECT USING (true);
CREATE POLICY chunks_admin_insert ON document_chunks FOR INSERT WITH CHECK (true);
CREATE POLICY chunks_admin_delete ON document_chunks FOR DELETE USING (is_admin());

-- Jobs y logs: solo admin
DROP POLICY IF EXISTS ingestion_jobs_admin_all ON ingestion_jobs;
DROP POLICY IF EXISTS retrieval_logs_admin_all ON retrieval_logs;
CREATE POLICY ingestion_jobs_admin_all ON ingestion_jobs FOR ALL USING (is_admin());
CREATE POLICY retrieval_logs_admin_all ON retrieval_logs FOR ALL USING (is_admin());

-- Sesiones y mensajes: cada usuario ve los suyos (o anónimos)
DROP POLICY IF EXISTS sessions_own_select  ON chat_sessions;
DROP POLICY IF EXISTS sessions_own_insert  ON chat_sessions;
DROP POLICY IF EXISTS sessions_own_update  ON chat_sessions;
DROP POLICY IF EXISTS sessions_own_delete  ON chat_sessions;
CREATE POLICY sessions_own_select ON chat_sessions FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY sessions_own_insert ON chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY sessions_own_update ON chat_sessions FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY sessions_own_delete ON chat_sessions FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS messages_own_select ON chat_messages;
DROP POLICY IF EXISTS messages_own_insert ON chat_messages;
CREATE POLICY messages_own_select ON chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_sessions s
             WHERE s.id = chat_messages.session_id
               AND (s.user_id = auth.uid() OR s.user_id IS NULL))
);
CREATE POLICY messages_own_insert ON chat_messages FOR INSERT WITH CHECK (true);
