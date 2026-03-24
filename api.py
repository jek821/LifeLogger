"""ASGI entrypoint kept at repo root so ``uvicorn api:app`` keeps working."""

from lifelogger.api.app import app

__all__ = ["app"]
