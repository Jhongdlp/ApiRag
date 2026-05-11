from supabase import create_client, Client
from core.config import settings
from functools import lru_cache


@lru_cache()
def get_supabase_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
