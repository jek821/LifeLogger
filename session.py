import json
import os
import secrets
from datetime import datetime, timedelta, timezone

SESSION_FILE = "session.json"
TIMEOUT = timedelta(hours=1)


def _load() -> dict | None:
    if os.path.exists(SESSION_FILE):
        with open(SESSION_FILE) as f:
            return json.load(f)
    return None


def _save(data: dict):
    with open(SESSION_FILE, "w") as f:
        json.dump(data, f)


def create_session() -> str:
    token = secrets.token_hex(32)
    _save({"token": token, "last_used": datetime.now(timezone.utc).isoformat()})
    return token


def validate_session(token: str) -> bool:
    data = _load()
    if not data or data.get("token") != token:
        return False
    last_used = datetime.fromisoformat(data["last_used"])
    if datetime.now(timezone.utc) - last_used > TIMEOUT:
        _save({})  # expire it
        return False
    data["last_used"] = datetime.now(timezone.utc).isoformat()
    _save(data)
    return True


def clear_session():
    if os.path.exists(SESSION_FILE):
        os.remove(SESSION_FILE)
