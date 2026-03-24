import hashlib
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

DB_PATH = "timelogger.db"
SESSION_TIMEOUT = timedelta(hours=1)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_password(password: str) -> str:
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return salt.hex() + ":" + key.hex()


def _verify_password(password: str, stored: str) -> bool:
    salt_hex, key_hex = stored.split(":", 1)
    salt = bytes.fromhex(salt_hex)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return secrets.compare_digest(key.hex(), key_hex)


def init_db():
    with get_db() as conn:
        conn.execute("DROP TABLE IF EXISTS entries")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT UNIQUE NOT NULL,
                display_name  TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token     TEXT PRIMARY KEY,
                user_id   INTEGER NOT NULL REFERENCES users(id),
                last_used TEXT NOT NULL
            )
        """)

        # Events: create fresh or migrate existing table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER REFERENCES users(id),
                label      TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at   TEXT
            )
        """)
        event_cols = [r[1] for r in conn.execute("PRAGMA table_info(events)").fetchall()]
        if "user_id" not in event_cols:
            conn.execute("ALTER TABLE events ADD COLUMN user_id INTEGER REFERENCES users(id)")

        # Labels: recreate with composite PK (user_id, label) if old schema detected
        label_cols = [r[1] for r in conn.execute("PRAGMA table_info(labels)").fetchall()]
        if "user_id" not in label_cols:
            conn.execute("DROP TABLE IF EXISTS labels")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS labels (
                user_id INTEGER NOT NULL REFERENCES users(id),
                label   TEXT NOT NULL,
                PRIMARY KEY (user_id, label)
            )
        """)

        conn.commit()


# --- Users ---

def _user_to_dict(row) -> dict:
    return {
        "id":           row["id"],
        "username":     row["username"],
        "display_name": row["display_name"],
        "created_at":   row["created_at"],
    }


def create_user(username: str, display_name: str, password: str) -> dict | None:
    try:
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO users (username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (username.strip().lower(), display_name.strip(), _hash_password(password), _now_utc()),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        return _user_to_dict(row)
    except sqlite3.IntegrityError:
        return None  # username already taken


def authenticate_user(username: str, password: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username.strip().lower(),)
        ).fetchone()
    if not row or not _verify_password(password, row["password_hash"]):
        return None
    return _user_to_dict(row)


def get_user_by_id(user_id: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_to_dict(row) if row else None


def update_display_name(user_id: int, display_name: str) -> dict | None:
    with get_db() as conn:
        conn.execute("UPDATE users SET display_name = ? WHERE id = ?", (display_name.strip(), user_id))
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_to_dict(row) if row else None


# --- Sessions ---

def create_session(user_id: int) -> str:
    token = secrets.token_hex(32)
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.execute(
            "INSERT INTO sessions (token, user_id, last_used) VALUES (?, ?, ?)",
            (token, user_id, _now_utc()),
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
        if datetime.now(timezone.utc) - last_used > SESSION_TIMEOUT:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            return None
        conn.execute("UPDATE sessions SET last_used = ? WHERE token = ?", (_now_utc(), token))
        conn.commit()
    return row["user_id"]


def clear_session(token: str):
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


# --- Labels ---

def get_labels(user_id: int) -> list[str]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT label FROM labels WHERE user_id = ? ORDER BY label", (user_id,)
        ).fetchall()
    return [r["label"] for r in rows]


def add_label(user_id: int, label: str) -> bool:
    label = label.strip()
    if not label:
        return False
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO labels (user_id, label) VALUES (?, ?)", (user_id, label))
        conn.commit()
    return True


def delete_label(user_id: int, label: str) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM labels WHERE user_id = ? AND label = ?", (user_id, label))
        conn.commit()
    return cur.rowcount > 0


# --- Events ---

def _row_to_dict(row) -> dict:
    return {
        "id":         row["id"],
        "label":      row["label"],
        "started_at": row["started_at"],
        "ended_at":   row["ended_at"],
    }


def get_active_event(user_id: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM events WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
            (user_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def start_event(user_id: int, label: str) -> dict:
    now = _now_utc()
    with get_db() as conn:
        conn.execute(
            "UPDATE events SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL",
            (now, user_id),
        )
        cur = conn.execute(
            "INSERT INTO events (user_id, label, started_at) VALUES (?, ?, ?)",
            (user_id, label, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_dict(row)


def end_active_event(user_id: int) -> dict | None:
    now = _now_utc()
    with get_db() as conn:
        conn.execute(
            "UPDATE events SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL",
            (now, user_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM events WHERE user_id = ? AND ended_at = ? ORDER BY id DESC LIMIT 1",
            (user_id, now),
        ).fetchone()
    return _row_to_dict(row) if row else None


def get_events(user_id: int, start_utc: str, end_utc: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM events
            WHERE user_id = ? AND started_at >= ? AND started_at < ?
            ORDER BY started_at ASC
            """,
            (user_id, start_utc, end_utc),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def add_event(user_id: int, label: str, started_at: str, ended_at: str | None) -> dict:
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO events (user_id, label, started_at, ended_at) VALUES (?, ?, ?, ?)",
            (user_id, label, started_at, ended_at),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_dict(row)


def update_event(user_id: int, event_id: int, label: str, started_at: str, ended_at: str | None) -> dict | None:
    with get_db() as conn:
        conn.execute(
            "UPDATE events SET label = ?, started_at = ?, ended_at = ? WHERE id = ? AND user_id = ?",
            (label, started_at, ended_at, event_id, user_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM events WHERE id = ? AND user_id = ?", (event_id, user_id)
        ).fetchone()
    return _row_to_dict(row) if row else None


def delete_event(user_id: int, event_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM events WHERE id = ? AND user_id = ?", (event_id, user_id))
        conn.commit()
    return cur.rowcount > 0


def get_statistics(user_id: int, start_utc: str, end_utc: str) -> tuple[dict[str, float], dict[str, float]]:
    events = get_events(user_id, start_utc, end_utc)
    if not events:
        return {}, {}

    now = _now_utc()
    label_seconds: dict[str, float] = {}

    for event in events:
        end = event["ended_at"] or now
        started = datetime.fromisoformat(event["started_at"])
        ended = datetime.fromisoformat(end)
        duration = (ended - started).total_seconds()
        label_seconds[event["label"]] = label_seconds.get(event["label"], 0) + duration

    total = sum(label_seconds.values())
    label_minutes = {label: round(secs / 60, 1) for label, secs in label_seconds.items()}
    percentages = {label: round(secs / total * 100, 2) for label, secs in label_seconds.items()}
    return percentages, label_minutes


if __name__ == "__main__":
    init_db()
    print("Database initialized.")
