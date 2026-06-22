from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from ..core.security import decode_token
from ..crud.user import get_user_by_id
from ..database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
    except InvalidTokenError:
        raise credentials_exception

    user_id = payload["sub"]
    if not user_id:
        raise credentials_exception

    user = get_user_by_id(db, int(user_id))
    if not user:
        raise credentials_exception
    
    return user
