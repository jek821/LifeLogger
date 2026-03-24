import hashlib
import os
import secrets
import sqlite3

from lifelogger.db import get_db
from lifelogger.util import now_utc_iso


def _hash_password(password: str) -> str:
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return salt.hex() + ":" + key.hex()


def _verify_password(password: str, stored: str) -> bool:
    salt_hex, key_hex = stored.split(":", 1)
    salt = bytes.fromhex(salt_hex)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return secrets.compare_digest(key.hex(), key_hex)


def _user_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "created_at": row["created_at"],
        "is_admin": bool(row["is_admin"]),
    }


def create_user(username: str, display_name: str, password: str) -> dict | None:
    try:
        with get_db() as conn:
            n_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            is_admin = 1 if n_users == 0 else 0
            cur = conn.execute(
                """
                INSERT INTO users (username, display_name, password_hash, created_at, is_admin)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    username.strip().lower(),
                    display_name.strip(),
                    _hash_password(password),
                    now_utc_iso(),
                    is_admin,
                ),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        return _user_to_dict(row)
    except sqlite3.IntegrityError:
        return None


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


def verify_user_password(user_id: int, password: str) -> bool:
    with get_db() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    return bool(row and _verify_password(password, row["password_hash"]))


def update_username(user_id: int, new_username: str) -> dict | None:
    new_username = new_username.strip().lower()
    if not new_username:
        return None
    try:
        with get_db() as conn:
            cur = conn.execute("UPDATE users SET username = ? WHERE id = ?", (new_username, user_id))
            if cur.rowcount == 0:
                return None
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _user_to_dict(row) if row else None
    except sqlite3.IntegrityError:
        return None


def change_password(user_id: int, current_password: str, new_password: str) -> bool:
    with get_db() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row or not _verify_password(current_password, row["password_hash"]):
            return False
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (_hash_password(new_password), user_id),
        )
        conn.commit()
    return True


def user_is_admin(user_id: int) -> bool:
    with get_db() as conn:
        row = conn.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,)).fetchone()
    return bool(row and row["is_admin"])


def list_all_users() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, username, display_name, created_at, is_admin FROM users ORDER BY id"
        ).fetchall()
    return [
        {
            "id": r["id"],
            "username": r["username"],
            "display_name": r["display_name"],
            "created_at": r["created_at"],
            "is_admin": bool(r["is_admin"]),
        }
        for r in rows
    ]


def can_delete_own_account(user_id: int) -> tuple[bool, str | None]:
    if not user_is_admin(user_id):
        return True, None
    with get_db() as conn:
        n = conn.execute("SELECT COUNT(*) FROM users WHERE is_admin = 1").fetchone()[0]
    if n <= 1:
        return (
            False,
            "You are the only administrator. Promote another user to admin before deleting your account.",
        )
    return True, None


def delete_own_account(user_id: int, password: str) -> tuple[bool, str | None]:
    """
    Delete this user and all their sessions, labels, and events.
    Returns (True, None) on success, or (False, error_detail) where error_detail is
    either 'wrong_password' or a human-readable string for HTTP 400.
    """
    if not verify_user_password(user_id, password):
        return False, "wrong_password"
    allowed, err = can_delete_own_account(user_id)
    if not allowed:
        return False, err
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM labels WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM events WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    return True, None


def delete_user_cascade(target_id: int, admin_id: int) -> bool:
    if target_id == admin_id:
        return False
    with get_db() as conn:
        row = conn.execute("SELECT id FROM users WHERE id = ?", (target_id,)).fetchone()
        if not row:
            return False
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (target_id,))
        conn.execute("DELETE FROM labels WHERE user_id = ?", (target_id,))
        conn.execute("DELETE FROM events WHERE user_id = ?", (target_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (target_id,))
        conn.commit()
    return True


def admin_set_user_password(user_id: int, password: str) -> bool:
    with get_db() as conn:
        row = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return False
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (_hash_password(password), user_id),
        )
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.commit()
    return True
