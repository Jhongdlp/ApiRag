#!/bin/bash
set -e

echo "Esperando a que Ollama esté listo..."
until docker exec uti_ollama ollama list &>/dev/null; do
    sleep 2
done

MODEL="${OLLAMA_MODEL:-qwen2.5:14b}"
echo "Descargando ${MODEL} en Ollama..."
docker exec uti_ollama ollama pull "${MODEL}"
echo "Modelo ${MODEL} descargado correctamente."
