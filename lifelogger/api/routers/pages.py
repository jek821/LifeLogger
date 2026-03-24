from fastapi import APIRouter
from fastapi.responses import FileResponse

from lifelogger.config import FRONTEND_DIR

router = APIRouter(tags=["pages"])


@router.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(FRONTEND_DIR / "icon.png", media_type="image/png")


@router.get("/")
def serve_frontend():
    return FileResponse(FRONTEND_DIR / "index.html")


@router.get("/developer")
def serve_developer():
    return FileResponse(FRONTEND_DIR / "developer.html")


@router.get("/admin")
def serve_admin():
    return FileResponse(FRONTEND_DIR / "admin.html")


@router.get("/settings")
def serve_settings():
    return FileResponse(FRONTEND_DIR / "settings.html")
