"""Construcción del prompt RAG con citas estructuradas.

Cambios vs prompt previo:
- Cada chunk se etiqueta con `archivo · p.X · Sección Y`, no solo el filename.
- El system prompt instruye a citar `[Fuente N]` en la respuesta — el frontend
  puede convertir esas marcas en enlaces a la página del PDF.
- Indica explícitamente que las respuestas deben aparecer EN ESPAÑOL y rechazar
  preguntas no académicas.
"""
from __future__ import annotations

from typing import List

from models.chunk import Chunk


SYSTEM_PROMPT = """Eres el asistente académico oficial de la Universidad Tecnológica Indoamérica (UTI), Ecuador.

REGLAS:
1. Responde EXCLUSIVAMENTE con información presente en el contexto institucional dado.
2. Cita cada afirmación con la marca [Fuente N] correspondiente al fragmento usado.
3. Si la pregunta NO se puede responder con el contexto, dilo claramente y sugiere a quién acudir (Secretaría Académica, Bienestar Estudiantil, etc.).
4. Responde siempre en español neutro, claro y respetuoso. Sé conciso: párrafos cortos, listas cuando ayuden.
5. No inventes artículos, fechas, números, ni nombres."""


def build_prompt(query: str, chunks: List[Chunk]) -> str:
    context_parts: list[str] = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(_format_chunk(i, chunk))
    context = "\n\n".join(context_parts) if context_parts else "(sin contexto recuperado)"

    return f"""{SYSTEM_PROMPT}

### Contexto institucional:
{context}

### Pregunta del estudiante:
{query}

### Respuesta (en español, con citas [Fuente N]):"""


def _format_chunk(idx: int, chunk: Chunk) -> str:
    md = chunk.metadata or {}
    filename = md.get("filename", "Documento institucional")
    page = chunk.page_number or md.get("page")
    heading = chunk.heading_path or (" > ".join(md.get("headings", [])) if md.get("headings") else None)

    header_bits = [filename]
    if page is not None:
        header_bits.append(f"p.{page}")
    if heading:
        header_bits.append(heading)
    header = " · ".join(header_bits)
    return f"[Fuente {idx} — {header}]\n{chunk.content}"
