from fastapi import APIRouter
from fastapi.responses import FileResponse

from lifelogger.config import FRONTEND_DIR

router = APIRouter(tags=["pages"])


@router.get("/")
def serve_frontend():
    return FileResponse(FRONTEND_DIR / "index.html")


@router.get("/developer")
def serve_developer():
    return FileResponse(FRONTEND_DIR / "developer.html")


@router.get("/admin")
def serve_admin():
    return FileResponse(FRONTEND_DIR / "admin.html")
