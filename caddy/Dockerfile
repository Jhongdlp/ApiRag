# Caddy no trae rate limiting en el binario oficial; se compila con el plugin
# para no perder el límite por IP que antes daba limit_req en nginx.
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/mholt/caddy-ratelimit

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
