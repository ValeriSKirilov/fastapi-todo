import re
from pathlib import Path
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, ValidationInfo

_email_pattern = re.compile(
    r'^(?!.*\.\.)(?!.*\.@)(?!.*@\.)[^@\s\'()\[\];:,<>]+@[^@\s\'()\[\];:,<>]+\.[^@\s\'()\[\];:,<>]{2,}$'
)

_password_pattern = re.compile(
    r'^(?=.*[^\W_0-9])(?=.*[0-9]).{8,}$'
)


def _check_email_format(email: str) -> str:
    if not _email_pattern.fullmatch(email):
        raise ValueError('Invalid email format')
    return email


parent_dir = Path(__file__).parent
common_passwords_path = parent_dir.parent / 'core' / 'common_passwords.txt'
COMMON_PASSWORDS = set(common_passwords_path.read_text(encoding='utf-8').split())


class PasswordValidationError(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message


def _check_password_format(password: str, user_info: dict = None) -> str:
    if not _password_pattern.fullmatch(password):
        raise PasswordValidationError('validation.error.password_weak', 'Use at least one letter and one number')
    if len(password.encode('utf-8')) > 72:
        raise PasswordValidationError('validation.error.password_too_long', 'This password is too long')
    if password.lower() in COMMON_PASSWORDS:
        raise PasswordValidationError('validation.error.password_common', 'This password is too common')

    if user_info is not None:
        password_lower = password.lower()
        email_local = user_info.get('email').split('@')[0].lower()
        personal = [
            part for part in
            (email_local, user_info.get('first_name').lower(), user_info.get('last_name').lower())
            if len(part) >= 3
        ]
        if any(part in password_lower for part in personal):
            raise PasswordValidationError(
                'validation.error.password_personal', 'Your password can\'t contain your name or email'
            )

    return password


Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]


class UserBase(BaseModel):
    email: Name
    first_name: Name
    last_name: Name

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        v_lower = v.lower()
        return _check_email_format(v_lower)


class UserCreate(UserBase):
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str, info: ValidationInfo) -> str:
        return _check_password_format(v, {
            'email': info.data.get('email', ''),
            'first_name': info.data.get('first_name', ''),
            'last_name': info.data.get('last_name', ''),
        })


class UserResponse(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    first_name: Name = None
    last_name: Name = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class PasswordValidation(BaseModel):
    password: str
    email: str = ''
    first_name: str = ''
    last_name: str = ''
