"""Genera un conjunto de test sintético desde chunks de Supabase.

Para cada chunk seleccionado llama a Ollama y pide una pregunta académica
natural + respuesta ideal. Esto permite evaluar el sistema RAG sin necesidad
de un dataset anotado manualmente.
"""
from __future__ import annotations

import json
import random
import re
from dataclasses import dataclass
from typing import List, Optional

import ollama

from core.config import settings
from core.dependencies import get_supabase_client
from utils.logger import logger

_QA_PROMPT = """Eres un evaluador experto de sistemas RAG para la Universidad Tecnológica Indoamérica (UTI).

Dado el siguiente fragmento de un documento institucional, genera UNA sola pregunta académica natural que un estudiante de la UTI podría hacer, junto con la respuesta correcta basada ÚNICAMENTE en el texto proporcionado.

Reglas:
- La pregunta debe ser específica y responderla con el fragmento dado.
- La respuesta debe ser concisa (máximo 3 oraciones) y usar SOLO información del fragmento.
- Responde SOLO con JSON válido, sin texto adicional.

Formato de respuesta:
{{"question": "...", "ground_truth": "..."}}

Fragmento:
{chunk_content}"""


@dataclass
class QASample:
    question: str
    ground_truth: str
    source_chunk_id: str
    doc_id: str
    source_content: str


class TestsetGenerator:
    """Genera preguntas sintéticas desde chunks almacenados en Supabase."""

    def __init__(self) -> None:
        self._client = get_supabase_client()
        self._ollama = ollama.Client(host=settings.OLLAMA_BASE_URL)

    def fetch_chunks(
        self,
        doc_ids: Optional[List[str]],
        n_per_doc: int,
    ) -> List[dict]:
        """Devuelve una muestra representativa de chunks de los documentos listos."""
        query = (
            self._client.table("document_chunks")
            .select("id, doc_id, content")
            .order("id")
        )
        if doc_ids:
            query = query.in_("doc_id", doc_ids)

        # Filtra solo documentos en estado 'ready'
        ready_docs = (
            self._client.table("documents")
            .select("id")
            .eq("status", "ready")
            .execute()
        )
        ready_ids = [r["id"] for r in (ready_docs.data or [])]
        if not ready_ids:
            return []

        if doc_ids:
            effective_ids = [d for d in doc_ids if d in ready_ids]
        else:
            effective_ids = ready_ids

        if not effective_ids:
            return []

        rows = (
            self._client.table("document_chunks")
            .select("id, doc_id, content")
            .in_("doc_id", effective_ids)
            .execute()
        )
        all_chunks = rows.data or []

        # Agrupa por doc y muestrea n_per_doc de cada uno
        by_doc: dict[str, list] = {}
        for c in all_chunks:
            by_doc.setdefault(c["doc_id"], []).append(c)

        sampled: List[dict] = []
        for doc_chunks in by_doc.values():
            # Prefiere chunks del medio del documento (evita portadas/índices)
            mid = len(doc_chunks) // 4
            pool = doc_chunks[mid:] if len(doc_chunks) > 4 else doc_chunks
            # Solo chunks con suficiente contenido
            pool = [c for c in pool if len(c.get("content", "")) > 100]
            sampled.extend(random.sample(pool, min(n_per_doc, len(pool))))

        return sampled

    def _generate_qa(self, chunk: dict) -> Optional[QASample]:
        content = chunk.get("content", "").strip()
        if not content:
            return None
        prompt = _QA_PROMPT.format(chunk_content=content[:1500])
        try:
            resp = self._ollama.generate(
                model=settings.OLLAMA_MODEL,
                prompt=prompt,
                options={"temperature": 0.3, "num_predict": 300},
            )
            raw = resp.response.strip()
            # Extrae el JSON aunque haya texto extra alrededor
            match = re.search(r'\{.*?"question".*?"ground_truth".*?\}', raw, re.DOTALL)
            if not match:
                logger.warning(f"[testset] Sin JSON válido para chunk {chunk['id']}")
                return None
            data = json.loads(match.group())
            return QASample(
                question=data["question"].strip(),
                ground_truth=data["ground_truth"].strip(),
                source_chunk_id=chunk["id"],
                doc_id=chunk["doc_id"],
                source_content=content,
            )
        except Exception as e:
            logger.warning(f"[testset] Error generando QA para chunk {chunk['id']}: {e!r}")
            return None

    def generate(
        self,
        doc_ids: Optional[List[str]],
        n_per_doc: int = 5,
    ) -> List[QASample]:
        """Genera y retorna una lista de pares QA sintéticos."""
        chunks = self.fetch_chunks(doc_ids, n_per_doc)
        logger.info(f"[testset] Generando QA para {len(chunks)} chunks")
        samples: List[QASample] = []
        for chunk in chunks:
            qa = self._generate_qa(chunk)
            if qa:
                samples.append(qa)
        logger.info(f"[testset] {len(samples)} pares QA generados exitosamente")
        return samples
