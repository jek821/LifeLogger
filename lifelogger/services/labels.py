from lifelogger.config import LABEL_MAX_LEN
from lifelogger.db import get_db


def get_labels(user_id: int) -> list[str]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT label FROM labels WHERE user_id = ? ORDER BY label", (user_id,)
        ).fetchall()
    return [r["label"] for r in rows]


def add_label(user_id: int, label: str) -> bool:
    label = label.strip()
    if not label or len(label) > LABEL_MAX_LEN:
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
