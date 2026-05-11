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
    OLLAMA_MODEL: str = "llama3.1:8b"

    # FastAPI
    SECRET_KEY: str
    ENVIRONMENT: str = "production"
    ALLOWED_ORIGINS: str

    # Embeddings
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    CHUNK_SIZE_LIMIT: int = 512

    class Config:
        env_file = ".env"


settings = Settings()
