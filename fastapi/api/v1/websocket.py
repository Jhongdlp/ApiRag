from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from utils.logger import logger
import redis.asyncio as aioredis
from core.config import settings

router = APIRouter()


@router.websocket("/ingestion/{task_id}")
async def ingestion_progress(websocket: WebSocket, task_id: str):
    """WebSocket que transmite el progreso de ingesta al panel admin."""
    await websocket.accept()
    r = aioredis.from_url(settings.REDIS_URL)

    try:
        pubsub = r.pubsub()
        await pubsub.subscribe(f"task_progress:{task_id}")

        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"].decode())
    except WebSocketDisconnect:
        logger.info(f"WebSocket desconectado para tarea {task_id}")
    finally:
        await pubsub.unsubscribe(f"task_progress:{task_id}")
        await r.aclose()


@router.websocket("/evaluation/{task_id}")
async def evaluation_progress(websocket: WebSocket, task_id: str):
    """WebSocket que transmite el progreso de evaluación RAGAS al panel admin."""
    await websocket.accept()
    r = aioredis.from_url(settings.REDIS_URL)

    try:
        pubsub = r.pubsub()
        await pubsub.subscribe(f"task_eval_progress:{task_id}")

        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"].decode()
                await websocket.send_text(data)
                import json
                parsed = json.loads(data)
                if parsed.get("step") in ("done", "error"):
                    break
    except WebSocketDisconnect:
        logger.info(f"[eval] WebSocket desconectado para tarea {task_id}")
    finally:
        await pubsub.unsubscribe(f"task_eval_progress:{task_id}")
        await r.aclose()
