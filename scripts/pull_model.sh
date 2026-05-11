#!/bin/bash
set -e

echo "Esperando a que Ollama esté listo..."
until docker exec uti_ollama ollama list &>/dev/null; do
    sleep 2
done

echo "Descargando Llama 3.1 8B en Ollama..."
docker exec uti_ollama ollama pull llama3.1:8b
echo "Modelo descargado correctamente."
