from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from config import USERNAME, PASSWORD
from session import create_session, validate_session, clear_session
from main import (
    init_db,
    get_labels, add_label, delete_label,
    get_active_event, start_event, end_active_event,
    get_events, update_event, delete_event,
    get_statistics,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

bearer = HTTPBearer()


def require_auth(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if not validate_session(credentials.credentials):
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")


# --- Request Bodies ---

class LoginRequest(BaseModel):
    username: str
    password: str

class AddLabelRequest(BaseModel):
    label: str

class StartEventRequest(BaseModel):
    label: str

class UpdateEventRequest(BaseModel):
    label: str
    started_at: str   # UTC ISO string
    ended_at: str | None = None


# --- Endpoints ---

@app.get("/")
def serve_frontend():
    return FileResponse("index.html")


@app.post("/login")
def login(body: LoginRequest):
    if body.username != USERNAME or body.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    return {"token": create_session()}


@app.post("/logout")
def logout(_: None = Depends(require_auth)):
    clear_session()
    return {"ok": True}


# --- Labels ---

@app.get("/labels")
def get_labels_endpoint(_: None = Depends(require_auth)):
    return {"labels": get_labels()}


@app.post("/labels")
def add_label_endpoint(body: AddLabelRequest, _: None = Depends(require_auth)):
    if not add_label(body.label):
        raise HTTPException(status_code=400, detail="Invalid label.")
    return {"ok": True, "labels": get_labels()}


@app.delete("/labels/{label}")
def delete_label_endpoint(label: str, _: None = Depends(require_auth)):
    if not delete_label(label):
        raise HTTPException(status_code=404, detail=f"Label '{label}' not found.")
    return {"ok": True, "labels": get_labels()}


# --- Events ---

@app.get("/event/active")
def active_event(_: None = Depends(require_auth)):
    return {"event": get_active_event()}


@app.post("/event/start")
def start_event_endpoint(body: StartEventRequest, _: None = Depends(require_auth)):
    valid = get_labels()
    if valid and body.label not in valid:
        raise HTTPException(status_code=400, detail=f"'{body.label}' is not a valid label.")
    return {"event": start_event(body.label)}


@app.post("/event/end")
def end_event_endpoint(_: None = Depends(require_auth)):
    event = end_active_event()
    if not event:
        raise HTTPException(status_code=404, detail="No active event to end.")
    return {"event": event}


@app.get("/events")
def list_events(start: str, end: str, _: None = Depends(require_auth)):
    return {"events": get_events(start, end)}


@app.patch("/event/{event_id}")
def update_event_endpoint(event_id: int, body: UpdateEventRequest, _: None = Depends(require_auth)):
    event = update_event(event_id, body.label, body.started_at, body.ended_at)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found.")
    return {"event": event}


@app.delete("/event/{event_id}")
def delete_event_endpoint(event_id: int, _: None = Depends(require_auth)):
    if not delete_event(event_id):
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found.")
    return {"ok": True}


# --- Stats ---

@app.get("/stats")
def get_stats(start: str, end: str, _: None = Depends(require_auth)):
    percentages, minutes = get_statistics(start, end)
    if not percentages:
        raise HTTPException(status_code=404, detail="No data found for the given range.")
    return {"percentages": percentages, "minutes": minutes}
