from datetime import datetime, timedelta, timezone
import jwt
import pytest

from app.core import security
from app.config import settings


def test_hash_password():
    assert security.hash_password("password") != "password"


def test_verify_password():
    assert security.verify_password("password", security.hash_password("password"))


def test_verify_password_wrong():
    assert not security.verify_password("wrong", security.hash_password("password"))


def test_create_access_token():
    token = security.create_access_token({"id": 1})
    payload = security.decode_token(token)
    assert payload['sub'] == '1'
    assert payload['type'] == 'access'


def test_create_refresh_token():
    token = security.create_refresh_token({"id": 1})
    payload = security.decode_token(token)
    assert payload['sub'] == '1'
    assert payload['type'] == 'refresh'


def test_decode_token():
    token = security.create_access_token({"id": 1})
    payload = security.decode_token(token)
    assert payload['sub'] == '1'


def test_expired_token():
    payload = {}
    payload['sub'] = '1'
    payload['exp'] = datetime.now(timezone.utc) - timedelta(minutes=5)

    token = jwt.encode(
        payload=payload,
        key=settings.SECRET_KEY,
        algorithm="HS256",
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        security.decode_token(token)


def test_invalid_token():
    token = security.create_access_token({"id": 1})

    with pytest.raises(jwt.InvalidTokenError):
        security.decode_token(token + "1")
