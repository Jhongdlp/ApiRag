-- Activar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de documentos
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'processing',
    chunk_count INTEGER DEFAULT 0
);

-- Tabla de chunks vectorizados
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1024),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice HNSW para búsqueda por similitud coseno (más rápido que IVFFlat en <1M filas)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índice para filtrar por documento
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id
ON document_chunks(doc_id);

-- Función RPC para búsqueda vectorial desde FastAPI
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding vector(1024),
    match_count INT DEFAULT 5,
    min_similarity FLOAT DEFAULT 0.4
)
RETURNS TABLE (
    id UUID,
    doc_id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        id,
        doc_id,
        content,
        metadata,
        1 - (embedding <=> query_embedding) AS similarity
    FROM document_chunks
    WHERE 1 - (embedding <=> query_embedding) > min_similarity
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;
