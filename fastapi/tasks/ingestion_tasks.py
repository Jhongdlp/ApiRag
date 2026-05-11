from celery import Celery
from core.config import settings
import redis
import json

celery_app = Celery("uti_tasks", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
r = redis.from_url(settings.REDIS_URL)


def publish_progress(task_id: str, step: str, progress: int, message: str) -> None:
    """Publica el progreso al canal Redis para consumo vía WebSocket."""
    r.publish(
        f"task_progress:{task_id}",
        json.dumps({"step": step, "progress": progress, "message": message}),
    )


@celery_app.task(bind=True, name="process_document")
def process_document_task(self, doc_id: str, file_path: str, filename: str):
    """Pipeline completo de ingesta: extracción → chunking → embeddings → índice."""
    task_id = self.request.id

    try:
        publish_progress(task_id, "extraction", 10, "Extrayendo texto del PDF...")
        from services.ingestion.extractor import PDFExtractor
        PDFExtractor().extract(file_path)

        publish_progress(task_id, "conversion", 25, "Convirtiendo a Markdown estructurado...")
        from services.ingestion.converter import MarkdownConverter
        markdown_text = MarkdownConverter().convert(file_path)

        publish_progress(task_id, "chunking", 45, "Dividiendo en chunks semánticos...")
        from services.ingestion.chunker import DocumentChunker
        chunks = DocumentChunker().chunk(markdown_text, metadata={"doc_id": doc_id, "filename": filename})

        publish_progress(task_id, "embedding", 65, f"Generando embeddings para {len(chunks)} chunks...")
        from services.ingestion.embedder import EmbeddingService
        chunks_with_embeddings = EmbeddingService().embed(chunks)

        publish_progress(task_id, "indexing", 85, "Indexando en Supabase pgvector...")
        from services.ingestion.indexer import SupabaseIndexer
        SupabaseIndexer().index(chunks_with_embeddings)

        from services.document.manager import DocumentManager
        import asyncio
        asyncio.run(DocumentManager().update_status(doc_id, "ready", len(chunks)))

        publish_progress(task_id, "done", 100, f"'{filename}' indexado correctamente.")
        return {"status": "success", "doc_id": doc_id, "chunks": len(chunks)}

    except Exception as e:
        publish_progress(task_id, "error", 0, f"Error: {str(e)}")
        raise
