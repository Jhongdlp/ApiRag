# Contexto del Proyecto — UTI RAG Backend

## Índice de documentos

Esta carpeta contiene la documentación técnica completa del proyecto de tesis para uso como referencia de redacción.

| Archivo | Contenido |
|---|---|
| [01_vision_general.md](01_vision_general.md) | Título, problema, objetivos, alcance, justificación tecnológica |
| [02_metodologia.md](02_metodologia.md) | Design Science Research, fases, métricas de evaluación |
| [03_arquitectura_sistema.md](03_arquitectura_sistema.md) | Diagrama de componentes, descripción de servicios, flujos de datos, decisiones de diseño |
| [04_arquitectura_carpetas.md](04_arquitectura_carpetas.md) | Estructura de directorios completa, principios de organización (capas, SRP, DI) |
| [05_pipeline_ingesta.md](05_pipeline_ingesta.md) | PDF→chunks→embeddings→pgvector: cada paso, bibliotecas, tiempos estimados |
| [06_pipeline_rag.md](06_pipeline_rag.md) | Recuperación híbrida RRF, VectorRetriever, BM25Retriever, generación con Qwen2.5 |
| [07_stack_tecnologico.md](07_stack_tecnologico.md) | Tabla completa del stack, justificación de cada tecnología |
| [08_seguridad.md](08_seguridad.md) | JWT, rate limiting, TLS, cabeceras HTTP, privacidad de datos |

---

## Resumen ejecutivo para la tesis

**Qué se construyó:** Un chatbot académico basado en RAG (Retrieval-Augmented Generation) para la Universidad Tecnológica Indoamérica (UTI, Ecuador). Permite a los estudiantes consultar documentos institucionales (reglamentos, manuales, normativas) en lenguaje natural en español y recibir respuestas precisas con trazabilidad a la fuente.

**Cómo funciona:**
1. Un administrador sube PDFs institucionales al sistema.
2. El pipeline de ingesta (PyMuPDF → Docling → LangChain → bge-m3 → pgvector) transforma cada PDF en chunks vectorizados almacenados en Supabase.
3. Cuando un estudiante hace una pregunta, el sistema recupera los chunks más relevantes mediante búsqueda híbrida (similitud coseno + BM25, fusionados con RRF).
4. Los chunks recuperados se inyectan como contexto en el prompt del LLM (Qwen2.5:14b, local en GPU).
5. El LLM genera una respuesta fundamentada exclusivamente en ese contexto.

**Por qué esta arquitectura:** Garantiza privacidad (todo local), precisión (RAG vs fine-tuning), escalabilidad (microservicios Docker) y bajo costo operativo (sin APIs de pago).

**Hardware:** Servidor con GPU NVIDIA Tesla V100 16 GB. El modelo usa ~9 GB VRAM. Los embeddings también aprovechan la GPU.

**Stack principal:** Python 3.11 · FastAPI · Celery · Redis · Ollama · pgvector · Docker Compose · Nginx.
