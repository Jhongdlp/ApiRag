import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.config import settings
from api.v1.router import router as v1_router
from services.generation.llm import LLMService
from utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando UTI RAG Backend...")
    # En segundo plano para no retrasar el arranque: la app queda lista de
    # inmediato mientras Ollama carga el modelo.
    warmup_task = asyncio.create_task(LLMService().warmup())
    yield
    warmup_task.cancel()
    logger.info("Cerrando UTI RAG Backend...")


app = FastAPI(
    title="UTI RAG API",
    description="API backend del chatbot académico de la UTI",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")
