"""Shared rate-limiter instance — kept in its own module so routers can
import it without creating a circular dependency on app.main."""
from fastapi import Request
from slowapi import Limiter


def client_ip(request: Request) -> str:
    """Real client IP behind the Caddy reverse proxy (falls back to the
    socket peer for direct/local connections, e.g. tests)."""
    if forwarded := request.headers.get("x-forwarded-for"):
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=client_ip)
