import secrets
from datetime import datetime, timezone

from lifelogger.config import SESSION_TIMEOUT, SESSION_TOUCH_INTERVAL
from lifelogger.db import get_db
from lifelogger.util import now_utc_iso


def create_session(user_id: int) -> str:
    token = secrets.token_hex(32)
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.execute(
            "INSERT INTO sessions (token, user_id, last_used) VALUES (?, ?, ?)",
            (token, user_id, now_utc_iso()),
        )
        conn.commit()
    return token


def validate_session(token: str) -> int | None:
    """Returns user_id if session is valid, None otherwise."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE token = ?", (token,)).fetchone()
        if not row:
            return None
        last_used = datetime.fromisoformat(row["last_used"])
        now = datetime.now(timezone.utc)
        if now - last_used > SESSION_TIMEOUT:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            return None
        if now - last_used >= SESSION_TOUCH_INTERVAL:
            conn.execute("UPDATE sessions SET last_used = ? WHERE token = ?", (now_utc_iso(), token))
            conn.commit()
    return row["user_id"]


def clear_session(token: str):
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
