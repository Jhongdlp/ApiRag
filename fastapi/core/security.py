from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from core.dependencies import get_supabase_client

security = HTTPBearer()


async def verify_admin_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Verifica el JWT de Supabase llamando a la API de auth (no requiere JWT secret local)."""
    try:
        client = get_supabase_client()
        resp = client.auth.get_user(credentials.credentials)
        user = resp.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado.",
            )
        user_role = (user.user_metadata or {}).get("role")
        if user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso restringido a administradores.",
            )
        return {"sub": user.id, "email": user.email, "user_metadata": user.user_metadata}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
        ) from exc
