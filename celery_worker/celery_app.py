from celery import Celery
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

app = Celery(
    "uti_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks.ingestion_tasks"],
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Guayaquil",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)
