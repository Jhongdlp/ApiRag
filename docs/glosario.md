# Glosario — Asistente Académico UTI

**Sistema:** Chatbot académico RAG de la Universidad Tecnológica Indoamérica (UTI)
**Última actualización:** Julio 2026

Definiciones de los términos técnicos que aparecen en la documentación, el panel
administrativo y el sistema. Ordenado alfabéticamente. Cada término indica su nivel:
🟢 *general* (para cualquier usuario) o 🔧 *técnico* (para administradores/desarrolladores).

---

## A

**Anti-duplicados (deduplicación)** 🟢
Mecanismo que evita procesar dos veces el mismo documento. El sistema calcula una huella
(`file_hash`) de cada PDF; si ya existe una idéntica, no lo reprocesa. También hay dedup a
nivel de fragmento (`content_hash`) para que reindexar sea idempotente. Ver [`file_hash`](#f),
[`content_hash`](#c).

**Analítica** 🟢
Sección del panel administrativo con métricas de uso: total de consultas, tiempo medio de
respuesta, tasa de éxito de ingesta, documentos más consultados y feedback de los estudiantes.

## B

**bge-m3 (`BAAI/bge-m3`)** 🔧
Modelo de *embeddings* multilingüe (excelente para español) que convierte cada fragmento de
texto en un vector de **1024 dimensiones**. Es lo que permite buscar por significado. Ver
[Embedding](#e).

**BM25** 🔧
Algoritmo clásico de recuperación de información basado en frecuencia de palabras. En este
proyecto, la búsqueda por palabras se implementa con **FTS nativo de PostgreSQL** en español,
que cumple ese rol dentro de la búsqueda híbrida. Ver [Búsqueda híbrida](#b), [FTS](#f).

**Búsqueda híbrida** 🔧
Estrategia de recuperación que combina **búsqueda vectorial** (por significado) y **búsqueda
de texto completo** (por palabras), fusionando ambos rankings con **RRF**. Ocurre en una sola
consulta RPC en PostgreSQL. Ver [RRF](#r), [pgvector](#p).

## C

**Categoría** 🟢
Clasificación de un documento en el panel: *Reglamentos*, *Manuales*, *Normativas* u *Otros*.
Facilita organizar y filtrar la base de conocimiento.

**Celery** 🔧
Sistema de tareas en segundo plano. Ejecuta la **ingesta** de documentos (que es lenta) sin
bloquear la API. Usa Redis como intermediario (*broker*). Ver [Ingesta](#i), [Redis](#r).

**Chunk (fragmento)** 🟢
Porción en la que se divide el texto de un documento para poder buscarla con precisión. Cada
respuesta del asistente se basa en los chunks más relevantes recuperados.

**`content_hash`** 🔧
Huella única de un fragmento (`chunk`). Permite que reindexar un documento sea *idempotente*:
no duplica fragmentos que no cambiaron.

## D

**Docling** 🔧
Biblioteca que extrae y **estructura** el texto de un PDF (encabezados, tablas, jerarquía),
produciendo Markdown limpio antes de fragmentarlo. Es el paso "Extrayendo" de la ingesta.

**Dashboard (panel administrativo)** 🟢
Interfaz web (`/dashboard`) donde el administrador gestiona documentos, monitorea
conversaciones, ve analítica, ejecuta evaluaciones y revisa el estado del sistema. Requiere
login.

## E

**Embedding** 🟢/🔧
Representación numérica (un **vector**) de un fragmento de texto que captura su significado.
Textos con significado parecido tienen vectores cercanos, lo que permite la búsqueda
semántica. Aquí tienen 1024 dimensiones y los genera [bge-m3](#b).

**Evaluación RAGAS** 🔧
Proceso automático que mide la calidad de las respuestas del sistema. Ver [RAGAS](#r),
[Faithfulness](#f), [Precision](#p), [Recall](#r).

## F

**Faithfulness (fidelidad)** 🔧
Métrica de RAGAS: cuánto se apega la respuesta a las fuentes recuperadas. Un valor alto indica
que el modelo **no inventa** información (evita "alucinaciones"). Más alto es mejor.

**FastAPI** 🔧
Framework de Python con el que está construida la API REST y los WebSockets del backend.

**`file_hash`** 🔧
Huella SHA-256 de un PDF completo. Se usa para el [anti-duplicados](#a): garantiza que un
mismo documento no se procese dos veces.

**FTS (Full-Text Search)** 🔧
Búsqueda de texto completo nativa de PostgreSQL. En este proyecto usa un diccionario en
español con normalización de acentos (`spanish_unaccent`) y aporta la parte "por palabras" de
la [búsqueda híbrida](#b).

**Fuente citada** 🟢
Documento y página de donde el asistente tomó la información de una respuesta. Se muestran bajo
cada respuesta con su nombre, número de página y porcentaje de relevancia, para que el usuario
pueda verificar.

## G

**GPU / VRAM** 🔧
La **GPU** (tarjeta gráfica NVIDIA, aquí una Tesla V100) acelera el modelo de lenguaje y los
embeddings. La **VRAM** es su memoria; el modelo `qwen2.5:14b` ocupa ~9 GB. El panel muestra la
VRAM en uso en *Estado del Sistema*.

## H

**HNSW** 🔧
Tipo de índice (*Hierarchical Navigable Small World*) que hace muy rápida la búsqueda de
vectores similares en pgvector, incluso con muchos documentos.

## I

**Ingesta** 🟢
Proceso completo de cargar un PDF y prepararlo para consultas. Consta de 5 pasos: **Cargando →
Extrayendo → Fragmentando → Embeddings → Indexando**. Su progreso se ve en vivo en el panel.

**`ingestion_jobs`** 🔧
Tabla que registra cada intento de ingesta, con su bitácora paso a paso (`steps_log`), estado
y errores. Útil para depurar fallos.

## J

**JWT (JSON Web Token)** 🔧
Credencial firmada que prueba la identidad y el rol de un usuario. Los endpoints de
administración exigen un JWT de Supabase con `role=admin` en la cabecera
`Authorization: Bearer <token>`.

## L

**Latencia (`latency_ms`)** 🟢
Tiempo que tarda el sistema en responder una consulta, en milisegundos. Se muestra bajo cada
respuesta del chat.

**LLM (Large Language Model)** 🟢
Modelo de lenguaje que **redacta** las respuestas a partir del contexto recuperado. Aquí es
**Qwen2.5:14b**, ejecutado localmente con Ollama. Ver [Qwen2.5:14b](#q), [Ollama](#o).

## N

**Nginx** 🔧
Servidor que actúa como **proxy inverso**: recibe el tráfico HTTPS, aplica TLS y *rate
limiting* (60 req/min), y lo dirige al backend.

## O

**Ollama** 🔧
Servidor que ejecuta el modelo de lenguaje localmente en la GPU y lo expone al backend. Evita
depender de APIs de pago y mantiene los datos en el servidor propio.

## P

**pgvector** 🔧
Extensión de PostgreSQL/Supabase que permite almacenar y buscar **vectores** (embeddings). Es
el corazón de la búsqueda semántica.

**Precision (precisión del contexto)** 🔧
Métrica de RAGAS: qué proporción del contexto recuperado era realmente relevante para la
pregunta. Más alto es mejor.

## Q

**Qwen2.5:14b** 🔧
El modelo de lenguaje (LLM) usado por defecto: ~14 000 millones de parámetros, cuantizado
(Q4_K_M, ~9 GB). Genera las respuestas en español. Se puede cambiar con `OLLAMA_MODEL`.

## R

**RAG (Retrieval-Augmented Generation)** 🟢
"Generación Aumentada por Recuperación". Técnica central del sistema: primero **busca**
información relevante en los documentos y luego **genera** la respuesta basándose solo en ella.
Aporta precisión y trazabilidad frente a un chatbot genérico.

**RAGAS** 🔧
Framework para **evaluar automáticamente** sistemas RAG. Genera preguntas de prueba a partir
de los documentos y calcula métricas de calidad ([Faithfulness](#f), [Precision](#p),
[Recall](#r)). El sistema puede producir un reporte PDF.

**Recall (cobertura del contexto)** 🔧
Métrica de RAGAS: si se recuperó **toda** la información necesaria para responder. Más alto es
mejor.

**Redis** 🔧
Almacén en memoria que cumple dos papeles: intermediario (*broker*) de las tareas de Celery y
canal *pub/sub* que transmite el progreso de la ingesta al panel vía WebSocket.

**Reindexar** 🟢
Volver a procesar un documento ya cargado (por ejemplo, tras cambiar los parámetros de
fragmentación o el modelo de embeddings), sin tener que subir el PDF de nuevo.

**RLS (Row-Level Security)** 🔧
Seguridad a nivel de fila en la base de datos: reglas que controlan qué puede leer o escribir
cada usuario. Las escrituras están restringidas a administradores mediante la función
`is_admin()`.

**RRF (Reciprocal Rank Fusion)** 🔧
Método que **fusiona** los resultados de la búsqueda vectorial y la de texto en un único
ranking, combinando lo mejor de ambas. Se calcula directamente en PostgreSQL.

## S

**Sesión de conversación** 🟢
Hilo de mensajes entre un estudiante y el asistente. Se identifica con un `session_token` y se
puede revisar (de forma anónima) en la sección **Conversaciones** del panel.

**Supabase** 🔧
Plataforma en la nube basada en PostgreSQL que aloja la base de datos (con pgvector), la
autenticación de administradores y las tablas de observabilidad.

## T

**`top_k`** 🔧
Número de fragmentos (chunks) más relevantes que se recuperan por cada consulta. Por defecto
**5** (configurable entre 1 y 20).

## V

**Vector** 🔧
Lista de números que representa el significado de un texto (ver [Embedding](#e)). La búsqueda
semántica compara la cercanía entre vectores.

## W

**WebSocket** 🔧
Conexión persistente que permite al panel recibir **actualizaciones en tiempo real** del
progreso de una ingesta o de una evaluación, sin recargar la página.

---

_Universidad Tecnológica Indoamérica · Ecuador · Asistente Académico UTI v1.0 (Beta)_
