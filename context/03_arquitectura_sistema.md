# Arquitectura del Sistema

## Patrón arquitectónico

El sistema sigue la arquitectura **RAG (Retrieval-Augmented Generation)** combinada con una arquitectura de **microservicios** dockerizados y comunicación a través de una red interna Docker.

RAG es un patrón de diseño para sistemas de IA que desacopla el conocimiento del modelo generativo: en lugar de ajustar (fine-tune) el LLM con datos institucionales (costoso y que produce alucinaciones), se recupera el contexto relevante en tiempo real y se lo inyecta en el prompt. Esto garantiza que las respuestas se basen exclusivamente en documentos verificados.

---

## Diagrama de componentes

```
┌──────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTPS (443) / HTTP (80)
                    ┌────────▼────────┐
                    │   Nginx         │  ← Reverse proxy, TLS, rate limit
                    │  (uti_nginx)    │
                    └────────┬────────┘
                             │ HTTP interno
              ┌──────────────▼──────────────┐
              │         FastAPI              │  ← API REST + WebSocket
              │        (uti_fastapi)         │
              └──┬─────────────┬────────────┘
                 │             │
        ┌────────▼───┐  ┌──────▼──────────┐
        │  Supabase  │  │     Redis        │
        │ (pgvector) │  │  (uti_redis)     │
        │ documentos │  │  broker + pubsub │
        │  + chunks  │  └──────┬──────────┘
        └────────────┘         │
                        ┌──────▼──────────┐
                        │  Celery Worker  │  ← Tareas de ingesta
                        │  (uti_celery)   │
                        └──────┬──────────┘
                               │ HTTP
                        ┌──────▼──────────┐
                        │     Ollama       │  ← Inferencia LLM local
                        │  (uti_ollama)    │  GPU: Tesla V100
                        │  Qwen2.5:14b     │
                        └─────────────────┘
```

---

## Descripción de cada servicio

### 1. Nginx (`uti_nginx`)
- **Rol:** Reverse proxy y terminador TLS.
- **Funciones:** Redirección HTTP→HTTPS, rate limiting diferenciado por endpoint (30 req/min admin, 60 req/min chat), cabeceras de seguridad HTTP (HSTS, X-Frame-Options, X-Content-Type-Options), soporte WebSocket con `Upgrade`.
- **Puerto expuesto:** 80, 443.
- **Tecnología:** Nginx 1.25-alpine.

### 2. FastAPI (`uti_fastapi`)
- **Rol:** Núcleo de la aplicación; expone la API REST y los WebSockets.
- **Funciones:** Recibe consultas de chat, orquesta la recuperación híbrida y la generación, gestiona la subida de documentos, autentica administradores vía JWT de Supabase.
- **Puerto interno:** 8000 (no expuesto directamente, solo vía Nginx).
- **Tecnología:** FastAPI 0.111 + Uvicorn, Python 3.11.

### 3. Celery Worker (`uti_celery`)
- **Rol:** Procesamiento asíncrono de documentos (ingesta).
- **Funciones:** Ejecuta el pipeline PDF→Markdown→chunks→embeddings→Supabase en background, publica progreso en Redis pub/sub.
- **Tecnología:** Celery 5.4, Python 3.11, acceso a GPU para embeddings.

### 4. Redis (`uti_redis`)
- **Rol:** Message broker para Celery y canal pub/sub para WebSocket.
- **Funciones:** Cola de tareas Celery, almacenamiento de resultados de tareas, canal `task_progress:{task_id}` para transmitir progreso de ingesta en tiempo real.
- **Tecnología:** Redis 7-alpine con persistencia AOF.

### 5. Ollama (`uti_ollama`)
- **Rol:** Servidor de inferencia LLM local.
- **Funciones:** Sirve el modelo Qwen2.5:14b con aceleración GPU, expone API HTTP compatible con el cliente `ollama` de Python.
- **Puerto interno:** 11434.
- **Tecnología:** Ollama, modelo qwen2.5:14b (Q4_K_M, ~9 GB VRAM).

### 6. Supabase (externo gestionado)
- **Rol:** Base de datos PostgreSQL con extensión pgvector.
- **Funciones:** Almacena metadatos de documentos (`documents`), chunks con embeddings vectoriales (`document_chunks`, `vector(1024)`), índice HNSW para búsqueda por similitud coseno.
- **Acceso desde FastAPI:** SDK `supabase-py` + función RPC `match_chunks`.

---

## Flujos de datos principales

### Flujo A — Ingesta de documento (Admin)

```
Admin sube PDF
    → POST /api/v1/admin/documents/upload  [JWT admin]
    → FastAPI guarda PDF en volumen uploads_data
    → FastAPI encola tarea en Redis (Celery)
    → FastAPI retorna {doc_id, task_id}
    → Celery Worker ejecuta pipeline:
        1. PDFExtractor (PyMuPDF)    → texto plano
        2. MarkdownConverter (Docling) → Markdown estructurado
        3. DocumentChunker (LangChain MarkdownHeaderTextSplitter) → List[Chunk]
        4. EmbeddingService (bge-m3) → List[Chunk con embeddings float[1024]]
        5. SupabaseIndexer           → INSERT en document_chunks (pgvector)
    → Cada paso publica progreso en Redis pub/sub
    → WebSocket /api/v1/ws/ingestion/{task_id} retransmite al navegador admin
```

### Flujo B — Consulta del estudiante (Chat)

```
Estudiante envía pregunta
    → POST /api/v1/chat  [público]
    → FastAPI recibe ChatRequest{query}
    → HybridRetriever:
        ├── VectorRetriever: embed(query) → RPC match_chunks (pgvector, top-10, min_similarity=0.4)
        └── BM25Retriever: carga corpus → BM25Okapi → scores léxicos (top-10)
        → RRF (k=60): fusiona rankings → top-5 chunks
    → LLMService: build_prompt(query, chunks) → Ollama generate(qwen2.5:14b, temp=0.1)
    → FastAPI retorna ChatResponse{answer, sources[]}
```

---

## Decisiones de diseño clave

| Decisión | Alternativa descartada | Justificación |
|---|---|---|
| Recuperación híbrida RRF | Solo vectorial | BM25 captura coincidencias exactas de términos técnicos/siglas que el embedding puede perder |
| Celery para ingesta | Ingesta síncrona en FastAPI | Los PDFs institucionales pueden tardar 2-5 min; bloquear la API sería inaceptable |
| Chunking por cabeceras Markdown | Chunking por ventana fija | Respeta la estructura lógica del documento (artículos, secciones) |
| Ollama local | OpenAI API | Datos institucionales sensibles; sin costo por token; sin dependencia de red |
| BAAI/bge-m3 (1024 dims) | text-embedding-3-small | Mejor rendimiento en español; opera localmente |
| pgvector (HNSW) | Pinecone / Weaviate | Integrado en Supabase (SQL familiar); índice HNSW es óptimo para < 1M vectores |
