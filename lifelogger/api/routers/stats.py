from fastapi import APIRouter, Depends, HTTPException

from lifelogger.api.deps import require_auth
from lifelogger.api.validators import parse_utc_datetime
from lifelogger.services.events import get_statistics

router = APIRouter(tags=["statistics"])


@router.get("/stats")
def get_stats(start: str, end: str, user_id: int = Depends(require_auth)):
    start_n = parse_utc_datetime(start)
    end_n = parse_utc_datetime(end)
    if end_n < start_n:
        raise HTTPException(status_code=400, detail="End must be on or after start.")
    percentages, minutes = get_statistics(user_id, start_n, end_n)
    if not percentages:
        raise HTTPException(status_code=404, detail="No data found for the given range.")
    return {"percentages": percentages, "minutes": minutes}
