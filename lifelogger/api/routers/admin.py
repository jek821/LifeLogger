from fastapi import APIRouter, Depends, HTTPException, Request

from lifelogger.api.deps import limiter, require_admin
from lifelogger.api.schemas import AdminResetPasswordRequest
from lifelogger.services.users import admin_set_user_password, delete_user_cascade, list_all_users

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
@limiter.limit("60/minute")
def admin_list_users(request: Request, admin_id: int = Depends(require_admin)):
    return {"users": list_all_users(), "you": admin_id}


@router.delete("/users/{target_id}")
@limiter.limit("30/minute")
def admin_delete_user(
    request: Request,
    target_id: int,
    admin_id: int = Depends(require_admin),
):
    if not delete_user_cascade(target_id, admin_id):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete that user (not found, or you cannot delete your own account here).",
        )
    return {"ok": True}


@router.post("/users/{target_id}/reset-password")
@limiter.limit("20/minute")
def admin_reset_password(
    request: Request,
    target_id: int,
    body: AdminResetPasswordRequest,
    admin_id: int = Depends(require_admin),
):
    if target_id == admin_id:
        raise HTTPException(
            status_code=400,
            detail="Reset your own password from the main app (profile) or use another admin account.",
        )
    if not admin_set_user_password(target_id, body.temporary_password):
        raise HTTPException(status_code=404, detail="User not found.")
    return {"ok": True, "detail": "Temporary password set. All their sessions were signed out."}
