from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from lifelogger.api.deps import limiter, on_rate_limit
from lifelogger.api.routers import admin, auth, events, labels, pages, stats
from lifelogger.config import FRONTEND_DIR
from lifelogger.db import init_db


def create_app() -> FastAPI:
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, on_rate_limit)
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    init_db()

    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR)), name="assets")

    app.include_router(pages.router)
    app.include_router(auth.router)
    app.include_router(labels.router)
    app.include_router(events.router)
    app.include_router(stats.router)
    app.include_router(admin.router)

    return app


app = create_app()
