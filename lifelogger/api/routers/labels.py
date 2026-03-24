from fastapi import APIRouter, Depends, HTTPException

from lifelogger.api.deps import require_auth
from lifelogger.api.schemas import AddLabelRequest
from lifelogger.config import LABEL_MAX_LEN
from lifelogger.services.labels import add_label, delete_label, get_labels

router = APIRouter(tags=["labels"])


@router.get("/labels")
def get_labels_endpoint(user_id: int = Depends(require_auth)):
    return {"labels": get_labels(user_id)}


@router.post("/labels")
def add_label_endpoint(body: AddLabelRequest, user_id: int = Depends(require_auth)):
    if not add_label(user_id, body.label):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid label (empty or longer than {LABEL_MAX_LEN} characters).",
        )
    return {"ok": True, "labels": get_labels(user_id)}


@router.delete("/labels/{label}")
def delete_label_endpoint(label: str, user_id: int = Depends(require_auth)):
    if not delete_label(user_id, label):
        raise HTTPException(status_code=404, detail=f"Label '{label}' not found.")
    return {"ok": True, "labels": get_labels(user_id)}
