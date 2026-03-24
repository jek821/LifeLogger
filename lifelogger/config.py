"""Application constants and resolved paths (project root–relative)."""

from datetime import timedelta
from pathlib import Path

# Repository root (parent of the `lifelogger` package directory).
PROJECT_ROOT = Path(__file__).resolve().parent.parent

DB_PATH = str(PROJECT_ROOT / "timelogger.db")
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DIST_DIR = PROJECT_ROOT / "frontend-dist"

SESSION_TIMEOUT = timedelta(hours=1)
SESSION_TOUCH_INTERVAL = timedelta(minutes=5)
LABEL_MAX_LEN = 200
