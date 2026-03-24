from datetime import datetime, timezone

from fastapi import HTTPException


def parse_utc_datetime(s: str) -> str:
    """Validate ISO datetime; return normalized UTC ISO string for storage."""
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid datetime. Use ISO 8601 with timezone (e.g. ...Z or +00:00).",
        )
    if dt.tzinfo is None:
        raise HTTPException(status_code=400, detail="Datetime must include a timezone.")
    return dt.astimezone(timezone.utc).isoformat()


def parse_optional_utc_datetime(s: str | None) -> str | None:
    if s is None or s == "":
        return None
    return parse_utc_datetime(s)


def validate_event_range(started_iso: str, ended_iso: str | None) -> None:
    if ended_iso is None:
        return
    if parse_utc_datetime(ended_iso) < parse_utc_datetime(started_iso):
        raise HTTPException(status_code=400, detail="End time must be on or after start time.")
