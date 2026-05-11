#!/bin/bash
set -e

DOMAIN="${1:-$DOMAIN}"
EMAIL="${2:-$EMAIL}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
    echo "Uso: bash generate_ssl.sh <dominio> <email>"
    echo "  o bien: DOMAIN=mi.dominio.com EMAIL=yo@email.com bash generate_ssl.sh"
    exit 1
fi

echo "Generando certificado SSL para $DOMAIN..."
certbot certonly \
    --standalone \
    --preferred-challenges http \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

echo "Certificado generado en /etc/letsencrypt/live/$DOMAIN/"
echo "Recuerda montar ese directorio en el contenedor nginx."
