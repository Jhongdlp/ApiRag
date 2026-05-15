# Visión General del Proyecto

## Título de la tesis

**"Diseño e implementación de un chatbot académico basado en Retrieval-Augmented Generation (RAG) para la atención de consultas estudiantiles en la Universidad Tecnológica Indoamérica"**

---

## Problema que resuelve

Los estudiantes de la UTI (Universidad Tecnológica Indoamérica, Ecuador) frecuentemente tienen dudas sobre reglamentos académicos, procesos de matrícula, normativas disciplinarias, manuales de titulación y otros documentos institucionales. El personal administrativo invierte tiempo considerable respondiendo preguntas repetitivas que ya están documentadas. No existe un sistema automatizado que permita al estudiante consultar esa información de manera inmediata, precisa y en español.

## Objetivo general

Desarrollar un sistema de chatbot académico que, mediante la técnica RAG (Retrieval-Augmented Generation), permita a los estudiantes de la UTI realizar consultas en lenguaje natural sobre documentos institucionales (PDF), obteniendo respuestas contextualizadas, precisas y en español.

## Objetivos específicos

1. Diseñar e implementar un pipeline de ingesta de documentos PDF → vectores semánticos almacenados en una base de datos vectorial.
2. Implementar un mecanismo de recuperación híbrida (semántica + léxica) para maximizar la relevancia de los fragmentos recuperados.
3. Integrar un modelo LLM local (Qwen2.5:14b vía Ollama) que genere respuestas fundamentadas exclusivamente en el contexto institucional recuperado.
4. Diseñar una arquitectura de microservicios dockerizada, segura y escalable, desplegable en servidor propio con GPU.
5. Garantizar la privacidad de los datos institucionales al operar con infraestructura completamente local (sin enviar datos a APIs externas de pago).

## Alcance

- **Documentos:** PDFs institucionales de la UTI (reglamentos, manuales, normativas).
- **Usuarios finales:** Estudiantes de pregrado y posgrado de la UTI.
- **Panel administrativo:** Permite a administradores subir/eliminar documentos.
- **Idioma:** Español exclusivamente.
- **Infraestructura:** Servidor propio con GPU NVIDIA Tesla V100 16 GB.

## Justificación tecnológica

| Criterio | Decisión | Razón |
|---|---|---|
| Modelo LLM | Qwen2.5:14b (local, Ollama) | Privacidad de datos institucionales; no requiere suscripción API externa |
| Base vectorial | Supabase + pgvector | Solución gestionada, SQL nativo, índice HNSW para búsqueda rápida |
| Embeddings | BAAI/bge-m3 (1024 dims) | Estado del arte en recuperación multilingüe, incluyendo español |
| Recuperación | Híbrida BM25 + Coseno (RRF) | Combina exactitud léxica con comprensión semántica |
| Backend | FastAPI + Celery | API asíncrona de alto rendimiento; tareas pesadas desacopladas |
| Contenedores | Docker Compose | Portabilidad, reproducibilidad, aislamiento de servicios |
