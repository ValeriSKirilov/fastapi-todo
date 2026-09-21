import re
from pydantic import BaseModel, ConfigDict, Field, field_validator

_max_len = 128

_pass_min_len = 8
_pass_max_len = 72

_email_pattern = re.compile(
    r"^(?!.*\.\.)(?!.*\.@)(?!.*@\.)[^@\s\"()\[\];:,<>]+@[^@\s\"()\[\];:,<>]+\.[^@\s\"()\[\];:,<>]{2,}$"
)


def _check_email_format(v: str) -> str:
    if not _email_pattern.match(v):
        raise ValueError("Invalid email format")
    return v


class UserBase(BaseModel):
    email: str = Field(max_length=_max_len)
    first_name: str = Field(max_length=_max_len)
    last_name: str = Field(max_length=_max_len)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _check_email_format(v)


class UserCreate(UserBase):
    password: str = Field(min_length=_pass_min_len, max_length=_pass_max_len)


class UserResponse(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    email: str | None = Field(default=None, max_length=_max_len)
    password: str | None = Field(default=None, min_length=_pass_min_len, max_length=_pass_max_len)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        return _check_email_format(v) if v is not None else v
