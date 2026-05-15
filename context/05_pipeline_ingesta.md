# Pipeline de Ingesta de Documentos

## Descripción general

La ingesta es el proceso de transformar un documento PDF institucional en fragmentos (chunks) vectorizados almacenados en pgvector, listos para ser recuperados durante las consultas. Es un proceso asíncrono ejecutado por Celery para no bloquear la API.

## Diagrama del pipeline

```
                    ┌──────────────────────────────────────────────────────┐
                    │              CELERY WORKER (GPU disponible)           │
                    │                                                        │
PDF (binario)       │   ┌────────────┐    ┌─────────────┐                  │
────────────────►  ►│──►│PDFExtractor│───►│MarkdownConv.│                  │
(volumen Docker)    │   │ PyMuPDF    │    │  Docling     │                  │
                    │   └────────────┘    └──────┬───────┘                  │
  Progress 10%      │     texto plano     Progress 25%  Markdown estructurado│
                    │                            │                           │
                    │                    ┌───────▼────────┐                 │
                    │                    │DocumentChunker │  Progress 45%    │
                    │                    │LangChain MH-   │                  │
                    │                    │TextSplitter    │                  │
                    │                    └───────┬────────┘                 │
                    │                     List[Chunk]                        │
                    │                            │                           │
                    │                    ┌───────▼────────┐                 │
                    │                    │EmbeddingService│  Progress 65%    │
                    │                    │ BAAI/bge-m3    │  (GPU)           │
                    │                    │ batch_size=32  │                  │
                    │                    └───────┬────────┘                 │
                    │                List[Chunk+embedding[1024]]             │
                    │                            │                           │
                    │                    ┌───────▼────────┐                 │
                    │                    │SupabaseIndexer │  Progress 85%    │
                    │                    │ INSERT lotes   │                  │
                    │                    │ de 100 filas   │                  │
                    │                    └───────┬────────┘                 │
                    │                            │  Progress 100%            │
                    └────────────────────────────┼─────────────────────────┘
                                                 ▼
                                    pgvector (Supabase) — document_chunks
```

## Paso 1 — Extracción de texto (`PDFExtractor`)

**Clase:** `fastapi/services/ingestion/extractor.py:PDFExtractor`

**Biblioteca:** PyMuPDF (`fitz`)

**Proceso:**
- Abre el PDF con `fitz.open(file_path)`.
- Itera cada página y extrae texto con `page.get_text()`.
- Concatena páginas separadas por doble salto de línea.
- Retorna el texto plano completo del documento.

**Por qué PyMuPDF:** Es la biblioteca Python más rápida para extracción de texto PDF, con soporte para documentos escaneados (OCR opcional) y estructuras complejas.

## Paso 2 — Conversión a Markdown estructurado (`MarkdownConverter`)

**Clase:** `fastapi/services/ingestion/converter.py:MarkdownConverter`

**Biblioteca:** Docling (`docling.document_converter`)

**Proceso:**
- Usa `DocumentConverter` de Docling para analizar la estructura del PDF (detección de títulos, subtítulos, tablas, listas).
- Exporta el resultado como Markdown con `result.document.export_to_markdown()`.
- El Markdown preserva la jerarquía semántica del documento original con `#`, `##`, `###`.

**Por qué Docling:** Docling (IBM Research) es estado del arte en comprensión de documentos. A diferencia de la extracción plana de PyMuPDF, Docling detecta la estructura lógica del documento (reglamento → capítulos → artículos), lo que es crítico para el chunking semántico posterior.

## Paso 3 — División en chunks (`DocumentChunker`)

**Clase:** `fastapi/services/ingestion/chunker.py:DocumentChunker`

**Biblioteca:** LangChain `MarkdownHeaderTextSplitter`

**Configuración:**
```python
HEADERS_TO_SPLIT = [("#", "h1"), ("##", "h2"), ("###", "h3")]
CHUNK_SIZE_LIMIT = 512  # tokens aproximados (chars / 6)
```

**Proceso:**
- Divide el Markdown en fragmentos respetando la jerarquía de cabeceras.
- Cada chunk hereda la metadata de su cabecera (h1, h2, h3) para trazabilidad.
- Descarta chunks con menos de 50 caracteres (fragmentos sin contenido útil).
- Trunca chunks que superan `CHUNK_SIZE_LIMIT * 6` caracteres.

**Por qué chunking por cabeceras y no por ventana fija:**
- Los documentos institucionales (reglamentos, artículos) tienen estructura lógica clara.
- Un artículo completo de un reglamento es la unidad semántica natural.
- El chunking por ventana fija corta en medio de frases o artículos, perdiendo coherencia.

## Paso 4 — Generación de embeddings (`EmbeddingService`)

**Clase:** `fastapi/services/ingestion/embedder.py:EmbeddingService`

**Biblioteca:** `sentence-transformers`, modelo `BAAI/bge-m3`

**Configuración:**
```python
batch_size = 32          # procesamiento en lotes (GPU)
embedding_dim = 1024     # dimensión del vector de salida
```

**Proceso:**
- Extrae el texto de cada chunk en una lista.
- Genera embeddings en batches de 32 usando la GPU (Tesla V100).
- Asigna el vector `float[1024]` a `chunk.embedding`.

**Por qué BAAI/bge-m3:**
- Modelo de embeddings de última generación de BGE (BAAI, China).
- Soporta múltiples idiomas incluyendo español con alta fidelidad semántica.
- Dimensión 1024 ofrece mejor capacidad representacional que modelos de 384 dims.
- Disponible localmente, sin costo por llamada API.
- Benchmark MTEB: top-3 en retrieval multilingüe.

## Paso 5 — Indexación en pgvector (`SupabaseIndexer`)

**Clase:** `fastapi/services/ingestion/indexer.py:SupabaseIndexer`

**Biblioteca:** `supabase-py`

**Proceso:**
- Construye filas con `{doc_id, content, embedding, metadata}`.
- Inserta en lotes de 100 filas para evitar payloads HTTP grandes.
- Los chunks quedan almacenados en `document_chunks` con el índice HNSW activo.

**Índice HNSW (Hierarchical Navigable Small World):**
- Algoritmo de búsqueda aproximada de vecinos más cercanos (ANN).
- Parámetros: `m=16` (conexiones por nodo), `ef_construction=64` (calidad de construcción).
- Complejidad de búsqueda: O(log n) — significativamente más rápido que búsqueda exhaustiva.
- Óptimo para colecciones < 1 millón de vectores (caso de uso de la UTI).

## Progreso en tiempo real (Redis pub/sub + WebSocket)

Durante cada paso, la tarea Celery publica un mensaje JSON en el canal Redis:

```json
{"step": "embedding", "progress": 65, "message": "Generando embeddings para 47 chunks..."}
```

El WebSocket `/api/v1/ws/ingestion/{task_id}` suscribe ese canal y retransmite el mensaje al navegador del administrador, mostrando una barra de progreso en tiempo real.

## Estimación de tiempos por documento típico (20 páginas, 15 000 palabras)

| Paso | Tiempo estimado |
|---|---|
| Extracción PyMuPDF | ~0.5 s |
| Conversión Docling | ~15–30 s |
| Chunking LangChain | ~0.1 s |
| Embeddings bge-m3 (GPU) | ~2–5 s |
| Indexación Supabase | ~1–3 s |
| **Total** | **~20–40 s** |
