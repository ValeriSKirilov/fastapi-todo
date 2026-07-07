from typing import Annotated

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from jwt.exceptions import InvalidTokenError

from ..models.user import User
from ..schemas.user import UserResponse
from ..schemas.token import Token, TokenRefreshRequest
from ..database import get_db
from ..crud import user as crud
from ..dependencies.auth import get_current_user, credentials_exception
from ..core.security import verify_password, create_access_token, create_refresh_token, decode_token

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)


@router.post("/login", response_model=Token)
def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, form_data.username)

    if not user:
        raise credentials_exception

    if not verify_password(form_data.password, user.hashed_password):
        raise credentials_exception

    access_token = create_access_token(user_data={"id": str(user.id)})
    refresh_token = create_refresh_token(user_data={"id": str(user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/refresh", response_model=Token)
def refresh_access_token(request: TokenRefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(request.refresh_token)
    except InvalidTokenError:
        raise credentials_exception

    if payload.get("type") != "refresh":
        raise credentials_exception

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    if not crud.get_user_by_id(db, int(user_id)):
        raise credentials_exception

    access_token = create_access_token(user_data={"id": str(user_id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": request.refresh_token
    }


@router.post("/logout")
def logout():
    return {"detail": "Successfully logged out"}
