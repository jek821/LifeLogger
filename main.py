import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

DB_PATH = "timelogger.db"

SEED_LABELS = {"Programming"}  # initial labels seeded into the DB on first run


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("DROP TABLE IF EXISTS entries")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                label      TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at   TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS labels (
                label TEXT PRIMARY KEY
            )
        """)
        for label in SEED_LABELS:
            conn.execute("INSERT OR IGNORE INTO labels (label) VALUES (?)", (label,))
        conn.commit()


# --- Labels ---

def get_labels() -> list[str]:
    with get_db() as conn:
        rows = conn.execute("SELECT label FROM labels ORDER BY label").fetchall()
    return [r["label"] for r in rows]


def add_label(label: str) -> bool:
    label = label.strip()
    if not label:
        return False
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO labels (label) VALUES (?)", (label,))
        conn.commit()
    return True


def delete_label(label: str) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM labels WHERE label = ?", (label,))
        conn.commit()
    return cur.rowcount > 0


# --- Events ---

def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row) -> dict:
    return {
        "id":         row["id"],
        "label":      row["label"],
        "started_at": row["started_at"],
        "ended_at":   row["ended_at"],
    }


def get_active_event() -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM events WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1"
        ).fetchone()
    return _row_to_dict(row) if row else None


def start_event(label: str) -> dict:
    now = _now_utc()
    with get_db() as conn:
        # end any currently active event
        conn.execute(
            "UPDATE events SET ended_at = ? WHERE ended_at IS NULL",
            (now,),
        )
        cur = conn.execute(
            "INSERT INTO events (label, started_at) VALUES (?, ?)",
            (label, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_dict(row)


def end_active_event() -> dict | None:
    now = _now_utc()
    with get_db() as conn:
        conn.execute(
            "UPDATE events SET ended_at = ? WHERE ended_at IS NULL",
            (now,),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM events WHERE ended_at = ? ORDER BY id DESC LIMIT 1",
            (now,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def get_events(start_utc: str, end_utc: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM events
            WHERE started_at >= ? AND started_at < ?
            ORDER BY started_at ASC
            """,
            (start_utc, end_utc),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def update_event(event_id: int, label: str, started_at: str, ended_at: str | None) -> dict | None:
    with get_db() as conn:
        conn.execute(
            "UPDATE events SET label = ?, started_at = ?, ended_at = ? WHERE id = ?",
            (label, started_at, ended_at, event_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    return _row_to_dict(row) if row else None


def delete_event(event_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.commit()
    return cur.rowcount > 0


def get_statistics(start_utc: str, end_utc: str) -> tuple[dict[str, float], dict[str, float]]:
    events = get_events(start_utc, end_utc)
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
