# Solución de Problemas (FAQ) — Asistente Académico UTI

**Sistema:** Chatbot académico RAG de la Universidad Tecnológica Indoamérica (UTI)
**Última actualización:** Julio 2026

Guía de resolución de problemas y preguntas frecuentes. Está organizada por perfil: primero
las dudas del **estudiante**, luego las del **administrador**, y al final las **técnicas**
(despliegue e infraestructura).

> Si buscas cómo usar una función, ve al [Manual de uso](manual-de-uso.md). Si buscas cómo
> instalar, ve al [Manual de instalación](manual-instalacion-despliegue.md).

---

## Índice

- [1. Estudiantes (chat)](#1-estudiantes-chat)
- [2. Administradores (panel)](#2-administradores-panel)
- [3. Técnico (despliegue e infraestructura)](#3-técnico-despliegue-e-infraestructura)
- [4. Cómo pedir ayuda / reportar un problema](#4-cómo-pedir-ayuda--reportar-un-problema)

---

## 1. Estudiantes (chat)

### El asistente dice que no encontró información sobre mi pregunta
El asistente **solo responde con base en los documentos institucionales cargados**. Si
responde *"No encontré información relacionada…"*, puede ser porque:
- El documento sobre ese tema aún **no ha sido cargado** por la administración.
- Tu pregunta es **muy general o ambigua**. Prueba a reformularla siendo más específico
  (menciona tu carrera, el periodo o el trámite exacto).

**Qué hacer:** reformula la pregunta o, para temas urgentes, consulta con Secretaría
Académica.

### La respuesta parece incompleta o incorrecta
- Usa el botón 🔄 **Regenerar** para obtener otra redacción.
- **Verifica en la fuente citada**: abre el bloque "fuentes citadas" y revisa el documento y
  la página indicada. La información oficial siempre está en el documento.
- Marca la respuesta con 👎 **No útil**: eso ayuda a la administración a detectar y mejorar
  respuestas problemáticas.

### No aparecen fuentes citadas en una respuesta
Ocurre cuando la respuesta es un **saludo o mensaje de cortesía** (ej. "hola", "gracias"),
que no requiere buscar en documentos. Para preguntas reales sobre normativa, sí deberían
aparecer fuentes.

### El chat no responde o muestra un error
- Revisa tu **conexión a internet**.
- Verifica el indicador de estado arriba: debe decir **"En línea"**. Si dice lo contrario,
  el servicio puede estar temporalmente caído; intenta de nuevo en unos minutos.
- Si persiste, informa a la administración (ver [sección 4](#4-cómo-pedir-ayuda--reportar-un-problema)).

### ¿El asistente guarda mis conversaciones? ¿Es privado?
Las conversaciones se registran de forma **anónima** para mejorar el sistema; no se asocian a
tu identidad ni el asistente accede a tu expediente personal. Al pulsar **"Nueva
conversación"** empiezas un hilo limpio.

### ¿Puedo preguntar sobre mis notas, matrícula o trámites personales?
No. El asistente **no accede a datos individuales** (notas, estado de matrícula, deudas). Solo
informa sobre reglamentos, normativas y procesos generales. Los trámites se realizan por los
canales oficiales de la universidad.

---

## 2. Administradores (panel)

### No puedo iniciar sesión en el panel
- Verifica **correo y contraseña** (mensaje típico: *"Credenciales incorrectas…"*).
- Asegúrate de que tu cuenta tenga **rol de administrador**. Solo las cuentas con
  `role=admin` pueden entrar; si acabas de crear el usuario, revisa que se le haya asignado
  ese rol (ver [Manual de instalación §9](manual-instalacion-despliegue.md#9-crear-el-usuario-administrador)).
- Si el error es de conexión, puede que el backend o Supabase estén caídos: revisa **Estado
  del Sistema**.

### Subí un PDF pero no aparece como documento nuevo
Lo más probable es que sea el **anti-duplicados**: el sistema detecta PDFs idénticos por su
huella (`file_hash`) y **no los reprocesa**. Si querías reemplazar el contenido, sube una
**versión distinta** del archivo, o usa **Reindexar** sobre el documento existente si solo
cambiaron los parámetros de procesamiento.

### Mensaje "El archivo supera el límite de 50 MB"
El tamaño máximo por PDF es **50 MB**. Divide el documento en partes más pequeñas o
comprímelo (reduciendo la resolución de imágenes) antes de subirlo.

### Mensaje "Solo se permiten archivos PDF"
El sistema valida el **tipo real** del archivo, no solo su extensión. Asegúrate de subir un
PDF genuino (no un archivo renombrado a `.pdf`). Convierte el documento a PDF con una
herramienta confiable.

### La ingesta se queda en un paso o termina en "Error"
La ingesta tiene 5 pasos (Cargando → Extrayendo → Fragmentando → Embeddings → Indexando). Si
falla:
- **Falla en "Extrayendo":** el PDF probablemente es un **escaneo sin texto** (solo
  imágenes). Usa un PDF con **texto seleccionable**, o uno con OCR aplicado.
- **Falla en "Embeddings"/"Indexando":** puede ser un problema temporal de GPU o de conexión
  a Supabase. Revisa **Estado del Sistema** e intenta **Reindexar**.
- Para ver el detalle del fallo, consulta el **historial de ingestas** del documento
  (`GET /admin/documents/{doc_id}/jobs`), que incluye el registro paso a paso.

> El estado del documento siempre converge a **Listo** o **Error** — nunca queda "Procesando"
> de forma indefinida.

### Eliminé un documento por error
La eliminación es **irreversible**: se borran el documento y todos sus chunks vectorizados.
La única forma de recuperarlo es **volver a subir el PDF** original.

### Los estudiantes reportan malas respuestas sobre un tema
1. Revisa **Conversaciones** para ver qué se preguntó exactamente.
2. Revisa el **feedback** (👎) en Analítica para localizar respuestas valoradas negativamente.
3. Si falta información, **sube el documento** institucional correspondiente. Si el documento
   existe pero está desactualizado, sube la versión nueva.

### Las métricas o listas del panel aparecen vacías
- Puede que aún no haya datos (sistema recién desplegado).
- Si antes había datos, revisa la conexión con Supabase en **Estado del Sistema** y recarga.

---

## 3. Técnico (despliegue e infraestructura)

### `celery_worker` se reinicia continuamente
Casi siempre es un desajuste de credenciales de Redis: **`REDIS_URL` debe contener la misma
contraseña que `REDIS_PASSWORD`**, con el formato `redis://:PASSWORD@redis:6379/0`. Corrige
ambas variables en `.env` y reinicia:
```bash
docker compose up -d celery_worker fastapi
```

### El chat devuelve error 500 o se queda esperando
- Verifica que el **modelo LLM esté descargado**: `docker exec uti_ollama ollama list`. Si no
  aparece, ejecuta `bash scripts/pull_model.sh`.
- Revisa los logs: `docker compose logs -f fastapi` y `docker compose logs -f celery_worker`.
- Comprueba `GET /api/v1/health` para ver qué servicio está en `error`.

### Docker no ve la GPU / los contenedores no arrancan con GPU
- Verifica el driver del host: `nvidia-smi`.
- Reinstala/reconfigura **nvidia-container-toolkit**
  ([Manual de instalación §3.2](manual-instalacion-despliegue.md#32-soporte-de-gpu-nvidia-container-toolkit)).
- Prueba: `docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi`.

### Ollama se queda sin memoria de video (VRAM)
El modelo `qwen2.5:14b` usa ~9 GB de VRAM. Si otro proceso compite por la GPU (por ejemplo,
Docling durante la ingesta), Ollama puede quedarse sin memoria. Mantén el procesamiento de
documentos en CPU con `DOCLING_DEVICE=cpu` y verifica el uso con `nvidia-smi`.

### El frontend no puede comunicarse con el backend (errores de CORS)
El backend solo acepta orígenes declarados en **`ALLOWED_ORIGINS`**. Añade la URL exacta del
frontend (incluido `https://` y sin barra final), y reinicia:
```bash
docker compose up -d fastapi
```

### Error de conexión a Supabase en `/health`
Revisa `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y
`SUPABASE_JWT_SECRET` en `.env`. Confirma también que ejecutaste
[`scripts/init_supabase.sql`](../scripts/init_supabase.sql) en el proyecto correcto.

### La API responde 401/403 en endpoints admin
- **401:** el token Bearer falta, está mal formado o expiró. Vuelve a iniciar sesión para
  obtener uno nuevo.
- **403:** el token es válido pero el usuario **no tiene `role=admin`**. Asigna el rol (ver
  [Manual de instalación §9](manual-instalacion-despliegue.md#9-crear-el-usuario-administrador)).

### El certificado SSL dejó de funcionar
Los certificados Let's Encrypt caducan a los **90 días**. Renueva con `certbot renew` y
recarga Nginx (`docker compose up -d nginx`). Automatízalo con un cron.

### ¿Cómo cambio el modelo de lenguaje?
Edita `OLLAMA_MODEL` en `.env`, ejecuta `docker compose up -d` y descarga el nuevo modelo con
`bash scripts/pull_model.sh`.

### ¿Cómo hago copias de seguridad?
Los datos importantes (documentos, chunks, conversaciones) viven en **Supabase**: usa las
copias de seguridad de Supabase. Los volúmenes Docker (`ollama_data`, `redis_data`,
`uploads_data`) contienen datos regenerables o temporales; el modelo LLM se puede volver a
descargar.

---

## 4. Cómo pedir ayuda / reportar un problema

Antes de escalar un problema, reúne esta información — acelera el diagnóstico:

1. **Qué intentabas hacer** y **qué ocurrió** (mensaje de error exacto o captura).
2. **Perfil:** estudiante o administrador.
3. Para problemas técnicos, adjunta:
   - Salida de `docker compose ps`.
   - Logs relevantes: `docker compose logs --tail=100 fastapi` (o `celery_worker`).
   - Resultado de `curl http://localhost:8000/api/v1/health`.
4. **Cuándo empezó** y si algo cambió antes (nuevo despliegue, cambio en `.env`, etc.).

---

_Universidad Tecnológica Indoamérica · Ecuador · Asistente Académico UTI v1.0 (Beta)_
