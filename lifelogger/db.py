import sqlite3
from contextlib import contextmanager

from lifelogger.config import DB_PATH


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT UNIQUE NOT NULL,
                display_name  TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL
            )
        """)

        user_cols = [r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "is_admin" not in user_cols:
            conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")

        n_admins = conn.execute("SELECT COUNT(*) FROM users WHERE is_admin = 1").fetchone()[0]
        if n_admins == 0:
            first = conn.execute("SELECT MIN(id) FROM users").fetchone()[0]
            if first is not None:
                conn.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (first,))

        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token     TEXT PRIMARY KEY,
                user_id   INTEGER NOT NULL REFERENCES users(id),
                last_used TEXT NOT NULL
            )
        """)

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
