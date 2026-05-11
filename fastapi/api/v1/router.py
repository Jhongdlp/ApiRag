from fastapi import APIRouter
from api.v1 import chat, documents, websocket

router = APIRouter()

router.include_router(chat.router, prefix="/chat", tags=["chat"])
router.include_router(documents.router, prefix="/admin/documents", tags=["admin"])
router.include_router(websocket.router, prefix="/ws", tags=["websocket"])
