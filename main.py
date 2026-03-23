import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta

DB_PATH = "timelogger.db"

SEED_LABELS = {"Programming"}  # initial labels seeded into the DB on first run


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS entries (
                date  TEXT NOT NULL,
                time  TEXT NOT NULL,
                label TEXT NOT NULL,
                PRIMARY KEY (date, time)
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


def get_labels() -> list[str]:
    with get_db() as conn:
        rows = conn.execute("SELECT label FROM labels ORDER BY label").fetchall()
    return [r[0] for r in rows]


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


def update_time_entry(date: str, time: str, value: str) -> bool:
    valid = get_labels()
    if valid and value not in valid:
        return False
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO entries (date, time, label) VALUES (?, ?, ?)",
            (date, time, value),
        )
        conn.commit()
    return True


def get_statistics(start_date: str, end_date: str) -> tuple[dict[str, float], dict[str, int]]:
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    dates = []
    current = start
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)

    with get_db() as conn:
        placeholders = ",".join("?" * len(dates))
        rows = conn.execute(
            f"SELECT label, COUNT(*) FROM entries WHERE date IN ({placeholders}) GROUP BY label",
            dates,
        ).fetchall()

    if not rows:
        return {}, {}

    label_minutes = {label: count * 15 for label, count in rows}
    total = sum(label_minutes.values())
    percentages = {label: round(mins / total * 100, 2) for label, mins in label_minutes.items()}
    return percentages, label_minutes


def get_time_range(start: str, end: str) -> list[str]:
    try:
        fmt = "%-I:%M %p"
        current = datetime.strptime(start, fmt)
        stop = datetime.strptime(end, fmt)
    except ValueError:
        fmt = "%#I:%M %p"
        current = datetime.strptime(start, fmt)
        stop = datetime.strptime(end, fmt)
    times = []
    while current < stop:
        times.append(current.strftime(fmt))
        current += timedelta(minutes=15)
    return times


if __name__ == "__main__":
    init_db()
    print("Database initialized.")
