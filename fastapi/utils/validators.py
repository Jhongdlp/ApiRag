import magic
from fastapi import HTTPException


ALLOWED_MIME = {"application/pdf"}
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


def validate_pdf(content: bytes, filename: str) -> None:
    """Valida que el archivo sea un PDF real y no supere el límite de tamaño."""
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (máx 50 MB).")

    mime = magic.from_buffer(content, mime=True)
    if mime not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido: {mime}. Solo PDF.",
        )
