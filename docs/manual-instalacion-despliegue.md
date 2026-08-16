# Manual de Instalación y Despliegue — Asistente Académico UTI

**Sistema:** Chatbot académico RAG de la Universidad Tecnológica Indoamérica (UTI)
**Versión:** 1.0 (Beta)
**Última actualización:** Julio 2026

Esta guía describe, paso a paso, cómo instalar y poner en producción el sistema completo:
el **backend** (FastAPI + Celery + Redis + Ollama + Nginx en Docker) y el **frontend**
(Next.js). Está pensada para el tesista o el administrador de sistemas que despliega la
aplicación por primera vez.

> Para **usar** el sistema una vez instalado, consulta el [Manual de uso](manual-de-uso.md).

---

## Índice

- [1. Arquitectura de despliegue](#1-arquitectura-de-despliegue)
- [2. Requisitos previos](#2-requisitos-previos)
- [3. Preparar el servidor](#3-preparar-el-servidor)
  - [3.1 Docker Engine](#31-docker-engine)
  - [3.2 Soporte de GPU (nvidia-container-toolkit)](#32-soporte-de-gpu-nvidia-container-toolkit)
- [4. Configurar Supabase (base de datos)](#4-configurar-supabase-base-de-datos)
- [5. Obtener el código y configurar variables](#5-obtener-el-código-y-configurar-variables)
  - [5.1 Clonar el repositorio](#51-clonar-el-repositorio)
  - [5.2 El archivo `.env` del backend](#52-el-archivo-env-del-backend)
- [6. Levantar el backend con Docker](#6-levantar-el-backend-con-docker)
  - [6.1 Construir y arrancar](#61-construir-y-arrancar)
  - [6.2 Descargar el modelo LLM](#62-descargar-el-modelo-llm)
  - [6.3 Verificar que todo funciona](#63-verificar-que-todo-funciona)
- [7. Configurar HTTPS/SSL (Nginx)](#7-configurar-httpsssl-nginx)
- [8. Desplegar el frontend (Next.js)](#8-desplegar-el-frontend-nextjs)
  - [8.1 Variables del frontend](#81-variables-del-frontend)
  - [8.2 Opción A — Vercel (recomendado)](#82-opción-a--vercel-recomendado)
  - [8.3 Opción B — Servidor propio](#83-opción-b--servidor-propio)
- [9. Crear el usuario administrador](#9-crear-el-usuario-administrador)
- [10. Despliegue rápido de demo (túnel Cloudflare)](#10-despliegue-rápido-de-demo-túnel-cloudflare)
- [11. Operación y mantenimiento](#11-operación-y-mantenimiento)
- [12. Solución de problemas de despliegue](#12-solución-de-problemas-de-despliegue)
- [Anexo — Referencia de variables de entorno](#anexo--referencia-de-variables-de-entorno)

---

## 1. Arquitectura de despliegue

El sistema se compone de **cinco contenedores Docker** (backend) más el **frontend** y una
base de datos **Supabase** gestionada en la nube.

```
                    Estudiante / Administrador
                              │  HTTPS
                              ▼
                    ┌───────────────────┐
                    │  Frontend Next.js │  (Vercel o servidor propio)
                    └─────────┬─────────┘
                              │  API REST + WebSocket
                              ▼
        ┌──────────────────── SERVIDOR (Docker) ──────────────────────┐
        │                                                             │
        │   nginx  ──►  fastapi  ──►  redis  ◄──  celery_worker       │
        │  (80/443)    (8000)       (broker)      (ingesta, GPU)      │
        │                 │                            │              │
        │                 └────────► ollama ◄──────────┘              │
        │                           (LLM, GPU · 11434)               │
        └──────────────────────────────┬──────────────────────────────┘
                                        │
                                        ▼
                            Supabase (PostgreSQL + pgvector)
```

| Contenedor | Imagen base | Puerto | GPU | Rol |
|---|---|---|---|---|
| `uti_nginx` | nginx | 80, 443 | No | Proxy inverso + TLS + rate limiting |
| `uti_fastapi` | pytorch 2.4 / CUDA 12.1 | 8000 | — | API REST + WebSocket |
| `uti_celery` | pytorch 2.4 / CUDA 12.1 | — | **Sí** | Ingesta asíncrona (extracción, embeddings, indexado) |
| `uti_redis` | redis:7-alpine | 6379 | No | Broker de Celery + pub/sub de progreso |
| `uti_ollama` | ollama | 11434 | **Sí** | Servidor del modelo de lenguaje (Qwen2.5:14b) |

> **Nota sobre la imagen:** el `Dockerfile` de `fastapi` y `celery_worker` usa
> `pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime`, que ya trae PyTorch con CUDA. Los
> embeddings (`BAAI/bge-m3`) corren en GPU dentro del worker de Celery.

---

## 2. Requisitos previos

**Hardware (servidor)**
- CPU x86-64, 8+ núcleos recomendados.
- **16 GB RAM** o más.
- **GPU NVIDIA** con **≥ 12 GB VRAM** (el proyecto se validó en una **Tesla V100 16 GB**;
  el modelo `qwen2.5:14b` ocupa ~9 GB).
- ~30 GB de disco libre (imágenes Docker + modelo LLM ~9 GB + volúmenes).

**Software (servidor)**
- **Ubuntu 22.04 o 24.04** (u otra distro Linux compatible).
- **Docker Engine 24+** y **Docker Compose v2**.
- **Driver NVIDIA ≥ 525** + CUDA 12.x.
- **nvidia-container-toolkit** (para exponer la GPU a los contenedores).

**Servicios en la nube**
- Una cuenta de **[Supabase](https://supabase.com)** con un proyecto creado (plan gratuito
  suficiente para pruebas).
- (Opcional) Cuenta de **[Vercel](https://vercel.com)** para el frontend.
- Un **dominio** propio si se desea HTTPS con certificado válido.

---

## 3. Preparar el servidor

### 3.1 Docker Engine

Si Docker no está instalado:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # aplica el grupo sin cerrar sesión
```

Verifica:

```bash
docker --version
docker compose version
```

### 3.2 Soporte de GPU (nvidia-container-toolkit)

Los contenedores `ollama` y `celery_worker` necesitan acceso a la GPU. Instala el toolkit:

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Comprueba que Docker ve la GPU:

```bash
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

Debe listar tu GPU (p. ej. la Tesla V100). Si falla, revisa el driver del host con
`nvidia-smi`.

---

## 4. Configurar Supabase (base de datos)

El sistema usa Supabase (PostgreSQL con la extensión **pgvector**) como almacén de vectores
y de observabilidad.

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el panel de Supabase, entra a **SQL Editor**.
3. Copia **todo** el contenido de [`scripts/init_supabase.sql`](../scripts/init_supabase.sql)
   y ejecútalo. Este script crea:
   - Las **extensiones**: `vector`, `pg_trgm`, `unaccent`, `pgcrypto`, `uuid-ossp`.
   - Las **tablas**: `documents`, `ingestion_jobs`, `document_chunks`, `chat_sessions`,
     `chat_messages`, `retrieval_logs`.
   - El **índice HNSW** para búsqueda vectorial (1024 dimensiones) y el índice FTS en español.
   - Las funciones RPC: `match_chunks`, `match_chunks_fts`, `match_chunks_hybrid` (fusión RRF).
   - Las **políticas RLS** y la función `is_admin()`.
4. Anota, desde **Project Settings → API**, los siguientes valores (los necesitarás en el
   `.env`):
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secreta, no exponer al frontend)
   - **JWT Secret** (en *API → JWT Settings*) → `SUPABASE_JWT_SECRET`

---

## 5. Obtener el código y configurar variables

### 5.1 Clonar el repositorio

```bash
git clone <url-del-repo> uti-rag-backend
cd uti-rag-backend
```

### 5.2 El archivo `.env` del backend

Copia la plantilla y edítala:

```bash
cp .env.example .env
nano .env
```

Completa **como mínimo** los siguientes campos:

```ini
# --- Supabase ---
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...

# --- Redis (elige una contraseña fuerte y úsala en AMBAS variables) ---
REDIS_PASSWORD=una_clave_larga_y_secreta
REDIS_URL=redis://:una_clave_larga_y_secreta@redis:6379/0

# --- FastAPI ---
SECRET_KEY=una_clave_de_al_menos_32_caracteres
ENVIRONMENT=production
ALLOWED_ORIGINS=https://tu-frontend.vercel.app

# --- Servidor ---
DOMAIN=tu-dominio-o-ip.com
```

> ⚠️ **Muy importante:**
> - `REDIS_URL` **debe incluir la misma contraseña** que `REDIS_PASSWORD`, con el formato
>   `redis://:PASSWORD@redis:6379/0`. Si no coinciden, Celery no arranca.
> - `ALLOWED_ORIGINS` debe ser la URL exacta del frontend, o el navegador bloqueará las
>   peticiones por CORS.
> - El `.env` **contiene credenciales reales**; ya está en `.gitignore`. **Nunca lo subas
>   a git.**

El resto de variables (modelo, chunking, retrieval, embeddings) traen valores por defecto
razonables — ver el [Anexo](#anexo--referencia-de-variables-de-entorno).

---

## 6. Levantar el backend con Docker

### 6.1 Construir y arrancar

Desde la raíz `uti-rag-backend/`:

```bash
docker compose up -d --build
```

> Si el grupo `docker` se añadió en la sesión actual y aún no aplica, antepon
> `sg docker -c "..."`, p. ej. `sg docker -c "docker compose up -d --build"`.

La primera construcción descarga las imágenes base de PyTorch/CUDA y puede tardar varios
minutos.

Comprueba el estado:

```bash
docker compose ps
```

Deben verse `uti_fastapi`, `uti_celery`, `uti_redis`, `uti_ollama` (y `uti_nginx` si ya
configuraste SSL) en estado *Up*.

### 6.2 Descargar el modelo LLM

Ollama arranca **sin** el modelo. Descárgalo una vez:

```bash
bash scripts/pull_model.sh
```

El script espera a que Ollama esté listo y ejecuta `ollama pull qwen2.5:14b` (~9 GB). Se
guarda en el volumen `ollama_data` y **persiste** entre reinicios.

Verifica el modelo:

```bash
docker exec uti_ollama ollama list
```

### 6.3 Verificar que todo funciona

Prueba el endpoint de salud:

```bash
curl http://localhost:8000/api/v1/health
```

Debe responder con el estado de `fastapi`, `supabase`, `ollama` y `embeddings` en
`running`. Prueba también una consulta al chat:

```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Qué es la UTI?"}'
```

Revisa los logs si algo falla:

```bash
docker compose logs -f fastapi
docker compose logs -f celery_worker
```

---

## 7. Configurar HTTPS/SSL (Nginx)

Nginx no queda activo hasta tener certificados. Para un dominio real, genera un certificado
Let's Encrypt (requiere que el puerto 80 sea accesible desde internet):

```bash
sudo bash scripts/generate_ssl.sh tu-dominio.com tu@email.com
```

Esto ejecuta `certbot certonly --standalone` y deja el certificado en
`/etc/letsencrypt/live/tu-dominio.com/`. El `docker-compose.yml` ya monta ese directorio en
el contenedor Nginx (volúmenes `certbot_conf` y `nginx/ssl`).

Reinicia Nginx para que tome el certificado:

```bash
docker compose up -d nginx
```

Nginx aplica además **rate limiting** (60 req/min) a los endpoints públicos de chat.

> **Renovación:** los certificados Let's Encrypt caducan a los 90 días. Programa
> `certbot renew` en un cron y recarga Nginx tras renovar.

---

## 8. Desplegar el frontend (Next.js)

El frontend vive en la carpeta [`frontend/`](../frontend/) (Next.js 15, React 19).

### 8.1 Variables del frontend

Copia la plantilla y edítala:

```bash
cd frontend
cp .env.local.example .env.local
nano .env.local
```

```ini
# URL pública del backend (a través de Nginx/HTTPS)
NEXT_PUBLIC_API_URL=https://tu-dominio.com

# Supabase — solo para la autenticación del panel admin
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiI...
```

> Usa **únicamente** la `anon key` en el frontend. La `service_role` **jamás** debe estar
> en el cliente.

### 8.2 Opción A — Vercel (recomendado)

1. Importa el repositorio en [Vercel](https://vercel.com) y define como *Root Directory* la
   carpeta `frontend/`.
2. En **Settings → Environment Variables**, añade `NEXT_PUBLIC_API_URL`,
   `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Despliega. Vercel ejecuta `next build` automáticamente.
4. Copia la URL final de Vercel y ponla en `ALLOWED_ORIGINS` del `.env` del backend; luego
   reinicia `fastapi`:
   ```bash
   docker compose up -d fastapi
   ```

### 8.3 Opción B — Servidor propio

```bash
cd frontend
npm install
npm run build
npm run start   # sirve en el puerto 3002
```

Coloca el frontend detrás de un proxy (Nginx) con HTTPS, igual que el backend.

---

## 9. Crear el usuario administrador

El panel admin (`/dashboard`) exige un usuario de Supabase con **rol de administrador**.

1. En Supabase → **Authentication → Users → Add user**, crea el usuario con su correo y
   contraseña.
2. Asigna el rol de administrador editando su **user metadata**. En el **SQL Editor**:

   ```sql
   update auth.users
   set raw_user_meta_data = raw_user_meta_data || '{"role":"admin"}'
   where email = 'admin@uti.edu.ec';
   ```

3. La verificación se hace en el backend (`fastapi/core/security.py`), que exige
   `user_metadata.role == "admin"` en el JWT para cualquier endpoint `/api/v1/admin/*`.

Ahora ese usuario puede iniciar sesión en `…/login` (ver [Manual de uso, Parte B](manual-de-uso.md#b1-iniciar-sesión)).

---

## 10. Despliegue rápido de demo (túnel Cloudflare)

Para una **demostración temporal** sin dominio ni SSL, el repositorio incluye
[`deploy-demo.sh`](../deploy-demo.sh), que expone la app a internet mediante un túnel
gratuito de Cloudflare.

**Requisitos:** el stack Docker ya levantado y `cloudflared` instalado en
`~/.local/bin/cloudflared`.

```bash
./deploy-demo.sh
```

El script:
1. Verifica que FastAPI responda en `:8000`.
2. Hace `build` y arranca Next.js en `:3002`.
3. Abre un túnel `cloudflared` y obtiene una URL pública `https://xxxx.trycloudflare.com`.
4. Imprime las URLs de **Chat** (`/`) y **Admin** (`/login`).

Para detener la demo:

```bash
pkill -f 'next start'; pkill -f 'cloudflared tunnel'
```

> ⚠️ La URL de `trycloudflare.com` es **efímera** (cambia en cada ejecución) y solo sirve
> para demos, no para producción.

---

## 11. Operación y mantenimiento

Comandos frecuentes (desde `uti-rag-backend/`):

```bash
# Estado de los contenedores
docker compose ps

# Logs en vivo
docker compose logs -f fastapi
docker compose logs -f celery_worker

# Reiniciar tras cambiar el .env
docker compose up -d fastapi celery_worker

# Reconstruir tras cambios en código o requirements.txt
docker compose up -d --build fastapi celery_worker

# Validar la configuración de compose sin levantar nada
docker compose config --quiet

# Probar el modelo directamente
docker exec uti_ollama ollama run qwen2.5:14b "pregunta de prueba"
```

**Cambiar el modelo LLM:** edita `OLLAMA_MODEL` en `.env`, ejecuta `docker compose up -d` y
descarga el nuevo modelo con `scripts/pull_model.sh`.

**Datos persistentes (volúmenes Docker):**
- `ollama_data` — el modelo LLM descargado.
- `redis_data` — cola y estado de Celery.
- `uploads_data` — PDFs temporales durante la ingesta (se borran al terminar cada trabajo).
- `certbot_conf` / `certbot_www` — certificados SSL.

Los datos de documentos, chunks y conversaciones viven en **Supabase**, no en los volúmenes.

---

## 12. Solución de problemas de despliegue

| Síntoma | Causa probable | Solución |
|---|---|---|
| `celery_worker` reinicia en bucle | `REDIS_URL` no coincide con `REDIS_PASSWORD` | Corrige ambas variables al mismo valor y reinicia |
| El chat responde error 500 / timeout | El modelo LLM no está descargado | Ejecuta `bash scripts/pull_model.sh` y espera a que termine |
| `docker run --gpus all` falla | Falta o mal configurado nvidia-container-toolkit | Repite el paso 3.2; verifica `nvidia-smi` en el host |
| Ollama arranca pero se queda sin VRAM | Otro proceso (p. ej. Docling) usa la GPU | Mantén `DOCLING_DEVICE=cpu`; verifica con `nvidia-smi` |
| El frontend no puede llamar al backend (CORS) | `ALLOWED_ORIGINS` no incluye la URL del frontend | Añádela en `.env` y reinicia `fastapi` |
| No se puede iniciar sesión en el panel | El usuario no tiene `role=admin` | Ejecuta el `UPDATE` del paso 9 |
| Error de conexión a Supabase en `/health` | Credenciales de Supabase incorrectas | Revisa `SUPABASE_URL`/keys en `.env` |
| La ingesta falla en "Extrayendo" | PDF escaneado sin texto | Usa un PDF con texto seleccionable, o habilita OCR |

---

## Anexo — Referencia de variables de entorno

Variables del backend (`.env`). Las marcadas con **⚑** son obligatorias de personalizar.

| Variable | Ejemplo / por defecto | Descripción |
|---|---|---|
| **⚑** `SUPABASE_URL` | `https://xxxx.supabase.co` | URL del proyecto Supabase |
| **⚑** `SUPABASE_ANON_KEY` | `eyJ...` | Clave pública (anon) |
| **⚑** `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Clave de servicio (secreta) |
| **⚑** `SUPABASE_JWT_SECRET` | `...` | Secreto para validar los JWT de admin |
| **⚑** `REDIS_PASSWORD` | `cambia_esta_clave` | Contraseña de Redis |
| **⚑** `REDIS_URL` | `redis://:PASSWORD@redis:6379/0` | Debe incluir la contraseña anterior |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Endpoint interno de Ollama |
| `OLLAMA_MODEL` | `qwen2.5:14b` | Modelo de lenguaje |
| `LLM_TEMPERATURE` | `0.1` | Creatividad del modelo (bajo = más factual) |
| `LLM_NUM_PREDICT` | `768` | Máximo de tokens generados por respuesta |
| **⚑** `SECRET_KEY` | *(≥ 32 caracteres)* | Clave interna de FastAPI |
| `ENVIRONMENT` | `production` | Entorno de ejecución |
| **⚑** `ALLOWED_ORIGINS` | `https://...vercel.app` | Orígenes permitidos (CORS) |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | Modelo de embeddings |
| `EMBEDDING_DIM` | `1024` | Dimensiones del vector |
| `EMBEDDING_DEVICE` | `auto` | `auto` usa GPU si hay CUDA, si no CPU |
| `EMBEDDING_BATCH_SIZE` | `32` | Tamaño de lote de embeddings |
| `EMBEDDING_NORMALIZE` | `true` | Normaliza los vectores |
| `CHUNK_MAX_TOKENS` | `512` | Tamaño máximo de cada chunk |
| `CHUNK_MERGE_PEERS` | `true` | Fusiona chunks vecinos pequeños |
| `RETRIEVAL_TOP_K` | `5` | Nº de fragmentos recuperados por consulta |
| `RETRIEVAL_RRF_K` | `60` | Constante de la fusión RRF |
| `RETRIEVAL_MIN_SIMILARITY` | `0.4` | Umbral mínimo de similitud |
| `INDEXER_BATCH_SIZE` | `100` | Tamaño de lote al indexar |
| `UPLOAD_DIR` | `/app/uploads` | Directorio temporal de PDFs |
| `MAX_UPLOAD_BYTES` | `52428800` | Límite de subida (50 MB) |
| `CELERY_RETRY_MAX` | `3` | Reintentos de la ingesta |
| `CELERY_RETRY_BACKOFF` | `60` | Segundos de espera entre reintentos |
| **⚑** `DOMAIN` | `tu-dominio.com` | Dominio/IP del servidor |

Variables del frontend (`frontend/.env.local`):

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública del backend (vía Nginx/HTTPS) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon de Supabase (solo auth del panel) |

---

_Universidad Tecnológica Indoamérica · Ecuador · Asistente Académico UTI v1.0 (Beta)_
