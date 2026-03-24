from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from main import (
    init_db,
    authenticate_user, create_user, get_user_by_id, update_display_name,
    create_session, validate_session, clear_session,
    get_labels, add_label, delete_label,
    get_active_event, start_event, end_active_event,
    get_events, add_event, update_event, delete_event,
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


def require_auth(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> int:
    user_id = validate_session(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")
    return user_id


# --- Request Bodies ---

class RegisterRequest(BaseModel):
    username: str
    display_name: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class UpdateProfileRequest(BaseModel):
    display_name: str

class AddLabelRequest(BaseModel):
    label: str

class StartEventRequest(BaseModel):
    label: str

class ManualEventRequest(BaseModel):
    label: str
    started_at: str
    ended_at: str | None = None

class UpdateEventRequest(BaseModel):
    label: str
    started_at: str
    ended_at: str | None = None


# --- Endpoints ---

@app.get("/")
def serve_frontend():
    return FileResponse("index.html")


@app.post("/register")
def register(body: RegisterRequest):
    username = body.username.strip()
    display_name = body.display_name.strip()
    if not username or not display_name or not body.password:
        raise HTTPException(status_code=400, detail="Username, display name, and password are required.")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    user = create_user(username, display_name, body.password)
    if not user:
        raise HTTPException(status_code=409, detail="Username already taken.")
    token = create_session(user["id"])
    return {"token": token, "display_name": user["display_name"]}


@app.post("/login")
def login(body: LoginRequest):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = create_session(user["id"])
    return {"token": token, "display_name": user["display_name"]}


@app.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    clear_session(credentials.credentials)
    return {"ok": True}


@app.get("/me")
def get_me(user_id: int = Depends(require_auth)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@app.patch("/me")
def update_me(body: UpdateProfileRequest, user_id: int = Depends(require_auth)):
    if not body.display_name.strip():
        raise HTTPException(status_code=400, detail="Display name cannot be empty.")
    user = update_display_name(user_id, body.display_name)
    return user


# --- Labels ---

@app.get("/labels")
def get_labels_endpoint(user_id: int = Depends(require_auth)):
    return {"labels": get_labels(user_id)}


@app.post("/labels")
def add_label_endpoint(body: AddLabelRequest, user_id: int = Depends(require_auth)):
    if not add_label(user_id, body.label):
        raise HTTPException(status_code=400, detail="Invalid label.")
    return {"ok": True, "labels": get_labels(user_id)}


@app.delete("/labels/{label}")
def delete_label_endpoint(label: str, user_id: int = Depends(require_auth)):
    if not delete_label(user_id, label):
        raise HTTPException(status_code=404, detail=f"Label '{label}' not found.")
    return {"ok": True, "labels": get_labels(user_id)}


# --- Events ---

@app.get("/event/active")
def active_event(user_id: int = Depends(require_auth)):
    return {"event": get_active_event(user_id)}


@app.post("/event/start")
def start_event_endpoint(body: StartEventRequest, user_id: int = Depends(require_auth)):
    valid = get_labels(user_id)
    if valid and body.label not in valid:
        raise HTTPException(status_code=400, detail=f"'{body.label}' is not a valid label.")
    return {"event": start_event(user_id, body.label)}


@app.post("/event/end")
def end_event_endpoint(user_id: int = Depends(require_auth)):
    event = end_active_event(user_id)
    if not event:
        raise HTTPException(status_code=404, detail="No active event to end.")
    return {"event": event}


@app.post("/event/manual")
def add_manual_event(body: ManualEventRequest, user_id: int = Depends(require_auth)):
    valid = get_labels(user_id)
    if valid and body.label not in valid:
        raise HTTPException(status_code=400, detail=f"'{body.label}' is not a valid label.")
    return {"event": add_event(user_id, body.label, body.started_at, body.ended_at)}


@app.get("/events")
def list_events(start: str, end: str, user_id: int = Depends(require_auth)):
    return {"events": get_events(user_id, start, end)}


@app.patch("/event/{event_id}")
def update_event_endpoint(event_id: int, body: UpdateEventRequest, user_id: int = Depends(require_auth)):
    event = update_event(user_id, event_id, body.label, body.started_at, body.ended_at)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found.")
    return {"event": event}


@app.delete("/event/{event_id}")
def delete_event_endpoint(event_id: int, user_id: int = Depends(require_auth)):
    if not delete_event(user_id, event_id):
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found.")
    return {"ok": True}


# --- Stats ---

@app.get("/stats")
def get_stats(start: str, end: str, user_id: int = Depends(require_auth)):
    percentages, minutes = get_statistics(user_id, start, end)
    if not percentages:
        raise HTTPException(status_code=404, detail="No data found for the given range.")
    return {"percentages": percentages, "minutes": minutes}
