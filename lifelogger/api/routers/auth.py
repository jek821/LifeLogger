from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials

from lifelogger.api.deps import bearer, limiter, require_auth
from lifelogger.api.schemas import (
    ChangePasswordRequest,
    ChangeUsernameRequest,
    DeleteAccountRequest,
    LoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
)
from lifelogger.services.sessions import clear_session, create_session
from lifelogger.services.users import (
    authenticate_user,
    change_password,
    create_user,
    delete_own_account,
    get_user_by_id,
    update_display_name,
    update_username,
    verify_user_password,
)

router = APIRouter(tags=["auth"])


@router.post("/register")
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest):
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
    return {"token": token, "display_name": user["display_name"], "is_admin": user["is_admin"]}


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = create_session(user["id"])
    return {"token": token, "display_name": user["display_name"], "is_admin": user["is_admin"]}


@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    clear_session(credentials.credentials)
    return {"ok": True}


@router.get("/me")
def get_me(user_id: int = Depends(require_auth)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@router.patch("/me")
def update_me(body: UpdateProfileRequest, user_id: int = Depends(require_auth)):
    if not body.display_name.strip():
        raise HTTPException(status_code=400, detail="Display name cannot be empty.")
    user = update_display_name(user_id, body.display_name)
    return user


@router.post("/me/change-password")
@limiter.limit("10/minute")
def change_password_endpoint(
    request: Request, body: ChangePasswordRequest, user_id: int = Depends(require_auth)
):
    if not change_password(user_id, body.current_password, body.new_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    return {"ok": True, "detail": "Password updated. Use it next time you sign in."}


@router.patch("/me/username")
@limiter.limit("10/minute")
def change_username_endpoint(
    request: Request, body: ChangeUsernameRequest, user_id: int = Depends(require_auth)
):
    if not verify_user_password(user_id, body.current_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    user = update_username(user_id, body.username)
    if not user:
        raise HTTPException(status_code=409, detail="Username already taken or invalid.")
    token = create_session(user_id)
    return {**user, "token": token}


@router.post("/me/delete-account")
@limiter.limit("5/minute")
def delete_account_endpoint(
    request: Request, body: DeleteAccountRequest, user_id: int = Depends(require_auth)
):
    ok, err = delete_own_account(user_id, body.password)
    if not ok:
        if err == "wrong_password":
            raise HTTPException(status_code=400, detail="Password is incorrect.")
        raise HTTPException(status_code=400, detail=err)
    return {"ok": True, "detail": "Account and all associated data were removed."}
