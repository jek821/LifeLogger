from fastapi import APIRouter, Depends, HTTPException

from lifelogger.api.deps import require_auth
from lifelogger.api.schemas import ManualEventRequest, StartEventRequest, UpdateEventRequest
from lifelogger.api.validators import parse_optional_utc_datetime, parse_utc_datetime, validate_event_range
from lifelogger.services.events import (
    add_event,
    delete_event,
    end_active_event,
    get_active_event,
    get_events,
    start_event,
    update_event,
)
from lifelogger.services.labels import get_labels

router = APIRouter(tags=["events"])


@router.get("/event/active")
def active_event(user_id: int = Depends(require_auth)):
    return {"event": get_active_event(user_id)}


@router.post("/event/start")
def start_event_endpoint(body: StartEventRequest, user_id: int = Depends(require_auth)):
    valid = get_labels(user_id)
    if valid and body.label not in valid:
        raise HTTPException(status_code=400, detail=f"'{body.label}' is not a valid label.")
    return {"event": start_event(user_id, body.label)}


@router.post("/event/end")
def end_event_endpoint(user_id: int = Depends(require_auth)):
    event = end_active_event(user_id)
    if not event:
        raise HTTPException(status_code=404, detail="No active event to end.")
    return {"event": event}


@router.post("/event/manual")
def add_manual_event(body: ManualEventRequest, user_id: int = Depends(require_auth)):
    valid = get_labels(user_id)
    if valid and body.label not in valid:
        raise HTTPException(status_code=400, detail=f"'{body.label}' is not a valid label.")
    started = parse_utc_datetime(body.started_at)
    ended = parse_optional_utc_datetime(body.ended_at)
    validate_event_range(started, ended)
    return {"event": add_event(user_id, body.label, started, ended)}


@router.get("/events")
def list_events(start: str, end: str, user_id: int = Depends(require_auth)):
    start_n = parse_utc_datetime(start)
    end_n = parse_utc_datetime(end)
    if end_n < start_n:
        raise HTTPException(status_code=400, detail="End must be on or after start.")
    return {"events": get_events(user_id, start_n, end_n)}


@router.patch("/event/{event_id}")
def update_event_endpoint(event_id: int, body: UpdateEventRequest, user_id: int = Depends(require_auth)):
    started = parse_utc_datetime(body.started_at)
    ended = parse_optional_utc_datetime(body.ended_at)
    validate_event_range(started, ended)
    event = update_event(user_id, event_id, body.label, started, ended)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found.")
    return {"event": event}


@router.delete("/event/{event_id}")
def delete_event_endpoint(event_id: int, user_id: int = Depends(require_auth)):
    if not delete_event(user_id, event_id):
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found.")
    return {"ok": True}
