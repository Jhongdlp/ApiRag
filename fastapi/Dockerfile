# Base PyTorch con CUDA 12.1 + cuDNN 9 + Python 3.11.
# CUDA 12.1 da compatibilidad amplia con drivers NVIDIA 525+ (V100, A100, etc.).
# Si el driver del host es >= 550, podés subir a cuda12.4 sin romper nada.
FROM pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime

WORKDIR /app

# Dependencias de sistema:
#  - poppler/tesseract: PDFs y OCR (Docling los aprovecha)
#  - libmagic1: validador MIME real (utils/validators.py)
#  - libgl1, libglib2.0-0: imagen processing transitivas (Docling)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpoppler-cpp-dev \
    poppler-utils \
    tesseract-ocr \
    libmagic1 \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# torch ya está pre-instalado en la imagen base con soporte CUDA — pip lo
# detecta y NO reinstala (sentence-transformers solo requiere torch>=1.11).
# `--prefer-binary` evita compilar paquetes nativos que ya tienen wheel.
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefer-binary -r requirements.txt

# Sanity check: el contenedor debe ver torch con CUDA al construirse.
# Si esto imprime "False", la imagen base no trae CUDA o el wheel de torch
# no es CUDA — corregir antes de seguir.
RUN python -c "import torch; print(f'[build] torch={torch.__version__} cuda_compiled={torch.version.cuda}')"

COPY . .

RUN mkdir -p /app/logs /app/uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
