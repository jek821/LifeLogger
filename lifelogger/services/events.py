from datetime import datetime

from lifelogger.db import get_db
from lifelogger.util import now_utc_iso


def _row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "label": row["label"],
        "started_at": row["started_at"],
        "ended_at": row["ended_at"],
    }


def get_active_event(user_id: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM events WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
            (user_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def start_event(user_id: int, label: str) -> dict:
    now = now_utc_iso()
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
    now = now_utc_iso()
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


def update_event(
    user_id: int, event_id: int, label: str, started_at: str, ended_at: str | None
) -> dict | None:
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

    now = now_utc_iso()
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
