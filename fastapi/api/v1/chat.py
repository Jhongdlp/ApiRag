from fastapi import APIRouter, HTTPException
from models.chat import ChatRequest, ChatResponse
from services.retrieval.hybrid import HybridRetriever
from services.generation.llm import LLMService
from utils.logger import logger

router = APIRouter()
retriever = HybridRetriever()
llm_service = LLMService()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Endpoint público del chatbot. Recibe pregunta y retorna respuesta."""
    try:
        chunks = await retriever.retrieve(request.query, top_k=5)

        if not chunks:
            return ChatResponse(
                answer="No encontré información relacionada en los documentos institucionales.",
                sources=[],
            )

        answer = await llm_service.generate(
            query=request.query,
            context_chunks=chunks,
        )

        return ChatResponse(
            answer=answer,
            sources=[c.metadata for c in chunks],
        )
    except Exception as e:
        logger.error(f"Error en chat: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor.")
