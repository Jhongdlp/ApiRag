from loguru import logger
import sys

logger.remove()
logger.add(
    sys.stdout,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} — {message}",
    level="INFO",
    colorize=True,
)
logger.add(
    "/app/logs/app.log",
    rotation="10 MB",
    retention="30 days",
    level="DEBUG",
    enqueue=True,
)
