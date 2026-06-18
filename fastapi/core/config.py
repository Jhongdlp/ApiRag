from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # Redis
    REDIS_URL: str
    REDIS_PASSWORD: str = ""

    # Ollama
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "qwen2.5:14b"
    LLM_TEMPERATURE: float = 0.1
    LLM_NUM_PREDICT: int = 768

    # FastAPI
    SECRET_KEY: str
    ENVIRONMENT: str = "production"
    ALLOWED_ORIGINS: str

    # Embeddings
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DIM: int = 1024
    EMBEDDING_DEVICE: str = "auto"  # "auto" | "cuda" | "cpu"
    EMBEDDING_BATCH_SIZE: int = 32
    EMBEDDING_NORMALIZE: bool = True

    # Chunking (tokenizer-aware vía HybridChunker de Docling)
    CHUNK_MAX_TOKENS: int = 512
    CHUNK_MERGE_PEERS: bool = True

    # Docling (layout/OCR). GPU reservada para Ollama → default CPU.
    DOCLING_DEVICE: str = "cpu"  # "auto" | "cuda" | "cpu"
    DOCLING_NUM_THREADS: int = 4

    # Retrieval (RRF en Postgres)
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_RRF_K: int = 60
    RETRIEVAL_MIN_SIMILARITY: float = 0.4

    # Ingesta
    INDEXER_BATCH_SIZE: int = 100
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_BYTES: int = 50 * 1024 * 1024  # 50 MB
    CELERY_RETRY_MAX: int = 3
    CELERY_RETRY_BACKOFF: int = 60  # segundos

    class Config:
        env_file = ".env"


settings = Settings()
