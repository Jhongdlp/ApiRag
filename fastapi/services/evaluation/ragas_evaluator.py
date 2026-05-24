"""Evalúa el pipeline RAG con las 4 métricas principales de RAGAS y genera PDF.

Flujo:
1. Recibe EvalSamples con {question, answer, contexts, ground_truth}
2. Construye EvaluationDataset de RAGAS
3. Evalúa con qwen2.5:14b como juez (vía LangChain Ollama wrapper)
4. Genera reporte PDF con ReportLab
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import List

from utils.logger import logger


@dataclass
class EvalSample:
    question: str
    answer: str
    contexts: List[str]
    ground_truth: str
    faithfulness: float = 0.0
    answer_relevancy: float = 0.0
    context_precision: float = 0.0
    context_recall: float = 0.0


@dataclass
class RagasResult:
    faithfulness: float
    answer_relevancy: float
    context_precision: float
    context_recall: float
    samples: List[EvalSample] = field(default_factory=list)

    @property
    def overall(self) -> float:
        return (
            self.faithfulness
            + self.answer_relevancy
            + self.context_precision
            + self.context_recall
        ) / 4


class RagasEvaluator:
    """Evalúa muestras RAG con las 4 métricas de RAGAS usando Ollama como juez."""

    def __init__(self) -> None:
        from core.config import settings
        self._settings = settings

    def _build_llm(self):
        from langchain_ollama import ChatOllama
        from ragas.llms import LangchainLLMWrapper

        llm = ChatOllama(
            model=self._settings.OLLAMA_MODEL,
            base_url=self._settings.OLLAMA_BASE_URL,
            temperature=0.0,
            num_predict=512,
        )
        return LangchainLLMWrapper(llm)

    def _build_embeddings(self):
        from langchain_ollama import OllamaEmbeddings
        from ragas.embeddings import LangchainEmbeddingsWrapper

        emb = OllamaEmbeddings(
            model=self._settings.OLLAMA_MODEL,
            base_url=self._settings.OLLAMA_BASE_URL,
        )
        return LangchainEmbeddingsWrapper(emb)

    def evaluate(self, samples: List[EvalSample]) -> RagasResult:
        """Ejecuta ragas.evaluate() y retorna RagasResult con scores."""
        import pandas as pd
        from ragas import evaluate
        from ragas.dataset_schema import EvaluationDataset, SingleTurnSample
        from ragas.metrics import (
            AnswerRelevancy,
            ContextPrecision,
            ContextRecall,
            Faithfulness,
        )

        logger.info(f"[ragas] Evaluando {len(samples)} muestras...")
        ragas_samples = [
            SingleTurnSample(
                user_input=s.question,
                response=s.answer,
                retrieved_contexts=s.contexts,
                reference=s.ground_truth,
            )
            for s in samples
        ]
        dataset = EvaluationDataset(samples=ragas_samples)

        metrics = [
            Faithfulness(),
            AnswerRelevancy(),
            ContextPrecision(),
            ContextRecall(),
        ]
        llm = self._build_llm()
        emb = self._build_embeddings()

        result_ds = evaluate(
            dataset=dataset,
            metrics=metrics,
            llm=llm,
            embeddings=emb,
            raise_exceptions=False,
        )

        df: pd.DataFrame = result_ds.to_pandas()

        def _safe(col: str) -> float:
            if col in df.columns:
                val = df[col].mean()
                return round(float(val) if not pd.isna(val) else 0.0, 4)
            return 0.0

        # Añade scores por muestra
        for i, s in enumerate(samples):
            if i < len(df):
                s.faithfulness = round(float(df["faithfulness"].iloc[i]) if "faithfulness" in df.columns and not pd.isna(df["faithfulness"].iloc[i]) else 0.0, 4)
                s.answer_relevancy = round(float(df["answer_relevancy"].iloc[i]) if "answer_relevancy" in df.columns and not pd.isna(df["answer_relevancy"].iloc[i]) else 0.0, 4)
                s.context_precision = round(float(df["context_precision"].iloc[i]) if "context_precision" in df.columns and not pd.isna(df["context_precision"].iloc[i]) else 0.0, 4)
                s.context_recall = round(float(df["context_recall"].iloc[i]) if "context_recall" in df.columns and not pd.isna(df["context_recall"].iloc[i]) else 0.0, 4)

        return RagasResult(
            faithfulness=_safe("faithfulness"),
            answer_relevancy=_safe("answer_relevancy"),
            context_precision=_safe("context_precision"),
            context_recall=_safe("context_recall"),
            samples=samples,
        )

    def generate_pdf(self, result: RagasResult, path: str) -> None:
        """Genera el reporte PDF en `path` con ReportLab."""
        import math
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable
        )

        os.makedirs(os.path.dirname(path), exist_ok=True)
        doc = SimpleDocTemplate(
            path,
            pagesize=A4,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
            topMargin=2.5 * cm,
            bottomMargin=2 * cm,
        )

        styles = getSampleStyleSheet()
        GOLD = colors.HexColor("#F5A623")
        DARK = colors.HexColor("#0A0A0A")
        DIM = colors.HexColor("#888888")
        LIGHT = colors.HexColor("#F0F0F0")

        title_style = ParagraphStyle(
            "title", parent=styles["Heading1"],
            fontSize=22, textColor=DARK, spaceAfter=4, fontName="Helvetica-Bold",
        )
        subtitle_style = ParagraphStyle(
            "subtitle", parent=styles["Normal"],
            fontSize=10, textColor=DIM, spaceAfter=2,
        )
        section_style = ParagraphStyle(
            "section", parent=styles["Heading2"],
            fontSize=13, textColor=DARK, spaceBefore=16, spaceAfter=8,
            fontName="Helvetica-Bold",
        )
        body_style = ParagraphStyle(
            "body", parent=styles["Normal"],
            fontSize=9, textColor=DARK, spaceAfter=4,
        )
        small_style = ParagraphStyle(
            "small", parent=styles["Normal"],
            fontSize=8, textColor=DIM,
        )

        story = []

        # ── Encabezado ────────────────────────────────────────────────────────
        story.append(Paragraph("Reporte de Evaluación RAGAS", title_style))
        story.append(Paragraph("Universidad Tecnológica Indoamérica — Sistema RAG Académico", subtitle_style))
        story.append(Paragraph(
            f"Generado el {datetime.now().strftime('%d de %B de %Y a las %H:%M')} · "
            f"{len(result.samples)} muestras evaluadas",
            subtitle_style,
        ))
        story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD, spaceAfter=16))

        # ── Score global ──────────────────────────────────────────────────────
        overall_pct = round(result.overall * 100, 1)
        story.append(Paragraph(f"Score Global: {overall_pct}%", section_style))
        story.append(_recommendation_paragraph(result.overall, body_style))
        story.append(Spacer(1, 12))

        # ── Tabla de métricas ─────────────────────────────────────────────────
        story.append(Paragraph("Métricas Principales", section_style))

        metrics_data = [
            ["Métrica", "Score", "Descripción"],
            ["Faithfulness", f"{result.faithfulness:.2%}", "Fidelidad de la respuesta al contexto recuperado"],
            ["Answer Relevancy", f"{result.answer_relevancy:.2%}", "Relevancia de la respuesta respecto a la pregunta"],
            ["Context Precision", f"{result.context_precision:.2%}", "Precisión del retrieval (chunks pertinentes)"],
            ["Context Recall", f"{result.context_recall:.2%}", "Cobertura del retrieval (chunks necesarios)"],
        ]
        metrics_table = Table(metrics_data, colWidths=[5 * cm, 2.5 * cm, 9.5 * cm])
        metrics_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, colors.white]),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(metrics_table)
        story.append(Spacer(1, 20))

        # ── Tabla de muestras ─────────────────────────────────────────────────
        story.append(Paragraph("Detalle por Pregunta", section_style))
        sample_header = ["#", "Pregunta", "Faith.", "A.Rel.", "C.Prec.", "C.Rec."]
        sample_rows = [sample_header]
        for i, s in enumerate(result.samples, 1):
            q = s.question[:80] + "…" if len(s.question) > 80 else s.question
            sample_rows.append([
                str(i), q,
                f"{s.faithfulness:.2f}",
                f"{s.answer_relevancy:.2f}",
                f"{s.context_precision:.2f}",
                f"{s.context_recall:.2f}",
            ])

        sample_table = Table(
            sample_rows,
            colWidths=[0.7 * cm, 10.3 * cm, 1.5 * cm, 1.5 * cm, 1.5 * cm, 1.5 * cm],
        )
        sample_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
            ("ALIGN", (2, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(sample_table)

        story.append(Spacer(1, 16))
        story.append(HRFlowable(width="100%", thickness=0.5, color=DIM))
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            "Generado automáticamente por el sistema de evaluación UTI RAG · "
            "Métricas calculadas con RAGAS 0.2 usando qwen2.5:14b como juez",
            small_style,
        ))

        doc.build(story)
        logger.info(f"[ragas] PDF generado en {path}")


def _recommendation_paragraph(overall: float, style) -> "Paragraph":
    from reportlab.platypus import Paragraph

    if overall >= 0.80:
        msg = "El sistema muestra excelente calidad. Las respuestas son fieles al contexto y altamente relevantes."
    elif overall >= 0.65:
        msg = "El sistema muestra buena calidad general. Se recomienda revisar la cobertura del retrieval para mejorar Context Recall."
    elif overall >= 0.50:
        msg = "Calidad moderada. Considerar ampliar el índice de documentos o ajustar los parámetros de chunking para mejorar el retrieval."
    else:
        msg = "El sistema requiere mejoras significativas. Revisar la calidad de los documentos indexados y la configuración del modelo de embeddings."

    return Paragraph(msg, style)
