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

`PDF → PDFExtractor (PyMuPDF) → MarkdownConverter (Docling) → DocumentChunker → EmbeddingService → SupabaseIndexer`

El progreso se publica en Redis pub/sub (`task_progress:{task_id}`) y se consume vía WebSocket en `/api/v1/ws/ingestion/{task_id}`.

## Flujo de consulta (RAG)

`query → embed → VectorRetriever (pgvector RPC) + BM25Retriever → HybridRetriever (RRF k=60) → LLMService (Qwen2.5:14b)`

## Seguridad

- Los endpoints `/api/v1/admin/*` requieren JWT de Supabase con `user_metadata.role == "admin"`.
- La verificación se hace en `fastapi/core/security.py:verify_admin_token`.
- Los endpoints de chat son públicos pero tienen rate limiting en Nginx (60r/min).

## Base de datos (Supabase)

Tablas relevantes:
- `documents` — registro de PDFs subidos
- `document_chunks` — chunks con embedding `vector(384)` e índice HNSW

Función RPC usada en `services/retrieval/vector.py`:
```sql
SELECT * FROM match_chunks(query_embedding, match_count, min_similarity)
```

## Notas importantes

- El `.env` contiene credenciales reales — nunca commitear, está en `.gitignore`.
- `REDIS_URL` debe incluir la contraseña: `redis://:PASSWORD@redis:6379/0`.
- El `celery_worker` comparte el código de `fastapi/` montado como volumen (`./fastapi:/app`).
- Los PDFs se guardan temporalmente en el volumen `uploads_data` durante la ingesta.
- Nginx no está activo hasta configurar SSL con `scripts/generate_ssl.sh`.
