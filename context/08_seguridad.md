# Seguridad del Sistema

## Modelo de seguridad

El sistema distingue dos tipos de actores con controles de acceso diferenciados:

| Actor | Acceso | Control |
|---|---|---|
| Estudiante (anónimo) | Solo endpoint `/api/v1/chat` | Rate limiting Nginx (60 req/min) |
| Administrador | Endpoints `/api/v1/admin/*` + chat | JWT de Supabase con `role=admin` |

---

## Autenticación JWT (Supabase)

**Archivo:** `fastapi/core/security.py`

El administrador autentica en Supabase Auth (usuario con `user_metadata.role = "admin"`). Supabase emite un JWT firmado con `HS256` usando el `SUPABASE_JWT_SECRET`.

### Flujo de verificación

```
Admin realiza petición a /api/v1/admin/documents/upload
    → HTTP Header: Authorization: Bearer <jwt_token>
    → FastAPI: HTTPBearer extrae el token
    → verify_admin_token():
        jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        payload["user_metadata"]["role"] == "admin" ?
            → SÍ: permite acceso, retorna payload
            → NO: HTTP 403 Forbidden
        token inválido/expirado:
            → HTTP 401 Unauthorized
```

### Por qué JWT de Supabase y no sesiones propias

- Supabase Auth gestiona el ciclo de vida de usuarios (registro, login, refresh tokens).
- El backend no almacena sesiones; es stateless y escalable.
- El `audience="authenticated"` verifica que el token fue emitido para un usuario activo.

---

## Rate Limiting (Nginx)

```nginx
limit_req_zone $binary_remote_addr zone=chat:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
```

| Zona | Límite | Burst | Endpoints |
|---|---|---|---|
| `chat` | 60 req/min | 20 req | `/api/v1/chat` |
| `api` | 30 req/min | 10 req | `/api/v1/admin/*` |

`$binary_remote_addr` identifica al cliente por IP (4 bytes para IPv4, 16 para IPv6) — más eficiente en memoria que usar la IP en texto.

El rate limiting protege contra:
- Abuso del endpoint de chat (prompts masivos que saturan la GPU).
- Ataques de fuerza bruta al panel admin.
- Scrapers que extraigan todo el contenido institucional.

---

## TLS / HTTPS

- Certificado Let's Encrypt gratuito, gestionado por Certbot.
- Script `scripts/generate_ssl.sh` automatiza la emisión inicial.
- Protocolos: TLS 1.2 y 1.3 únicamente (sin TLS 1.0/1.1 obsoletos).
- Ciphers: `HIGH:!aNULL:!MD5` (excluye suites débiles).
- HSTS: `max-age=31536000; includeSubDomains` — los navegadores solo usan HTTPS por 1 año.

---

## Cabeceras HTTP de seguridad

| Cabecera | Valor | Protección |
|---|---|---|
| `X-Frame-Options` | `SAMEORIGIN` | Previene clickjacking |
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Activa el filtro XSS del navegador |
| `Strict-Transport-Security` | `max-age=31536000` | HSTS — fuerza HTTPS |

---

## Secretos y variables de entorno

- El archivo `.env` contiene todas las credenciales reales y está en `.gitignore`.
- El archivo `.env.example` documenta la estructura sin valores reales (sí se commitea).
- Variables sensibles: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SECRET_KEY`, `REDIS_PASSWORD`.
- Redis requiere contraseña: `redis-server --requirepass ${REDIS_PASSWORD}` — previene acceso no autorizado desde la red Docker.

---

## Privacidad de datos institucionales

Un aspecto central del diseño de seguridad es que **ningún dato institucional sale del servidor**:

- Los embeddings se generan con `BAAI/bge-m3` corriendo localmente.
- La generación de respuestas usa `Qwen2.5:14b` vía Ollama, corriendo en la GPU del servidor.
- Los vectores e índice se almacenan en Supabase (puede ser self-hosted o la región de nube elegida).
- No se envían documentos, queries, ni respuestas a APIs externas (OpenAI, Cohere, etc.).

Esta decisión es fundamental dado que los documentos institucionales pueden contener información sensible (reglamentos internos, procedimientos administrativos) que la universidad prefiere no exponer a terceros.

---

## Validación de entrada

- `ChatRequest.query`: longitud mínima 3, máxima 1000 caracteres (Pydantic Field).
- Upload de documentos: solo archivos `.pdf`, tamaño máximo 50 MB.
- Pydantic v2 valida automáticamente todos los request bodies antes de que lleguen a los handlers.

---

## Posibles mejoras de seguridad (trabajo futuro)

| Mejora | Justificación |
|---|---|
| Rotación de JWT secret | Supabase lo permite; actualmente sin rotación programada |
| Content Security Policy (CSP) | Complementaría las cabeceras actuales |
| Auditoría de logs | Loguru guarda logs en archivo; falta sistema de alertas |
| Escaneo de PDFs subidos | Los PDFs podrían contener macros maliciosas (bajo riesgo en entorno UTI) |
| Límite de uploads por admin | Actualmente sin límite de documentos por usuario admin |
