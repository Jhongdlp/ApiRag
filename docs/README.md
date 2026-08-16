# Documentación — Asistente Académico UTI

Documentación **operativa y de usuario** del chatbot académico RAG de la Universidad
Tecnológica Indoamérica (UTI). Aquí encontrarás cómo **usar** y **operar** el sistema.

> ¿Buscas la documentación **técnica para la tesis** (arquitectura, metodología,
> pipelines, decisiones de diseño)? Está en la carpeta [`../context/`](../context/00_indice.md).

## Índice

| Documento | Para quién | Contenido |
|---|---|---|
| [Manual de uso](manual-de-uso.md) | Estudiantes y administradores | Cómo consultar el chat y cómo operar el panel administrativo |
| [Manual de instalación y despliegue](manual-instalacion-despliegue.md) | Quien instala/despliega | Requisitos, GPU, Docker, Supabase, SSL, frontend y puesta en marcha |
| [Referencia de la API](referencia-api.md) | Desarrolladores | Endpoints REST y WebSocket, autenticación, modelos de datos |
| [Solución de problemas (FAQ)](solucion-de-problemas.md) | Todos | Errores comunes por perfil (estudiante, admin, técnico) y cómo resolverlos |
| [Glosario](glosario.md) | Todos | RAG, chunk, embedding, RRF, RAGAS y demás términos |

## Mapa rápido del sistema

- **Chat público** (estudiantes) → responde consultas sobre documentos institucionales
  con las fuentes oficiales citadas.
- **Panel administrativo** (`/dashboard`, requiere login) → subir documentos, monitorear
  conversaciones, ver analítica, evaluar calidad (RAGAS) y revisar el estado del sistema.

---
_Universidad Tecnológica Indoamérica · Ecuador · v1.0 (Beta)_
