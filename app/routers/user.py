from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from ..models.user import User
from ..schemas.user import UserResponse, UserCreate, PasswordChange, PasswordValidation, PasswordValidationError, \
    _check_password_format
from ..database import get_db
from ..crud import user as crud
from ..dependencies.auth import get_current_user
from ..core.security import verify_password

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(
        user: UserCreate,
        db: Session = Depends(get_db),
):
    try:
        return crud.create_user(db, user)
    except crud.DuplicateEmailError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )


@router.put("/password", status_code=status.HTTP_202_ACCEPTED)
def change_password(
        payload: PasswordChange,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )

    try:
        _check_password_format(payload.new_password,
                               {"email": current_user.email, "first_name": current_user.first_name,
                                "last_name": current_user.last_name})
    except PasswordValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": e.code, "message": e.message},
        )

    crud.update_password(db, current_user.id, payload.new_password)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    crud.delete_user(db, current_user.id)


@router.post("/validate-password")
def validate_password(
        payload: PasswordValidation,
):
    try:
        _check_password_format(payload.password, {"email": payload.email, "first_name": payload.first_name,
                                                  "last_name": payload.last_name})
    except PasswordValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": e.code, "message": e.message},
        )

    return {"status": "valid"}
