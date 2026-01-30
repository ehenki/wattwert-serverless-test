import google.auth
import google.auth.transport.requests
import google.oauth2.id_token

def get_google_oidc_token(audience: str) -> str:
    """
    Fetches an OIDC ID token from the Google Metadata Server.
    The 'audience' must be the URL of the target service (LOD backend).
    """
    try:
        # This only works when running on Google Cloud (Cloud Run/Cloud Build)
        auth_req = google.auth.transport.requests.Request()
        return google.oauth2.id_token.fetch_id_token(auth_req, audience)
    except Exception:
        # Fallback for local development (LOD is likely on localhost without auth)
        return "local-dev-token"