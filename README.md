# UTI RAG Backend

Backend del chatbot académico de la **Universidad Tecnológica Indoamérica (UTI)** desarrollado como tesis de grado. Implementa un sistema de Recuperación Aumentada por Generación (RAG) sobre documentos institucionales para responder consultas estudiantiles.

## Arquitectura

```
Cliente (Next.js / Vercel)
        │
        ▼
   Nginx (SSL)
        │
        ▼
  FastAPI (API REST + WebSocket)
   ├── Retrieval híbrido (pgvector + BM25 → RRF)
   ├── Generación (Qwen2.5:14b vía Ollama)
   └── Ingesta asíncrona (Celery)
        │
   ┌────┴────────────────────┐
   ▼                         ▼
Supabase (pgvector)       Redis (broker)
                              │
                              ▼
                        Celery Worker
                    (PDFExtractor → Docling →
                     Chunker → Embedder → Indexer)
```

## Stack

| Componente | Tecnología |
|---|---|
| API | FastAPI + Uvicorn |
| LLM | Qwen2.5:14b vía Ollama |
| Embeddings | `BAAI/bge-m3` (1024d) |
| Vector store | Supabase + pgvector (índice HNSW, 1024d) |
| Retrieval | BM25 + similitud coseno → Reciprocal Rank Fusion |
| PDF parsing | PyMuPDF + Docling (Markdown estructurado) |
| Tareas async | Celery + Redis |
| Proxy | Nginx + Let's Encrypt |
| Contenedores | Docker Compose + nvidia-container-toolkit |
| GPU | NVIDIA Tesla V100 16 GB |

## Requisitos previos

- Ubuntu 22.04 / 24.04
- Docker Engine 24+
- nvidia-container-toolkit (para acceso GPU desde Docker)
- Driver NVIDIA ≥ 525 + CUDA 12.x
- Cuenta en [Supabase](https://supabase.com) con proyecto creado

## Instalación

### 1. Clonar y configurar variables

```bash
git clone <repo-url> && cd uti-rag-backend
cp .env.example .env
nano .env   # completar credenciales Supabase
```

### 2. Instalar nvidia-container-toolkit (si no está)

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
sudo usermod -aG docker $USER && newgrp docker
```

### 3. Inicializar base de datos en Supabase

Ejecutar el contenido de `scripts/init_supabase.sql` en el **SQL Editor** de tu proyecto Supabase. Crea las tablas `documents` y `document_chunks`, el índice HNSW y la función RPC `match_chunks`.

### 4. Generar certificado SSL

```bash
sudo bash scripts/generate_ssl.sh tu-dominio.com tu@email.com
```

### 5. Levantar los servicios

```bash
docker compose up -d --build
```

### 6. Descargar el modelo LLM

```bash
bash scripts/pull_model.sh
```

### 7. Verificar

```bash
docker compose ps
docker compose logs -f fastapi
```

## Endpoints principales

### Chat (público)

```
POST /api/v1/chat
Content-Type: application/json

{ "query": "¿Cuáles son los requisitos de titulación?" }
```

### Documentos (requiere JWT admin de Supabase)

```
POST   /api/v1/admin/documents/upload   — subir PDF
GET    /api/v1/admin/documents/         — listar documentos
DELETE /api/v1/admin/documents/{id}     — eliminar documento
```

### WebSocket — progreso de ingesta

```
WS /api/v1/ws/ingestion/{task_id}
```

## Pipeline de ingesta

```
PDF subido
  └─► PyMuPDF (extracción texto)
  └─► Docling (conversión Markdown estructurado)
  └─► MarkdownHeaderSplitter (chunking jerárquico)
  └─► sentence-transformers (embeddings 384d)
  └─► Supabase pgvector (indexado HNSW)
```

## Pipeline de consulta

```
Pregunta estudiante
  └─► Embedding query
  └─► [Vector search pgvector] + [BM25 léxico]
  └─► Reciprocal Rank Fusion (top 5)
  └─► Prompt con contexto → Qwen2.5:14b (Ollama)
  └─► Respuesta + fuentes
```

## Estructura del proyecto

```
uti-rag-backend/
├── docker-compose.yml
├── .env.example
├── nginx/               — proxy inverso + SSL
├── fastapi/             — API principal
│   ├── api/v1/          — endpoints
│   ├── core/            — config, seguridad, dependencias
│   ├── services/        — lógica de negocio
│   │   ├── ingestion/   — extractor, converter, chunker, embedder, indexer
│   │   ├── retrieval/   — bm25, vector, hybrid (RRF)
│   │   ├── generation/  — prompt builder, cliente Ollama
│   │   └── document/    — CRUD Supabase
│   ├── models/          — schemas Pydantic
│   ├── tasks/           — tareas Celery
│   └── utils/           — logger, validators
├── celery_worker/       — worker de ingesta async
├── ollama/              — servidor LLM con GPU
└── scripts/             — SQL init, SSL, pull model
```

## Variables de entorno

Ver `.env.example` para la lista completa. Las críticas:

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (acceso total) |
| `SUPABASE_JWT_SECRET` | Secret para verificar tokens de usuarios |
| `REDIS_PASSWORD` | Contraseña Redis |
| `REDIS_URL` | `redis://:PASSWORD@redis:6379/0` |
| `OLLAMA_MODEL` | Modelo LLM (default: `qwen2.5:14b`) |
| `ALLOWED_ORIGINS` | URL del frontend (CORS) |

## Gestión de contenedores

```bash
# Ver estado
docker compose ps

# Logs en tiempo real
docker compose logs -f fastapi
docker compose logs -f celery_worker

# Reiniciar un servicio tras cambiar .env
docker compose up -d fastapi

# Parar todo (conserva volúmenes y modelo)
docker compose down

# Parar y borrar volúmenes (⚠️ borra el modelo descargado)
docker compose down -v
```
