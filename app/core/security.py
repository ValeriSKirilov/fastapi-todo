from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import uuid

from ..config import settings


def hash_password(password: str) -> str:
    plainBytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hash = bcrypt.hashpw(plainBytes, salt)

    return hash.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    plainBytes = plain_password.encode("utf-8")
    userBytes = hashed_password.encode("utf-8")

    return bcrypt.checkpw(plainBytes, userBytes)


def create_access_token(user_data: dict) -> str:
    payload = {}

    payload['sub'] = str(user_data['id'])
    payload['exp'] = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload['jti'] = str(uuid.uuid4())
    payload['type'] = 'access'

    token = jwt.encode(
        payload=payload,
        key=settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    return token


def create_refresh_token(user_data: dict) -> str:
    payload = {}

    payload['sub'] = str(user_data['id'])
    payload['exp'] = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload['jti'] = str(uuid.uuid4())
    payload['type'] = 'refresh'

    token = jwt.encode(
        payload=payload,
        key=settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    return token