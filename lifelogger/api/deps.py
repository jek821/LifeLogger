from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from lifelogger.services.sessions import validate_session
from lifelogger.services.users import user_is_admin


def get_client_ip(request: Request) -> str:
    return (
        request.headers.get("X-Real-IP")
        or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )


limiter = Limiter(key_func=get_client_ip, default_limits=["200/minute"])

bearer = HTTPBearer()


def require_auth(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> int:
    user_id = validate_session(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Session expired or invalid. Please log in again.",
        )
    return user_id


def require_admin(user_id: int = Depends(require_auth)) -> int:
    if not user_is_admin(user_id):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user_id


async def on_rate_limit(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Please slow down."})
