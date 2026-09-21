from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from ..models.user import User
from ..schemas.user import UserResponse, UserCreate
from ..database import get_db
from ..crud import user as crud
from ..dependencies.auth import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(
        user: UserCreate,
        db: Session = Depends(get_db)
):
    check_user = crud.get_user_by_email(db, user.email)
    if check_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    return crud.create_user(db, user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    crud.delete_user(db, current_user.id)
