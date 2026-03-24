from pydantic import BaseModel, Field

from lifelogger.config import LABEL_MAX_LEN


class RegisterRequest(BaseModel):
    username: str
    display_name: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UpdateProfileRequest(BaseModel):
    display_name: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., max_length=256)
    new_password: str = Field(..., min_length=6, max_length=256)


class AddLabelRequest(BaseModel):
    label: str = Field(..., max_length=LABEL_MAX_LEN)


class StartEventRequest(BaseModel):
    label: str = Field(..., max_length=LABEL_MAX_LEN)


class ManualEventRequest(BaseModel):
    label: str = Field(..., max_length=LABEL_MAX_LEN)
    started_at: str
    ended_at: str | None = None


class UpdateEventRequest(BaseModel):
    label: str = Field(..., max_length=LABEL_MAX_LEN)
    started_at: str
    ended_at: str | None = None


class AdminResetPasswordRequest(BaseModel):
    temporary_password: str = Field(..., min_length=6, max_length=256)
