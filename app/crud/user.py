from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..models.user import User
from ..schemas.user import UserCreate
from ..core.security import hash_password


class DuplicateEmailError(Exception):
    pass


def get_user_by_email(db: Session, user_email: str):
    return db.query(User).filter(func.lower(User.email) == func.lower(user_email)).first()


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user: UserCreate):
    hashed_password = hash_password(user.password)

    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name
    )

    db.add(db_user)

    try:
        db.commit()
        db.refresh(db_user)
        return db_user
    except IntegrityError:
        db.rollback()
        raise DuplicateEmailError("Email already registered")


def delete_user(db: Session, user_id: int):
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()

    return db_user


def update_password(db: Session, user_id: int, new_password: str):
    db_user = db.query(User).filter(User.id == user_id).first()

    if db_user:
        db_user.hashed_password = hash_password(new_password)
        db.commit()
        db.refresh(db_user)

    return db_user
