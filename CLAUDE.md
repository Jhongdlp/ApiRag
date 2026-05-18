# CLAUDE.md — UTI RAG Backend

## Contexto del proyecto

Tesis de grado: chatbot académico RAG para la Universidad Tecnológica Indoamérica (UTI, Ecuador). Responde consultas estudiantiles a partir de documentos institucionales (reglamentos, manuales, normativas) en español.

## Comandos esenciales

```bash
# Levantar servicios (desde uti-rag-backend/)
sg docker -c "docker compose up -d"

# Ver logs
sg docker -c "docker compose logs -f fastapi"
sg docker -c "docker compose logs -f celery_worker"

# Estado de contenedores
sg docker -c "docker compose ps"

# Validar docker-compose sin levantar
sg docker -c "docker compose config --quiet"

# Reconstruir una imagen tras cambios en código
sg docker -c "docker compose up -d --build fastapi"

# Reiniciar servicio tras cambiar .env
sg docker -c "docker compose up -d fastapi celery_worker"

# Probar modelo LLM directamente
sg docker -c "docker exec uti_ollama ollama run qwen2.5:14b 'pregunta de prueba'"

# Ver modelo disponible
sg docker -c "docker exec uti_ollama ollama list"
```

> **Nota:** Los comandos docker requieren `sg docker -c "..."` porque el grupo docker fue añadido en esta sesión. En una nueva sesión de shell esto ya no será necesario.

## Arquitectura de servicios

| Servicio | Contenedor | Puerto interno |
|---|---|---|
| FastAPI | `uti_fastapi` | 8000 |
| Celery worker | `uti_celery` | — |
| Redis | `uti_redis` | 6379 |
| Ollama (LLM) | `uti_ollama` | 11434 |
| Nginx | `uti_nginx` | 80, 443 |

## Modelo LLM

- **Modelo:** `qwen2.5:14b` (~9 GB, Q4_K_M)
- **GPU:** Tesla V100 16 GB — el modelo usa ~9 GB VRAM
- **Ubicación:** volumen Docker `uti-rag-backend_ollama_data` (persiste entre reinicios)
- **Cambiar modelo:** editar `OLLAMA_MODEL` en `.env`, luego `docker compose up -d`

## Flujo de ingesta (Celery)

`PDF → PDFProcessor (Docling unificado) → DocumentChunker (HybridChunker tokenizer-aware) → EmbeddingService (bge-m3) → SupabaseIndexer (upsert idempotente)`

- Cada paso registra duración y mensaje en `ingestion_jobs.steps_log` (JSONB).
- El progreso se publica en Redis pub/sub (`task_progress:{task_id}`) y se consume vía WebSocket en `/api/v1/ws/ingestion/{task_id}`.
- Dedup en dos niveles: `documents.file_hash` (UNIQUE) evita re-procesar el mismo PDF; `document_chunks (doc_id, content_hash)` (UNIQUE) hace el upsert idempotente.
- El estado del documento siempre converge a `ready` o `error` (nunca queda en `processing` colgado).

## Flujo de consulta (RAG)

`query → embed (bge-m3) → match_chunks_hybrid RPC (RRF nativo en Postgres) → LLMService (qwen2.5:14b)`

- Búsqueda densa + FTS español (`spanish_unaccent`) + fusión RRF ocurren en UNA sola RPC.
- Filtros opcionales por `doc_ids`. Solo se devuelven chunks de docs con `status='ready'`.
- Cada interacción se persiste en `chat_messages` + `retrieval_logs` para evaluación posterior.

## Seguridad

- Los endpoints `/api/v1/admin/*` requieren JWT de Supabase con `user_metadata.role == "admin"`.
- La verificación se hace en `fastapi/core/security.py:verify_admin_token`.
- Los endpoints de chat son públicos pero tienen rate limiting en Nginx (60r/min).
- RLS activado en todas las tablas; `is_admin()` (PL/pgSQL) controla writes.

## Base de datos (Supabase)

Tablas principales:
- `documents` — PDFs con `file_hash` UNIQUE, `category`, `tags[]`, `status` enum, `chunk_count`, `page_count`
- `ingestion_jobs` — un registro por intento de ingesta con `steps_log` JSONB
- `document_chunks` — chunks con `embedding vector(1024)`, `page_number`, `heading_path`, `content_hash` UNIQUE, `fts_content` tsvector generada
- `chat_sessions`, `chat_messages`, `retrieval_logs` — observabilidad del chat

RPCs (definidas en `scripts/init_supabase.sql`):
- `match_chunks(query_embedding, match_count, min_similarity, filter_doc_ids)` — vector
- `match_chunks_fts(query_text, match_count, filter_doc_ids)` — full-text en español
- `match_chunks_hybrid(query_embedding, query_text, match_count, rrf_k, filter_doc_ids)` — fusión RRF

## Embeddings y GPU

- Modelo: `BAAI/bge-m3` (1024 dims, multilingüe, excelente para español).
- `EMBEDDING_DEVICE=auto` usa CUDA si está disponible y cae a CPU si no.
- La imagen base actual (`python:3.11-slim`) instala torch CPU. Para activar GPU en embeddings: cambiar base a `nvidia/cuda:12.1.0-runtime-ubuntu22.04` y reinstalar torch con `--index-url https://download.pytorch.org/whl/cu121` (ver comentario en `fastapi/Dockerfile`).
- Ollama SÍ usa la V100 (qwen2.5:14b ocupa ~9 GB VRAM).

## Notas importantes

- El `.env` contiene credenciales reales — nunca commitear, está en `.gitignore`.
- `REDIS_URL` debe incluir la contraseña: `redis://:PASSWORD@redis:6379/0`.
- El `celery_worker` comparte el código de `fastapi/` montado como volumen (`./fastapi:/app`).
- Los PDFs se guardan temporalmente en el volumen `uploads_data` durante la ingesta y se borran al finalizar (éxito o fallo).
- Nginx no está activo hasta configurar SSL con `scripts/generate_ssl.sh`.
- Tras cambiar `requirements.txt` o `Dockerfile`: `docker compose up -d --build fastapi celery_worker`.
