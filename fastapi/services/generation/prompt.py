from models.chunk import Chunk
from typing import List

SYSTEM_PROMPT = """Eres el asistente académico oficial de la Universidad Tecnológica Indoamérica (UTI).
Responde únicamente basándote en el contexto institucional proporcionado.
Si la información no está en el contexto, indica que no tienes datos suficientes.
Responde siempre en español, de forma clara, precisa y respetuosa."""


def build_prompt(query: str, chunks: List[Chunk]) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        source = chunk.metadata.get("filename", "Documento institucional")
        context_parts.append(f"[Fuente {i} — {source}]\n{chunk.content}")

    context = "\n\n".join(context_parts)
    return f"""{SYSTEM_PROMPT}

### Contexto institucional:
{context}

### Pregunta del estudiante:
{query}

### Respuesta:"""
