# Referencia de la API — Asistente Académico UTI

**Sistema:** Chatbot académico RAG de la Universidad Tecnológica Indoamérica (UTI)
**Versión de la API:** 1.0.0
**Última actualización:** Julio 2026

Referencia técnica de la API REST y los WebSockets del backend (FastAPI). Dirigida a
desarrolladores que integran, prueban o mantienen el sistema.

> Documentación interactiva autogenerada: con el backend en marcha, visita
> **`/docs`** (Swagger UI) o **`/redoc`** (ReDoc).

---

## Índice

- [1. Convenciones generales](#1-convenciones-generales)
  - [1.1 URL base y versionado](#11-url-base-y-versionado)
  - [1.2 Autenticación](#12-autenticación)
  - [1.3 Formato de errores](#13-formato-de-errores)
  - [1.4 CORS y rate limiting](#14-cors-y-rate-limiting)
- [2. Health](#2-health)
- [3. Chat (público)](#3-chat-público)
  - [POST /chat](#post-apiv1chat)
  - [PATCH /chat/{message_id}/feedback](#patch-apiv1chatmessage_idfeedback)
  - [GET /chat/admin/feedback](#get-apiv1chatadminfeedback)
- [4. Documentos (admin)](#4-documentos-admin)
  - [POST /admin/documents/upload](#post-apiv1admindocumentsupload)
  - [POST /admin/documents/{doc_id}/reindex](#post-apiv1admindocumentsdoc_idreindex)
  - [DELETE /admin/documents/{doc_id}](#delete-apiv1admindocumentsdoc_id)
  - [GET /admin/documents](#get-apiv1admindocuments)
  - [GET /admin/documents/{doc_id}](#get-apiv1admindocumentsdoc_id)
  - [GET /admin/documents/{doc_id}/jobs](#get-apiv1admindocumentsdoc_idjobs)
- [5. Estadísticas (admin)](#5-estadísticas-admin)
- [6. Conversaciones (admin)](#6-conversaciones-admin)
- [7. Evaluación RAGAS (admin)](#7-evaluación-ragas-admin)
- [8. WebSockets](#8-websockets)
- [9. Modelos de datos](#9-modelos-de-datos)
- [Anexo — Tabla resumen de endpoints](#anexo--tabla-resumen-de-endpoints)

---

## 1. Convenciones generales

### 1.1 URL base y versionado

Todos los endpoints REST cuelgan del prefijo **`/api/v1`**.

```
https://tu-dominio.com/api/v1/...
```

En desarrollo local, el backend escucha en `http://localhost:8000`.

### 1.2 Autenticación

Existen **dos niveles** de acceso:

| Nivel | Endpoints | Requisito |
|---|---|---|
| **Público** | `POST /chat`, `PATCH /chat/{id}/feedback`, `GET /health`, WebSockets | Ninguno |
| **Admin** | Todo `/api/v1/admin/*` y `GET /chat/admin/feedback` | JWT de administrador |

Los endpoints admin usan **HTTP Bearer** con un **JWT de Supabase**. Envía la cabecera:

```
Authorization: Bearer <access_token_de_supabase>
```

El backend (`core/security.py`) valida el token con Supabase y exige que el usuario tenga
`user_metadata.role == "admin"`. Respuestas de error de autenticación:

- **401 Unauthorized** — token ausente, inválido o expirado.
- **403 Forbidden** — token válido pero el usuario **no es administrador**.

> El token se obtiene iniciando sesión con el SDK de Supabase (`signInWithPassword`), tal
> como hace el panel del frontend. Ver [Manual de instalación §9](manual-instalacion-despliegue.md#9-crear-el-usuario-administrador)
> para crear un usuario admin.

### 1.3 Formato de errores

Los errores siguen el formato estándar de FastAPI:

```json
{ "detail": "Mensaje descriptivo del error" }
```

En algunos casos `detail` es un **objeto** (por ejemplo, el 409 de subida de un PDF
duplicado devuelve `detail.doc_id` y `detail.status`).

Errores de validación de entrada (Pydantic) devuelven **422** con la lista de campos
inválidos.

### 1.4 CORS y rate limiting

- **CORS:** solo se aceptan peticiones desde los orígenes declarados en `ALLOWED_ORIGINS`
  (variable de entorno del backend, separada por comas).
- **Rate limiting:** Nginx limita los endpoints públicos de chat a **60 req/min**.

---

## 2. Health

### `GET /api/v1/health`

Comprobación de salud liviana, usada por el panel para el semáforo de servicios. **Público.**

**Respuesta `200 OK`** — [`HealthResponse`](#healthresponse):

```json
{
  "fastapi":    { "status": "running", "detail": "" },
  "supabase":   { "status": "running", "detail": "" },
  "ollama":     { "status": "running", "detail": "" },
  "embeddings": { "status": "running", "detail": "" }
}
```

Cada servicio reporta `status` = `"running"` o `"error"`; en caso de error, `detail`
contiene los primeros 120 caracteres del mensaje.

---

## 3. Chat (público)

### `POST /api/v1/chat`

Envía una consulta al asistente y recibe la respuesta generada con sus fuentes.

**Cuerpo** — [`ChatRequest`](#chatrequest):

```json
{
  "query": "¿Cuántos créditos necesito para titularme en Ingeniería en Sistemas?",
  "session_token": "opcional-para-hilar-la-conversación",
  "top_k": 5,
  "filter_doc_ids": null
}
```

| Campo | Tipo | Req. | Descripción |
|---|---|---|---|
| `query` | string | ✅ | Pregunta. Entre **3 y 1000** caracteres. |
| `session_token` | string | — | Token para agrupar mensajes en una misma sesión. Si es nuevo, se crea una sesión anónima. |
| `top_k` | int | — | Nº de chunks a recuperar. Rango **1–20**, por defecto **5**. |
| `filter_doc_ids` | string[] | — | Limita la búsqueda a estos documentos. |

**Respuesta `200 OK`** — [`ChatResponse`](#chatresponse):

```json
{
  "answer": "Para titularte necesitas 240 créditos [Fuente 1]...",
  "sources": [
    {
      "doc_id": "b3c1...",
      "chunk_id": "9f2a...",
      "filename": "Reglamento_de_Regimen_Academico.pdf",
      "page_number": 12,
      "heading_path": "Título III > Capítulo 2",
      "snippet": "El estudiante deberá completar un mínimo de...",
      "score": 0.91
    }
  ],
  "latency_ms": 842,
  "message_id": "d7e4..."
}
```

**Comportamientos especiales:**
- **Saludos/cortesía** (p. ej. "hola", "gracias") reciben una respuesta conversacional fija,
  sin recuperación ni fuentes.
- **Sin resultados:** si no hay chunks relevantes, devuelve un mensaje indicándolo con
  `sources: []` (no inventa respuesta).
- Cada interacción se registra en `chat_messages` + `retrieval_logs`. El `message_id`
  devuelto sirve para enviar feedback.

**Errores:** `422` (query fuera de rango) · `500` (error interno).

**Ejemplo cURL:**

```bash
curl -X POST https://tu-dominio.com/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Qué requisitos pide la beca por excelencia académica?"}'
```

---

### `PATCH /api/v1/chat/{message_id}/feedback`

Registra la valoración del usuario sobre una respuesta. **Público.**

**Parámetro de ruta:** `message_id` — el `message_id` devuelto por `POST /chat`.

**Cuerpo** — [`FeedbackRequest`](#feedbackrequest):

```json
{ "rating": 1 }
```

| `rating` | Significado |
|---|---|
| `1` | Útil (👍) |
| `-1` | No útil (👎) |
| `null` | Quitar la valoración |

**Respuesta `200 OK`:** `{ "ok": true }` · **Error:** `500`.

---

### `GET /api/v1/chat/admin/feedback`

🔒 **Admin.** Devuelve contadores de likes/dislikes y las últimas 50 respuestas valoradas
negativamente (con la pregunta del usuario asociada, para diagnóstico).

**Respuesta `200 OK`** — [`FeedbackStats`](#feedbackstats):

```json
{
  "likes": 128,
  "dislikes": 14,
  "disliked_messages": [
    {
      "message_id": "d7e4...",
      "answer": "...",
      "user_query": "¿Cuándo abren inscripciones 2026-B?",
      "created_at": "2026-07-01T14:22:10Z"
    }
  ]
}
```

---

## 4. Documentos (admin)

Todos requieren 🔒 **JWT admin**. Prefijo: `/api/v1/admin/documents`.

### `POST /api/v1/admin/documents/upload`

Sube un PDF e inicia su ingesta asíncrona (Celery). **`multipart/form-data`.**

| Campo (form) | Tipo | Req. | Descripción |
|---|---|---|---|
| `file` | archivo | ✅ | PDF. Máx. **50 MB**. Se valida el MIME real (no solo la extensión). |
| `category` | string | — | Categoría (Reglamentos, Manuales, Normativas…). |
| `description` | string | — | Descripción libre. |
| `tags` | string | — | Lista separada por comas: `"reglamento,grado,tesis"`. |
| `language` | string | — | Idioma. Por defecto `"es"`. |

**Respuesta `200 OK`:**

```json
{
  "doc_id": "b3c1...",
  "task_id": "celery-task-uuid",
  "status": "pending",
  "filename": "Reglamento.pdf",
  "file_hash": "sha256...",
  "file_size_bytes": 1048576
}
```

Usa el `task_id` para seguir el progreso vía [WebSocket de ingesta](#websocket-ingestiontask_id).

**Errores:**
- **409 Conflict** — el PDF ya está indexado (mismo `file_hash`). El `detail` incluye el
  `doc_id` y `status` del documento existente.
- **400/422** — archivo inválido o no es PDF.

**Ejemplo cURL:**

```bash
curl -X POST https://tu-dominio.com/api/v1/admin/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Reglamento.pdf" \
  -F "category=Reglamentos" \
  -F "tags=grado,titulación"
```

### `POST /api/v1/admin/documents/{doc_id}/reindex`

Re-encola la ingesta de un documento ya registrado (borra sus chunks previos primero). Útil
tras cambiar el chunker o el modelo de embeddings.

**Respuesta `200 OK`:** `{ "doc_id": "...", "task_id": "...", "status": "queued" }`

**Errores:** `404` (documento no encontrado) · `410` (el PDF original ya no está en disco;
súbelo de nuevo).

### `DELETE /api/v1/admin/documents/{doc_id}`

Elimina el documento, sus chunks vectorizados y el PDF en disco. **Irreversible.**

**Respuesta `200 OK`:** `{ "status": "deleted", "doc_id": "..." }` · **Error:** `404`.

### `GET /api/v1/admin/documents`

Lista todos los documentos. **Respuesta:** array de [`DocumentOut`](#documentout).

### `GET /api/v1/admin/documents/{doc_id}`

Devuelve un documento por ID. **Respuesta:** [`DocumentOut`](#documentout) · **Error:** `404`.

### `GET /api/v1/admin/documents/{doc_id}/jobs`

Histórico de trabajos de ingesta del documento (más reciente primero). Útil para depurar
fallos, ya que incluye `steps_log`. **Respuesta:** array de [`IngestionJobOut`](#ingestionjobout).

---

## 5. Estadísticas (admin)

🔒 **Admin.** Prefijo: `/api/v1/admin/stats`.

### `GET /api/v1/admin/stats`

Métricas para la pantalla **Overview**. **Respuesta** — [`OverviewStats`](#overviewstats):
totales de documentos por estado, chunks, sesiones y consultas de hoy, latencia media,
actividad de 7 días y documentos recientes.

### `GET /api/v1/admin/stats/analytics`

Métricas para la pantalla **Analítica**.

| Query param | Valores | Por defecto |
|---|---|---|
| `range` | `7d`, `30d`, `90d` | `30d` |

**Respuesta** — [`AnalyticsStats`](#analyticsstats): total de consultas (con % de cambio),
latencia media, tasa de éxito de ingesta, serie temporal, documentos más consultados y
distribución por categoría.

### `GET /api/v1/admin/stats/logs`

Bitácora del sistema para la pantalla **Estado del Sistema**.

| Query param | Rango | Por defecto |
|---|---|---|
| `limit` | 1–100 | 20 |

**Respuesta** — [`LogList`](#loglist): lista de entradas con `ts`, `level`
(`info`/`warn`/`error`) y `text`.

---

## 6. Conversaciones (admin)

🔒 **Admin.** Prefijo: `/api/v1/admin/conversations`.

### `GET /api/v1/admin/conversations`

Lista las sesiones de conversación (resumen).

| Query param | Rango | Por defecto |
|---|---|---|
| `limit` | 1–200 | 50 |

**Respuesta:** array de [`ConversationSummary`](#conversationsummary).

### `GET /api/v1/admin/conversations/{session_id}`

Detalle completo de una conversación, con todos sus mensajes y las fuentes recuperadas por
cada respuesta. **Respuesta:** [`ConversationDetail`](#conversationdetail).

---

## 7. Evaluación RAGAS (admin)

🔒 **Admin.** Prefijo: `/api/v1/admin/evaluation`.

### `POST /api/v1/admin/evaluation`

Lanza una evaluación RAGAS en background.

**Cuerpo** — [`EvaluationRequest`](#evaluationrequest):

```json
{ "doc_ids": ["b3c1...", "a92f..."], "n_samples": 5 }
```

| Campo | Tipo | Descripción |
|---|---|---|
| `doc_ids` | string[] \| null | Documentos a evaluar. `null` = todos los que están `ready`. |
| `n_samples` | int | Preguntas generadas por documento. Rango **1–15**, por defecto **5**. |

**Respuesta `200 OK`:** `{ "task_id": "..." }`. Sigue el progreso vía
[WebSocket de evaluación](#websocket-evaluationtask_id).

### `GET /api/v1/admin/evaluation`

Devuelve las últimas 20 evaluaciones (con nombres de documentos resueltos en `doc_names`).

### `GET /api/v1/admin/evaluation/{task_id}`

Estado y resultados de una evaluación: `status`, `n_samples`, `metrics` (faithfulness,
precision, recall, score compuesto), `samples` y `error_msg`. **Error:** `404`.

### `GET /api/v1/admin/evaluation/{task_id}/report`

Descarga el **reporte PDF** de una evaluación completada (`Content-Type: application/pdf`).

**Errores:** `404` (evaluación o PDF no encontrado) · `409` (la evaluación aún no ha
finalizado).

---

## 8. WebSockets

Los WebSockets transmiten progreso en tiempo real desde Redis pub/sub. **No requieren
token** (el `task_id` actúa como secreto de un solo uso). Base: `wss://tu-dominio.com/api/v1/ws`.

Cada mensaje es un JSON con al menos un campo `step`. El servidor cierra la conexión cuando
`step` es `"done"` o `"error"`.

### `WS /api/v1/ws/ingestion/{task_id}`

Progreso de la ingesta de un documento. Pasos (`step`):

`loading` → `extraction`/`conversion` → `chunking` → `embedding` → `indexing` → `done`
(o `error`).

Mensaje de ejemplo:

```json
{ "step": "embedding", "message": "Generando embeddings (batch 3/5)", "progress": 0.6 }
```

### `WS /api/v1/ws/evaluation/{task_id}`

Progreso de una evaluación RAGAS, con la misma semántica (`step` termina en `done`/`error`).

**Ejemplo de cliente (JavaScript):**

```javascript
const ws = new WebSocket(`wss://tu-dominio.com/api/v1/ws/ingestion/${taskId}`);
ws.onmessage = (e) => {
  const { step, message } = JSON.parse(e.data);
  console.log(step, message);
  if (step === "done" || step === "error") ws.close();
};
```

---

## 9. Modelos de datos

### ChatRequest
| Campo | Tipo | Notas |
|---|---|---|
| `query` | string | 3–1000 caracteres, requerido |
| `session_token` | string? | opcional |
| `top_k` | int | 1–20, por defecto 5 |
| `filter_doc_ids` | string[]? | opcional |

### ChatResponse
| Campo | Tipo |
|---|---|
| `answer` | string |
| `sources` | [Source](#source)[] |
| `latency_ms` | int? |
| `message_id` | string? |

### Source
| Campo | Tipo | Notas |
|---|---|---|
| `doc_id` | string | ID del documento |
| `chunk_id` | string | ID del fragmento |
| `filename` | string | Nombre del PDF |
| `page_number` | int? | Página de origen |
| `heading_path` | string? | Ruta de encabezados (ej. "Título III > Cap. 2") |
| `snippet` | string | Extracto (≤ 240 car.) |
| `score` | float | Relevancia (0–1) |

### FeedbackRequest
| Campo | Tipo | Valores |
|---|---|---|
| `rating` | int? | `1`, `-1` o `null` |

### FeedbackStats
| Campo | Tipo |
|---|---|
| `likes` | int |
| `dislikes` | int |
| `disliked_messages` | DislikedMessage[] (`message_id`, `answer`, `user_query`, `created_at`) |

### DocumentOut
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | |
| `filename` | string | |
| `status` | string | `pending`/`processing`/`ready`/`error` |
| `category` | string? | |
| `description` | string? | |
| `language` | string | por defecto `es` |
| `tags` | string[] | |
| `version` | int | |
| `page_count` | int? | |
| `chunk_count` | int | |
| `file_size_bytes` | int? | |
| `file_hash` | string? | |
| `uploaded_by` | string? | |
| `uploaded_at` / `created_at` / `updated_at` | datetime? | |

### IngestionJobOut
| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | |
| `doc_id` | string | |
| `celery_task_id` | string? | |
| `status` | string | |
| `error_message` | string? | |
| `steps_log` | object[] | registro paso a paso con duración |
| `chunk_count` | int? | |
| `embedding_model` / `embedding_dim` | string? / int? | |
| `started_at` / `finished_at` / `created_at` | datetime? | |

### OverviewStats
`documents_total`, `documents_ready`, `documents_processing`, `documents_error`,
`chunks_total`, `sessions_today`, `queries_today`, `avg_latency_ms`,
`activity_7d` (DayActivity[]), `recent_documents` (RecentDoc[]).

### AnalyticsStats
`range`, `total_queries`, `queries_delta_pct`, `avg_latency_ms`, `latency_delta_pct`,
`ingest_success_rate`, `ingest_breakdown` (object), `series` (SeriesPoint[]),
`top_documents` (TopDoc[]), `category_distribution` (CategorySlice[]).

### LogList
`entries`: lista de `{ ts, level ("info"|"warn"|"error"), text }`.

### ConversationSummary
`id`, `session_token?`, `last_query?`, `message_count`, `created_at?`, `last_active_at?`,
`has_dislike`.

### ConversationDetail
`id`, `session_token?`, `message_count`, `created_at?`, `last_active_at?`,
`messages` (ConversationMessage[]: `id`, `role`, `content`, `created_at?`, `latency_ms?`,
`rating?`, `sources` (MessageSource[])).

### EvaluationRequest
| Campo | Tipo | Notas |
|---|---|---|
| `doc_ids` | string[]? | `null` = todos los `ready` |
| `n_samples` | int | 1–15, por defecto 5 |

### HealthResponse
`fastapi`, `supabase`, `ollama`, `embeddings`, cada uno `{ status, detail }`.

---

## Anexo — Tabla resumen de endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/v1/health` | Público | Estado de los servicios |
| POST | `/api/v1/chat` | Público | Consulta RAG |
| PATCH | `/api/v1/chat/{message_id}/feedback` | Público | Valorar respuesta |
| GET | `/api/v1/chat/admin/feedback` | 🔒 Admin | Estadísticas de feedback |
| POST | `/api/v1/admin/documents/upload` | 🔒 Admin | Subir PDF |
| POST | `/api/v1/admin/documents/{doc_id}/reindex` | 🔒 Admin | Reindexar documento |
| DELETE | `/api/v1/admin/documents/{doc_id}` | 🔒 Admin | Eliminar documento |
| GET | `/api/v1/admin/documents` | 🔒 Admin | Listar documentos |
| GET | `/api/v1/admin/documents/{doc_id}` | 🔒 Admin | Obtener documento |
| GET | `/api/v1/admin/documents/{doc_id}/jobs` | 🔒 Admin | Historial de ingestas |
| GET | `/api/v1/admin/stats` | 🔒 Admin | Métricas de Overview |
| GET | `/api/v1/admin/stats/analytics` | 🔒 Admin | Métricas de Analítica |
| GET | `/api/v1/admin/stats/logs` | 🔒 Admin | Bitácora del sistema |
| GET | `/api/v1/admin/conversations` | 🔒 Admin | Listar conversaciones |
| GET | `/api/v1/admin/conversations/{session_id}` | 🔒 Admin | Detalle de conversación |
| POST | `/api/v1/admin/evaluation` | 🔒 Admin | Lanzar evaluación RAGAS |
| GET | `/api/v1/admin/evaluation` | 🔒 Admin | Listar evaluaciones |
| GET | `/api/v1/admin/evaluation/{task_id}` | 🔒 Admin | Estado/resultados |
| GET | `/api/v1/admin/evaluation/{task_id}/report` | 🔒 Admin | Descargar reporte PDF |
| WS | `/api/v1/ws/ingestion/{task_id}` | Público | Progreso de ingesta |
| WS | `/api/v1/ws/evaluation/{task_id}` | Público | Progreso de evaluación |

---

_Universidad Tecnológica Indoamérica · Ecuador · Asistente Académico UTI · API v1.0.0_
