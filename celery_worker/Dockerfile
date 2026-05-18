# Worker Celery: misma base CUDA que FastAPI para que el EmbeddingService
# (que es donde más se siente la GPU) corra en la V100.
FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpoppler-cpp-dev \
    poppler-utils \
    libmagic1 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefer-binary -r requirements.txt

RUN python -c "import torch; print(f'[build] torch={torch.__version__} cuda_compiled={torch.version.cuda}')"

CMD ["celery", "-A", "tasks.ingestion_tasks", "worker", "--loglevel=info", "--concurrency=2"]
