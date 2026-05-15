# Stack Tecnológico

## Resumen del stack

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| API | FastAPI | 0.111 | Framework web asíncrono |
| Servidor ASGI | Uvicorn | 0.30 | Servidor de producción para FastAPI |
| Tareas | Celery | 5.4 | Worker de tareas asíncronas |
| Message broker | Redis | 7 | Cola Celery + pub/sub progreso |
| LLM | Qwen2.5:14b | latest | Modelo generativo local |
| Servidor LLM | Ollama | latest | Runtime para modelos GGUF |
| Embeddings | BAAI/bge-m3 | 3.0 | Modelo de embeddings multilingüe |
| BD vectorial | pgvector (Supabase) | 0.7 | Almacenamiento y búsqueda de vectores |
| BD relacional | PostgreSQL (Supabase) | 15 | Metadatos de documentos |
| Procesamiento PDF | PyMuPDF | 1.24 | Extracción de texto PDF |
| Estructura docs | Docling | 1.16 | Análisis estructural de documentos |
| Chunking | LangChain | 0.2.6 | MarkdownHeaderTextSplitter |
| BM25 | rank-bm25 | 0.2.2 | Búsqueda léxica |
| Reverse proxy | Nginx | 1.25 | TLS, rate limiting, proxy |
| Contenedores | Docker + Compose | 26 / 2.27 | Orquestación de servicios |
| Autenticación | Supabase Auth (JWT) | — | Gestión de usuarios admin |
| Validación | Pydantic v2 | 2.7 | Validación de datos en runtime |
| Logging | Loguru | 0.7 | Logging estructurado |
| Hardware GPU | Tesla V100 16 GB | — | Aceleración CUDA para embeddings y LLM |

---

## Lenguaje principal: Python 3.11

Se eligió Python 3.11 por:
- Ecosistema más maduro para ML/IA (PyTorch, sentence-transformers, LangChain).
- Mejoras de rendimiento del 25% respecto a Python 3.10 (PEP 659, faster-CPython).
- Soporte nativo `asyncio` para operaciones I/O-bound (FastAPI, supabase-py, ollama client).

---

## FastAPI

FastAPI es un framework web moderno para Python basado en:
- **Starlette** (ASGI): soporte WebSocket nativo, middleware asíncrono.
- **Pydantic v2**: validación automática de request/response con type hints.
- **OpenAPI / Swagger UI**: generación automática de documentación interactiva (disponible en `/docs` en entorno development).

Ventajas sobre Flask/Django para este proyecto:
- Async nativo (crítico para esperar respuestas de Ollama sin bloquear otras peticiones).
- Inyección de dependencias integrada (`Depends()`).
- Validación automática de tipos reduce código boilerplate.

---

## Celery + Redis

**Celery** desacopla el procesamiento de PDFs de la API HTTP:
- La ingesta de un documento puede tomar 20-60 segundos.
- Sin Celery, el POST de upload bloquearía hasta completar la ingesta.
- Con Celery, el upload retorna inmediatamente con `{task_id}` y el procesamiento ocurre en paralelo.

**Redis** cumple dos roles:
1. **Message broker:** Celery publica tareas en Redis; el worker las consume.
2. **Pub/sub:** El worker publica progreso en `task_progress:{task_id}`; el WebSocket lo retransmite.

---

## Supabase + pgvector

**Supabase** es una plataforma BaaS (Backend as a Service) que proporciona:
- PostgreSQL gestionado (sin administrar servidor de BD).
- Extensión **pgvector** para almacenar y buscar vectores de alta dimensión.
- SDK Python (`supabase-py`) con cliente REST y RPC.
- Autenticación JWT integrada (Supabase Auth) para el panel admin.

**pgvector** extiende PostgreSQL con:
- Tipo de datos `vector(n)` para almacenar embeddings.
- Operadores de distancia: `<=>` coseno, `<->` L2, `<#>` producto punto.
- Índices **HNSW** y IVFFlat para búsqueda aproximada (ANN).

El índice **HNSW** (Hierarchical Navigable Small World):
- Construye un grafo jerárquico de nodos.
- Búsqueda en O(log n) vs O(n) de búsqueda lineal.
- Parámetros del proyecto: `m=16, ef_construction=64` (balance velocidad/calidad).

---

## BAAI/bge-m3

BGE-M3 (BGE = BAAI General Embedding, M3 = Multi-Functionality, Multi-Lingual, Multi-Granularity) es un modelo de la Academia China de Ciencias (BAAI):

- **Multilingüe:** 100+ idiomas, incluyendo español de alta calidad.
- **Dimensión 1024:** representación rica para capturar matices semánticos.
- **Multi-granularidad:** funciona bien en frases cortas (queries) y párrafos largos (chunks).
- **Gratuito y local:** sin costo por llamada, opera en el servidor propio.

Benchmark de referencia (MTEB Retrieval):
- bge-m3 supera a `text-embedding-ada-002` de OpenAI en benchmarks multilingües.

---

## Ollama + Qwen2.5:14b

**Ollama** es un servidor de inferencia local que:
- Descarga y gestiona modelos LLM en formato GGUF.
- Expone una API HTTP compatible con múltiples clientes.
- Gestiona automáticamente la memoria GPU.

**Qwen2.5:14b** (Alibaba Cloud, 2024):
- 14.7 mil millones de parámetros.
- Cuantización Q4_K_M: reduce VRAM requerida de ~28 GB (FP16) a ~9 GB.
- Entrenado con 18 billones de tokens, incluyendo datos en español.
- Instrucción-following: sigue el system prompt con alta fidelidad.
- Context window: 128K tokens.

---

## Docker Compose

La orquestación con Docker Compose garantiza:
- **Reproducibilidad:** el mismo `docker-compose.yml` levanta el sistema idéntico en cualquier máquina con Docker y GPU NVIDIA.
- **Aislamiento:** cada servicio corre en su contenedor con sus dependencias.
- **Red interna:** los contenedores se comunican por nombre de servicio (`ollama:11434`, `redis:6379`) sin exponer puertos al exterior.
- **Persistencia:** volúmenes Docker para Redis (datos), Ollama (modelo ~9 GB), uploads (PDFs temporales).
- **GPU pass-through:** `deploy.resources.reservations.devices` habilita acceso a la Tesla V100 desde los contenedores FastAPI, Celery y Ollama.

---

## Nginx

Nginx actúa como la primera línea de defensa:
- **TLS termination:** descifra HTTPS antes de pasar a FastAPI (HTTP interno).
- **Certificados SSL:** Let's Encrypt vía Certbot (renovación automática).
- **Rate limiting:** zona `chat` (60 req/min, burst=20) y zona `api` (30 req/min, burst=10).
- **WebSocket proxy:** `Upgrade` y `Connection: upgrade` para el WebSocket de progreso.
- **Cabeceras de seguridad:** HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection.
