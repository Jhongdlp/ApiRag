# Metodología

## Enfoque de investigación

La investigación es de tipo **aplicada** con enfoque **mixto**:

- **Cuantitativo:** Métricas objetivas de rendimiento del sistema (precisión de recuperación, latencia de respuesta, throughput de ingesta).
- **Cualitativo:** Evaluación de la relevancia y coherencia de las respuestas generadas por el LLM mediante rúbricas de expertos y pruebas con usuarios.

## Metodología de desarrollo de software: Design Science Research (DSR)

Se aplica el paradigma **Design Science Research** (Hevner et al., 2004), orientado a la construcción y evaluación de artefactos tecnológicos que resuelven problemas del mundo real.

### Fases DSR aplicadas al proyecto

| Fase | Actividad | Entregable |
|---|---|---|
| 1. Identificación del problema | Análisis de la carga de atención administrativa en la UTI; revisión de literatura sobre RAG | Definición del problema, revisión bibliográfica |
| 2. Definición de objetivos | Requisitos funcionales y no funcionales del chatbot | Especificación de requisitos |
| 3. Diseño y desarrollo | Implementación del pipeline RAG, microservicios, API | Código fuente, Docker Compose |
| 4. Demostración | Despliegue en servidor real con documentos institucionales de la UTI | Sistema en producción |
| 5. Evaluación | Pruebas de recuperación (Recall@K, MRR), pruebas de usabilidad, medición de latencia | Resultados cuantitativos y cualitativos |
| 6. Comunicación | Redacción de la tesis, documentación técnica | Documento de tesis |

## Proceso de desarrollo iterativo

El desarrollo sigue ciclos iterativos cortos inspirados en metodologías ágiles:

```
Sprint 1 → Infraestructura base (Docker, Supabase, Redis, Ollama)
Sprint 2 → Pipeline de ingesta (PDF → chunks → embeddings → pgvector)
Sprint 3 → Pipeline de consulta (RAG: recuperación híbrida + generación)
Sprint 4 → API REST + WebSocket + seguridad JWT
Sprint 5 → Nginx + SSL + hardening
Sprint 6 → Evaluación y ajuste de parámetros (chunk size, top-k, RRF k)
```

## Evaluación del sistema

### Métricas de recuperación (offline)

Se construye un conjunto de evaluación (gold set) con pares pregunta–respuesta correcta elaborados a partir de los documentos institucionales:

- **Recall@K:** proporción de preguntas cuya respuesta correcta aparece en los top-K chunks recuperados.
- **MRR (Mean Reciprocal Rank):** posición promedio del primer chunk relevante.
- **Precision@K:** proporción de chunks recuperados que son relevantes.

### Métricas del sistema (online)

- **Latencia P50/P95:** tiempo de respuesta del endpoint `/api/v1/chat`.
- **Throughput de ingesta:** documentos procesados por hora.
- **VRAM utilizada:** monitoreo de uso de GPU durante generación.

### Evaluación cualitativa

- Rúbrica con 5 criterios: precisión factual, completitud, claridad, uso correcto del contexto, ausencia de alucinaciones.
- Panel de evaluadores: docentes/administrativos de la UTI.
- Escala Likert 1-5 por criterio.

## Herramientas de investigación

| Herramienta | Uso |
|---|---|
| Python 3.11 | Lenguaje principal de implementación |
| Jupyter Notebook | Experimentos de evaluación y análisis |
| Supabase Studio | Inspección de datos en pgvector |
| Postman / curl | Pruebas manuales de la API |
| Flower (Celery) | Monitoreo de tareas de ingesta |
| Docker stats | Monitoreo de recursos en contenedores |
