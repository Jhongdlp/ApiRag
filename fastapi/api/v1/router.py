from fastapi import APIRouter
from api.v1 import chat, conversations, documents, evaluation, websocket, health, stats

router = APIRouter()

router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(chat.router, prefix="/chat", tags=["chat"])
router.include_router(documents.router, prefix="/admin/documents", tags=["admin"])
router.include_router(stats.router, prefix="/admin/stats", tags=["admin"])
router.include_router(conversations.router, prefix="/admin/conversations", tags=["admin"])
router.include_router(evaluation.router, prefix="/admin/evaluation", tags=["admin"])
router.include_router(websocket.router, prefix="/ws", tags=["websocket"])
