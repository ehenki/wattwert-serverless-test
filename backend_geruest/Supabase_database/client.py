import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Lade .env Datei aus dem backend Ordner
backend_dir = Path(__file__).parent.parent  # Gehe vom Supabase_database zum backend Ordner
env_path = backend_dir / '.env'
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

def get_anon_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in the environment (.env file).")
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# per-request client limited by a user JWT (RLS enforced):

def get_user_client(access_token: str) -> Client:
    """Return a Supabase client that is authenticated as the given user.

    The client uses the *anon* key — therefore it is only allowed to perform
    the operations permitted by Row-Level-Security policies for that user.

    Args:
        access_token: The JWT obtained from `supabase.auth.getSession()` in the
            frontend and forwarded to the backend via an `Authorization` header
            (``Bearer <token>``).
    """
    if not access_token:
        raise ValueError("access_token must be provided to create a user-scoped client")

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in the environment (.env file).")

    client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    # -------------------------------------------------------------------
    # Inject the JWT so PostgREST & Storage requests are authorised as the user
    # -------------------------------------------------------------------

    # 1) PostgREST – preferred: dedicated auth() helper (supabase-py ≥1.0)
    try:
        client.postgrest.auth(access_token)  # type: ignore[attr-defined]
    except AttributeError:
        # Older postgrest client; fall back to header patching below
        pass

    # 2) Update default headers so *future* PostgREST / Storage clients pick it up
    client.options.headers["Authorization"] = f"Bearer {access_token}"

    # 3) If storage client already instantiated, patch its session headers
    if hasattr(client, "_storage") and client._storage is not None:  # type: ignore[attr-defined]
        client._storage.session.headers.update({"Authorization": f"Bearer {access_token}"})  # type: ignore[attr-defined]

    return client 