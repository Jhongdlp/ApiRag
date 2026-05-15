# Arquitectura de Carpetas

## Estructura completa del repositorio

```
uti-rag-backend/
│
├── docker-compose.yml          # Orquestación de todos los servicios
├── .env                        # Variables de entorno (NO se commitea)
├── .env.example                # Plantilla de variables (sí se commitea)
├── CLAUDE.md                   # Instrucciones para el asistente de IA
├── README.md                   # Documentación principal del repositorio
│
├── context/                    # ← ESTA CARPETA: documentación de tesis
│   ├── 01_vision_general.md
│   ├── 02_metodologia.md
│   ├── 03_arquitectura_sistema.md
│   ├── 04_arquitectura_carpetas.md
│   ├── 05_pipeline_ingesta.md
│   ├── 06_pipeline_rag.md
│   ├── 07_stack_tecnologico.md
│   └── 08_seguridad.md
│
├── fastapi/                    # Servicio principal — API + lógica RAG
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # Punto de entrada de FastAPI (app, CORS, lifespan)
│   │
│   ├── api/                    # Capa de presentación (endpoints HTTP)
│   │   └── v1/
│   │       ├── router.py       # Registro de todos los subrouters
│   │       ├── chat.py         # POST /chat — endpoint público del chatbot
│   │       ├── documents.py    # POST/DELETE/GET /admin/documents — panel admin
│   │       └── websocket.py    # WS /ws/ingestion/{task_id} — progreso en tiempo real
│   │
│   ├── core/                   # Configuración e infraestructura transversal
│   │   ├── config.py           # Settings con pydantic-settings (lee .env)
│   │   ├── dependencies.py     # Dependencias inyectables (cliente Supabase)
│   │   └── security.py         # verify_admin_token — decodifica JWT de Supabase
│   │
│   ├── models/                 # Modelos Pydantic (contratos de datos)
│   │   ├── chat.py             # ChatRequest, ChatResponse
│   │   ├── chunk.py            # Chunk (contenido, embedding, metadata, score)
│   │   └── document.py         # DocumentOut (respuesta de listado)
│   │
│   ├── services/               # Lógica de negocio — núcleo del sistema RAG
│   │   ├── ingestion/          # Pipeline de procesamiento de documentos
│   │   │   ├── extractor.py    # PDFExtractor — PyMuPDF → texto plano
│   │   │   ├── converter.py    # MarkdownConverter — Docling → Markdown estructurado
│   │   │   ├── chunker.py      # DocumentChunker — LangChain MarkdownHeaderTextSplitter
│   │   │   ├── embedder.py     # EmbeddingService — sentence-transformers BAAI/bge-m3
│   │   │   └── indexer.py      # SupabaseIndexer — INSERT en pgvector (lotes de 100)
│   │   │
│   │   ├── retrieval/          # Pipeline de recuperación (RAG — lado retrieval)
│   │   │   ├── vector.py       # VectorRetriever — similitud coseno vía RPC pgvector
│   │   │   ├── bm25.py         # BM25Retriever — búsqueda léxica rank-bm25
│   │   │   └── hybrid.py       # HybridRetriever — fusión RRF (k=60)
│   │   │
│   │   ├── generation/         # Pipeline de generación (RAG — lado generation)
│   │   │   ├── llm.py          # LLMService — cliente Ollama async (Qwen2.5:14b)
│   │   │   └── prompt.py       # build_prompt — template con system prompt + contexto
│   │   │
│   │   └── document/           # Gestión de documentos en Supabase
│   │       └── manager.py      # DocumentManager — list_all, delete, update_status
│   │
│   ├── tasks/                  # Tareas Celery (procesamiento asíncrono)
│   │   └── ingestion_tasks.py  # process_document_task — orquesta pipeline de ingesta
│   │
│   └── utils/                  # Utilidades transversales
│       ├── logger.py           # Configuración de Loguru
│       └── validators.py       # Validadores auxiliares
│
├── celery_worker/              # Servicio worker de Celery
│   ├── Dockerfile              # Imagen basada en fastapi/ con CMD celery worker
│   └── celery_app.py           # Instancia Celery (broker Redis)
│
├── nginx/                      # Servicio reverse proxy
│   ├── Dockerfile
│   └── nginx.conf              # Rate limiting, TLS, proxy_pass, WebSocket upgrade
│
├── ollama/                     # Servicio LLM local
│   └── Dockerfile              # Imagen Ollama con soporte GPU NVIDIA
│
└── scripts/                    # Scripts de administración y despliegue
    ├── init_supabase.sql       # Schema SQL: tablas, índice HNSW, función RPC
    ├── generate_ssl.sh         # Generación de certificado SSL con Certbot
    └── pull_model.sh           # Descarga del modelo Qwen2.5:14b en Ollama
```

---

## Principios de organización

### Separación por capas (Layered Architecture)

```
api/          ← Capa de presentación  (HTTP, WebSocket, validación de entrada/salida)
core/         ← Capa de infraestructura (config, auth, DI)
services/     ← Capa de dominio (lógica RAG, ingesta, recuperación, generación)
models/       ← Contratos de datos (Pydantic schemas)
tasks/        ← Capa de procesamiento asíncrono (Celery)
utils/        ← Utilidades transversales
```

### Principio de responsabilidad única (SRP)

Cada clase tiene una única responsabilidad claramente nombrada:
- `PDFExtractor` solo extrae texto de PDFs.
- `MarkdownConverter` solo convierte a Markdown.
- `DocumentChunker` solo divide el texto en chunks.
- `EmbeddingService` solo genera embeddings.
- `SupabaseIndexer` solo sube a la base de datos.
- `VectorRetriever` solo hace búsqueda semántica.
- `BM25Retriever` solo hace búsqueda léxica.
- `HybridRetriever` solo fusiona ambos rankings.
- `LLMService` solo genera respuestas con el LLM.

### Inyección de dependencias

FastAPI gestiona las dependencias mediante `Depends()`. El cliente Supabase se crea una sola vez y se reutiliza. Los `Settings` se cargan desde `.env` al inicio mediante Pydantic Settings.

### Versionado de API

Todos los endpoints están bajo `/api/v1/`, permitiendo introducir `/api/v2/` en el futuro sin romper clientes existentes.
