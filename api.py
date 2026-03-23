from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from config import USERNAME, PASSWORD
from session import create_session, validate_session, clear_session
from main import init_db, update_time_entry, get_statistics, get_time_range, get_labels, add_label, delete_label

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

class SingleEntryRequest(BaseModel):
    date: str
    time: str
    label: str

class RangeEntryRequest(BaseModel):
    date: str
    start_time: str
    end_time: str
    label: str

class AddLabelRequest(BaseModel):
    label: str


# --- Endpoints ---

@app.get("/")
def serve_frontend():
    return FileResponse("index.html")


@app.post("/login")
def login(body: LoginRequest):
    if body.username != USERNAME or body.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = create_session()
    return {"token": token}


@app.post("/logout")
def logout(_: None = Depends(require_auth)):
    clear_session()
    return {"ok": True}


@app.get("/labels")
def get_labels_endpoint(_: None = Depends(require_auth)):
    return {"labels": get_labels()}


@app.post("/labels")
def add_label_endpoint(body: AddLabelRequest, _: None = Depends(require_auth)):
    success = add_label(body.label)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid label.")
    return {"ok": True, "labels": get_labels()}


@app.delete("/labels/{label}")
def delete_label_endpoint(label: str, _: None = Depends(require_auth)):
    success = delete_label(label)
    if not success:
        raise HTTPException(status_code=404, detail=f"Label '{label}' not found.")
    return {"ok": True, "labels": get_labels()}


@app.post("/entry")
def set_entry(body: SingleEntryRequest, _: None = Depends(require_auth)):
    success = update_time_entry(body.date, body.time, body.label)
    if not success:
        raise HTTPException(status_code=400, detail=f"'{body.label}' is not a valid label.")
    return {"ok": True}


@app.post("/entry/range")
def set_entry_range(body: RangeEntryRequest, _: None = Depends(require_auth)):
    times = get_time_range(body.start_time, body.end_time)
    if not times:
        raise HTTPException(status_code=400, detail="No time slots in the given range.")
    failed = [t for t in times if not update_time_entry(body.date, t, body.label)]
    if failed:
        raise HTTPException(status_code=400, detail=f"Failed to update slots: {failed}")
    return {"ok": True, "updated": times}


@app.get("/stats")
def get_stats(start_date: str, end_date: str, _: None = Depends(require_auth)):
    percentages, minutes = get_statistics(start_date, end_date)
    if not percentages:
        raise HTTPException(status_code=404, detail="No data found for the given date range.")
    return {"percentages": percentages, "minutes": minutes}
