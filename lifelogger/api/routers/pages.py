from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from lifelogger.config import DIST_DIR

router = APIRouter(tags=["pages"])


@router.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(DIST_DIR / "icon.png", media_type="image/png")


@router.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str):
    """Serve the React SPA. Static assets are served directly; all other
    paths fall through to index.html so React Router handles navigation."""
    candidate: Path = DIST_DIR / full_path
    if full_path and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(DIST_DIR / "index.html")
