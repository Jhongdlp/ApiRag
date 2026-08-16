# Manual de Uso — Asistente Académico UTI

**Sistema:** Chatbot académico RAG de la Universidad Tecnológica Indoamérica (UTI)
**Versión:** 1.0 (Beta)
**Última actualización:** Julio 2026

---

## Índice

- [1. Introducción](#1-introducción)
  - [1.1 ¿Qué es el Asistente Académico?](#11-qué-es-el-asistente-académico)
  - [1.2 ¿A quién está dirigido este manual?](#12-a-quién-está-dirigido-este-manual)
  - [1.3 Requisitos para usarlo](#13-requisitos-para-usarlo)
- [Parte A — Manual del Estudiante (Chat)](#parte-a--manual-del-estudiante-chat)
  - [A.1 Acceder al chat](#a1-acceder-al-chat)
  - [A.2 La pantalla de bienvenida](#a2-la-pantalla-de-bienvenida)
  - [A.3 Hacer una consulta](#a3-hacer-una-consulta)
  - [A.4 Entender la respuesta](#a4-entender-la-respuesta)
  - [A.5 Fuentes citadas](#a5-fuentes-citadas)
  - [A.6 Acciones sobre una respuesta](#a6-acciones-sobre-una-respuesta)
  - [A.7 Preguntas de seguimiento](#a7-preguntas-de-seguimiento)
  - [A.8 Iniciar una nueva conversación](#a8-iniciar-una-nueva-conversación)
  - [A.9 Cómo preguntar bien (buenas prácticas)](#a9-cómo-preguntar-bien-buenas-prácticas)
  - [A.10 Qué puede y qué NO puede responder](#a10-qué-puede-y-qué-no-puede-responder)
- [Parte B — Manual del Administrador (Panel)](#parte-b--manual-del-administrador-panel)
  - [B.1 Iniciar sesión](#b1-iniciar-sesión)
  - [B.2 Recorrido por el panel](#b2-recorrido-por-el-panel)
  - [B.3 Overview (Inicio)](#b3-overview-inicio)
  - [B.4 Documentos](#b4-documentos)
  - [B.5 Conversaciones](#b5-conversaciones)
  - [B.6 Analítica](#b6-analítica)
  - [B.7 Evaluación RAGAS](#b7-evaluación-ragas)
  - [B.8 Estado del Sistema](#b8-estado-del-sistema)
  - [B.9 Configuración](#b9-configuración)
  - [B.10 Cerrar sesión](#b10-cerrar-sesión)
- [Apéndice — Solución de problemas frecuentes](#apéndice--solución-de-problemas-frecuentes)
- [Glosario rápido](#glosario-rápido)

---

## 1. Introducción

### 1.1 ¿Qué es el Asistente Académico?

El **Asistente Académico UTI** es un chatbot que responde preguntas de estudiantes a partir
de los **documentos oficiales de la universidad** (reglamentos, manuales, normativas,
calendarios, información de becas, etc.).

A diferencia de un buscador tradicional o de un chatbot genérico, el asistente:

- **Solo responde con base en documentos institucionales cargados** por la administración
  de la UTI. No inventa información ni usa conocimiento externo de internet.
- **Cita siempre sus fuentes**: junto a cada respuesta indica de qué documento y de qué
  página proviene la información, para que puedas verificarla.
- **Responde en español** y en lenguaje natural: puedes preguntar como le preguntarías a
  una persona.

Internamente utiliza tecnología **RAG** (*Retrieval-Augmented Generation* / Generación
Aumentada por Recuperación): primero busca los fragmentos más relevantes en los documentos
y luego redacta una respuesta basada exclusivamente en ellos.

### 1.2 ¿A quién está dirigido este manual?

Este manual tiene **dos partes independientes**. Lee la que te corresponda:

| Si eres… | Lee la… | Necesitas login |
|---|---|---|
| **Estudiante** que quiere consultar información | **Parte A** | No |
| **Administrador** que gestiona los documentos y supervisa el sistema | **Parte B** | Sí |

### 1.3 Requisitos para usarlo

- Un **navegador web** moderno (Chrome, Firefox, Edge o Safari actualizados).
- **Conexión a internet.**
- Para el panel administrativo (Parte B): una **cuenta de administrador** provista por la
  institución.

No es necesario instalar ninguna aplicación.

---

# Parte A — Manual del Estudiante (Chat)

Esta parte explica cómo usar el chat público. **No requiere iniciar sesión.**

### A.1 Acceder al chat

1. Abre tu navegador.
2. Ingresa la dirección web del asistente proporcionada por la universidad
   (por ejemplo `https://asistente.uti.edu.ec`).
3. Se abrirá directamente la pantalla del chat. **No necesitas usuario ni contraseña.**

En la parte superior verás el título **"Asistente Académico"** y un indicador verde
**"En línea · responde en segundos"** que confirma que el sistema está operativo.

### A.2 La pantalla de bienvenida

La primera vez (o al iniciar una conversación nueva) verás un saludo:

> **Hola, bienvenido.**
> **¿Qué quieres saber hoy?**

Debajo aparecen **4 preguntas sugeridas** que puedes usar como ejemplo o punto de partida.
Cada una tiene una etiqueta de tema:

| Etiqueta | Ejemplo de pregunta |
|---|---|
| **Régimen** | ¿Cuántos créditos necesito para titularme en Ingeniería en Sistemas? |
| **Prácticas** | ¿Cuántas horas de prácticas pre-profesionales debo cumplir? |
| **Becas** | ¿Qué requisitos pide la beca por excelencia académica? |
| **Calendario** | ¿Cuándo abren las inscripciones para el periodo 2026-B? |

> **Consejo:** haz clic en cualquiera de estas tarjetas para enviar esa pregunta al
> instante, sin necesidad de escribirla.

### A.3 Hacer una consulta

1. Escribe tu pregunta en el campo de texto de la parte inferior ("Escribe tu pregunta…").
2. Envíala presionando **Enter** o el botón de enviar (la flecha).
3. Mientras el asistente prepara la respuesta verás una **animación de puntos** (indicador
   de que está "escribiendo").

Tu pregunta aparece a la derecha en un globo de color; la respuesta del asistente aparece
a la izquierda con el ícono de la aplicación.

### A.4 Entender la respuesta

La respuesta del asistente puede incluir:

- **Texto en negrita** para resaltar datos clave (fechas, cantidades, requisitos).
- **Superíndices numéricos** (por ejemplo, un pequeño **¹** o **²**) que indican de qué
  fuente proviene esa afirmación.
- Debajo de la respuesta, información técnica opcional: la **hora** y el **tiempo de
  respuesta** en milisegundos (ej. `· 840ms`).

Cada número en superíndice corresponde a una fuente listada en el bloque de fuentes
(ver siguiente sección).

### A.5 Fuentes citadas

Cuando la respuesta se basa en documentos, aparece un botón como:

> 📖 **2 fuentes citadas** ⌄

Al hacer clic en él se **despliega la lista de documentos** usados. Para cada fuente verás:

| Elemento | Qué significa |
|---|---|
| **Número (1, 2, …)** | Corresponde al superíndice en el texto de la respuesta |
| **Nombre del documento** | El PDF institucional de donde salió la información |
| **p. N** | La página del documento donde se encuentra |
| **Porcentaje (%)** | Qué tan relevante es esa fuente para tu pregunta |

El color del porcentaje te orienta sobre la confianza:

- 🟢 **Verde (> 85 %):** coincidencia muy alta.
- 🟠 **Naranja (> 75 %):** coincidencia buena.
- ⚪ **Gris (≤ 75 %):** coincidencia moderada.

> **Importante:** siempre que necesites certeza total (trámites, plazos, requisitos de
> titulación), **verifica la información en el documento citado**. El asistente te dice
> exactamente en qué página buscar.

### A.6 Acciones sobre una respuesta

Debajo de cada respuesta hay una pequeña barra de botones:

| Botón | Acción |
|---|---|
| 📋 **Copiar** | Copia el texto de la respuesta al portapapeles. Aparece "Copiado ✓". |
| 👍 **Útil** | Marca la respuesta como útil. Ayuda a mejorar el sistema. |
| 👎 **No útil** | Marca la respuesta como no útil (por ejemplo, si es incorrecta o incompleta). |
| 🔄 **Regenerar** | Vuelve a generar la respuesta a la misma pregunta, por si quieres otra redacción. |

Sobre la valoración:

- Puedes cambiar de opinión: al volver a pulsar el mismo botón, la valoración se **elimina**
  ("Valoración eliminada").
- Tu valoración es **anónima** y sirve para que la administración detecte respuestas que
  conviene mejorar.

### A.7 Preguntas de seguimiento

Después de una respuesta, el asistente puede ofrecerte **sugerencias de seguimiento** en
forma de botones, por ejemplo:

> ¿Y para Ingeniería Industrial? · ¿Puedo convalidar materias? · ¿Dónde descargo el formato?

Haz clic en cualquiera para continuar la conversación sin escribir. También puedes, por
supuesto, escribir tu propia pregunta de seguimiento.

### A.8 Iniciar una nueva conversación

Para empezar de cero (por ejemplo, para cambiar completamente de tema), pulsa el botón
**"➕ Nueva conversación"** en la esquina superior derecha. Esto limpia la pantalla y te
devuelve a la bienvenida.

### A.9 Cómo preguntar bien (buenas prácticas)

Para obtener las mejores respuestas:

✅ **Sé específico.**
   - En lugar de "becas", pregunta *"¿Qué requisitos pide la beca por excelencia académica?"*.

✅ **Menciona tu carrera o el periodo** cuando aplique.
   - *"¿Cuántos créditos necesito para titularme en Ingeniería en Sistemas?"*

✅ **Una pregunta a la vez.** Si tienes varias dudas, pregúntalas por separado; obtendrás
   respuestas más precisas y con mejores fuentes.

✅ **Reformula si no te convence.** Si la respuesta no es clara, usa 🔄 **Regenerar** o
   escribe la pregunta de otra manera.

❌ **Evita preguntas fuera del ámbito institucional** (noticias, cálculos, opiniones): el
   asistente solo conoce los documentos oficiales de la UTI.

### A.10 Qué puede y qué NO puede responder

**Sí puede:**
- Requisitos de titulación, créditos, mallas y régimen académico.
- Prácticas pre-profesionales.
- Becas y ayudas económicas.
- Calendario académico, inscripciones y matrículas.
- Reglamentos, normativas y manuales institucionales cargados en el sistema.

**No puede:**
- Responder sobre temas **no incluidos** en los documentos cargados.
- Consultar tu **expediente personal**, notas o estado de matrícula (no accede a datos
  individuales).
- Dar información de **internet** o noticias externas.
- Realizar **trámites** por ti (solo informa; los trámites se hacen por los canales
  oficiales).

Si el asistente no tiene la información, te lo indicará en lugar de inventar una respuesta.

---

# Parte B — Manual del Administrador (Panel)

Esta parte está dirigida al personal autorizado que gestiona el contenido y supervisa el
sistema. **Requiere una cuenta de administrador.**

### B.1 Iniciar sesión

1. Accede a la ruta del panel: `…/login` (o `…/dashboard`, que te redirige al login si no
   has iniciado sesión).
2. Ingresa tu **correo institucional** y tu **contraseña**.
3. Pulsa **Ingresar**.

Si las credenciales son correctas, entrarás al panel (`/dashboard`). Si no, verás el mensaje
*"Credenciales incorrectas. Verifica tu correo y contraseña."*

> **Nota de seguridad:** solo las cuentas con rol de **administrador** pueden acceder. La
> autenticación se realiza mediante Supabase; las sesiones son personales y no deben
> compartirse.

### B.2 Recorrido por el panel

El panel tiene una **barra lateral izquierda** con dos grupos de secciones:

**Navegación**
| Sección | Para qué sirve |
|---|---|
| 🟦 **Overview** | Resumen general de actividad e ingestas recientes |
| 📄 **Documentos** | Subir, listar, buscar y eliminar los PDFs de la base de conocimiento |
| 💬 **Conversaciones** | Revisar las conversaciones que los estudiantes han tenido con el chat |
| 📊 **Analítica** | Métricas de uso, feedback y documentos más consultados |
| 🧪 **Evaluación RAGAS** | Medir automáticamente la calidad de las respuestas |

**Sistema**
| Sección | Para qué sirve |
|---|---|
| 📡 **Estado del Sistema** | Salud de los servicios, uso de VRAM y bitácora |
| ⚙️ **Configuración** | Preferencias del panel |

En la parte inferior de la barra lateral aparece tu **nombre y correo**, y el botón
**"Cerrar sesión"**. En pantallas pequeñas la barra se abre como un menú deslizante.

### B.3 Overview (Inicio)

Es la pantalla de entrada. Ofrece un vistazo rápido del estado del sistema:

- **Actividad** reciente del asistente.
- **Últimas ingestas**: los documentos procesados más recientemente y su resultado.

Úsala como tablero de control diario para confirmar que todo funciona.

### B.4 Documentos

Es la sección **más importante para el administrador**: aquí se gestiona la base de
conocimiento que alimenta al chatbot.

#### B.4.1 Subir un documento

1. En la zona **"Subir documento"**, **arrastra un archivo PDF** al recuadro punteado, o
   **haz clic** para seleccionarlo desde tu equipo.
2. Restricciones:
   - **Solo se aceptan archivos PDF.**
   - **Tamaño máximo: 50 MB.**
   - Si el archivo no cumple, verás un mensaje de error (ej. *"Solo se permiten archivos
     PDF."* o *"El archivo supera el límite de 50 MB."*).
3. Una vez seleccionado, verás el nombre y tamaño del archivo con las opciones **Cancelar**
   o **Subir**.
4. Pulsa **Subir** para iniciar la ingesta.

> **Anti-duplicados:** si subes un PDF **idéntico** a uno ya procesado, el sistema lo detecta
> (por su huella `file_hash`) y **no lo vuelve a procesar**. Para reemplazar contenido, sube
> una versión distinta del documento.

#### B.4.2 Seguir la ingesta en vivo

Al subir un documento aparece el panel **"Ingesta en curso"**, que muestra el progreso en
tiempo real a través de **5 pasos**:

| Paso | Nombre | Qué ocurre |
|---|---|---|
| 01 | **Cargando** | El PDF se recibe y prepara |
| 02 | **Extrayendo** | Se extrae y estructura el texto (Docling) |
| 03 | **Fragmentando** | El texto se divide en fragmentos ("chunks") |
| 04 | **Embeddings** | Cada fragmento se convierte en un vector numérico |
| 05 | **Indexando** | Los vectores se guardan en la base de datos |

- Cada paso se marca en **azul** mientras está activo y en **verde** al completarse.
- Una **barra de progreso** y una **línea de bitácora** (`→ …`) muestran el detalle.
- Al terminar verás la notificación **"Ingesta completada"** y el documento aparecerá en la
  tabla con estado **Listo**.
- Si algo falla, verás **"Error de ingesta"** con el motivo, y el documento quedará en
  estado **Error** (nunca se queda "Procesando" de forma indefinida).

> El progreso puede tardar desde segundos hasta algunos minutos según el tamaño del PDF.
> Puedes seguir usando el panel mientras tanto.

#### B.4.3 La tabla de documentos indexados

Lista todos los documentos con estas columnas:

| Columna | Descripción |
|---|---|
| **#** | Número de fila |
| **Documento** | Nombre del PDF y su identificador |
| **Categoría** | Reglamentos, Manuales, Normativas u Otros |
| **Estado** | **Listo**, **Procesando** o **Error** |
| **Páginas** | Número de páginas del PDF |
| **Chunks** | Número de fragmentos vectorizados generados |
| **Fecha** | Fecha de subida |
| _(acciones)_ | 👁️ Ver detalle · 🗑️ Eliminar |

Herramientas encima de la tabla:
- **Buscar…**: filtra por nombre de archivo.
- **Filtro por estado**: Todos / Listo / Procesando / Error.
- **↻ Recargar**: vuelve a consultar la lista.

#### B.4.4 Ver el detalle de un documento

Haz clic en una fila (o en el ícono 👁️) para abrir el **panel de detalle** a la derecha, con:

- **Páginas**, **Chunks** y **Estado** destacados.
- Metadatos: **Categoría**, **Modelo de embeddings** (`bge-m3-1024d`), **Hash** del archivo
  y fecha/hora de subida.
- Botón **Reindexar** para volver a procesar el documento si fuera necesario.

#### B.4.5 Eliminar un documento

1. Pulsa el ícono 🗑️ en la fila del documento.
2. Aparecerá una confirmación indicando que **se borrarán todos los chunks vectorizados
   asociados** y que **la acción es irreversible**.
3. Confirma para eliminar.

> ⚠️ **Precaución:** al eliminar un documento, el chatbot **dejará de poder responder** con
> información de ese PDF. Asegúrate antes de confirmar.

### B.5 Conversaciones

Sección de **monitoreo** de las interacciones de los estudiantes con el chat.

- Lista las **sesiones de conversación** registradas.
- Puedes **buscar una sesión** ("Buscar sesión…").
- Al abrir una conversación verás el intercambio completo entre **Usuario** y **Asistente**.

Sirve para entender qué preguntan los estudiantes, detectar dudas frecuentes y localizar
respuestas que convenga mejorar (por ejemplo, cuando falta un documento en la base).

### B.6 Analítica

Panel de **indicadores de uso y calidad**. Incluye, entre otros:

- **Total de consultas** realizadas.
- **Tiempo medio de respuesta.**
- **Tasa de éxito de ingesta** (qué proporción de documentos se procesó sin errores).
- **Actividad del sistema** a lo largo del tiempo.
- **Documentos más consultados.**
- **Distribución por categoría** de documentos.
- **Feedback de respuestas** (proporción de valoraciones 👍 / 👎 de los estudiantes).

Úsalo para tomar decisiones: qué documentos añadir, qué temas generan más consultas y si la
calidad percibida es buena.

### B.7 Evaluación RAGAS

Herramienta para **medir automáticamente la calidad** de las respuestas del sistema usando
el framework **RAGAS**. Es especialmente útil para la validación de la tesis.

#### B.7.1 Configurar una evaluación

1. Elige el alcance en **"Documentos a evaluar"**: todos, o **selecciona documentos
   específicos**.
2. Define **"Preguntas por documento"**: cuántas preguntas de prueba se generarán
   automáticamente por cada documento.
3. Inicia la evaluación.

#### B.7.2 Seguir el progreso y ver resultados

- Un panel de **Progreso** muestra el avance; si falla, puedes **Reintentar**.
- Al finalizar, la sección **Resultados** muestra:
  - **Score compuesto** (evaluación global).
  - Métricas por pregunta: **Faithfulness** (fidelidad a las fuentes), **Precision**
    (precisión del contexto) y **Recall** (cobertura del contexto).
- Puedes lanzar una **Nueva evaluación** o consultar el **Historial** de evaluaciones
  anteriores.

#### B.7.3 Descargar el reporte

En la sección **Reporte** puedes **Descargar el PDF** con el "Reporte de Evaluación RAGAS",
ideal para adjuntar como evidencia en la tesis o en informes.

> **¿Qué significan las métricas?**
> - **Faithfulness (fidelidad):** cuánto se apega la respuesta a las fuentes recuperadas
>   (evita "alucinaciones").
> - **Precision (precisión del contexto):** qué proporción del contexto recuperado era
>   realmente relevante.
> - **Recall (cobertura del contexto):** si se recuperó toda la información necesaria.
> En todas, **más alto es mejor**.

### B.8 Estado del Sistema

Muestra la **salud de la infraestructura** en tiempo real:

- Estado de los servicios (**FastAPI**, **Supabase**, **Ollama/LLM**, **embeddings**):
  *funcionando* o *con error*.
- **VRAM en uso** de la GPU (el modelo de lenguaje ocupa buena parte de la memoria de video).
- **Bitácora del sistema**: registro de eventos recientes.

Consulta esta sección si notas lentitud o errores en el chat, para identificar qué servicio
puede estar fallando.

### B.9 Configuración

Sección de **preferencias del panel administrativo**. Ajustes generales de la interfaz.

### B.10 Cerrar sesión

Pulsa **"Cerrar sesión"** en la parte inferior de la barra lateral. Por seguridad, cierra
siempre tu sesión al terminar, especialmente en equipos compartidos.

---

## Apéndice — Solución de problemas frecuentes

| Síntoma | Posible causa | Qué hacer |
|---|---|---|
| El chat no responde o marca error | El servicio LLM (Ollama) o la base de datos está caído | (Admin) Revisa **Estado del Sistema**; reinicia los servicios si es necesario |
| "El archivo supera el límite de 50 MB" | El PDF es demasiado grande | Divide el PDF o comprímelo antes de subirlo |
| "Solo se permiten archivos PDF" | El archivo no es PDF | Convierte el documento a PDF antes de subir |
| Subí un PDF y no aparece como nuevo | Ya existía un PDF idéntico (mismo contenido) | Es el anti-duplicados; sube una versión distinta si querías reemplazarlo |
| El documento quedó en estado **Error** | Falló algún paso de la ingesta | Abre el detalle, revisa el motivo y usa **Reindexar**; verifica que el PDF tenga texto (no solo imágenes escaneadas) |
| La respuesta no cita fuentes o dice que no sabe | No hay documentos cargados sobre ese tema | (Admin) Sube el documento institucional correspondiente |
| No puedo iniciar sesión en el panel | Credenciales incorrectas o la cuenta no es administrador | Verifica correo/contraseña; solicita acceso de administrador |

---

## Glosario rápido

| Término | Significado |
|---|---|
| **RAG** | *Retrieval-Augmented Generation*. Técnica que busca información en documentos y genera la respuesta a partir de ella. |
| **Chunk (fragmento)** | Porción de un documento en la que se divide el texto para poder buscarla con precisión. |
| **Embedding** | Representación numérica (vector) de un fragmento de texto que permite buscar por significado, no solo por palabras. |
| **Ingesta** | Proceso de cargar y procesar un PDF hasta dejarlo listo para consultas. |
| **Fuente citada** | Documento y página de donde el asistente tomó la información de una respuesta. |
| **RAGAS** | Framework para evaluar automáticamente la calidad de un sistema RAG. |
| **VRAM** | Memoria de la tarjeta gráfica (GPU) donde se ejecuta el modelo de lenguaje. |
| **LLM** | *Large Language Model* (modelo de lenguaje) que redacta las respuestas. |

---

_Universidad Tecnológica Indoamérica · Ecuador · Asistente Académico UTI v1.0 (Beta)_
