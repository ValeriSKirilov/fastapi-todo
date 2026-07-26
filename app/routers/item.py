from typing import List

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from ..schemas.item import ItemResponse, ItemCreate, ItemUpdate
from ..database import get_db
from ..crud import item as crud
from ..dependencies.auth import get_current_user
from ..models.user import User

router = APIRouter(
    prefix="/items",
    tags=["items"],
    responses={404: {"description": "Not found"}},
)


@router.get("", response_model=List[ItemResponse])
def list_items(
        limit: int = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if limit is None or limit > 0:
        return crud.get_items(db, current_user.id, limit)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid index"
        )


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(
        item_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    item = crud.get_item(db, item_id, current_user.id)
    if item:
        return item
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )


@router.post("", response_model=ItemResponse)
def create_item(
        item: ItemCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    return crud.create_item(db, item, current_user.id)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(
        item_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    item = crud.delete_item(db, item_id, current_user.id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )


@router.put("/{item_id}", response_model=ItemResponse)
def update_item(
        item_id: int,
        new_item: ItemUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    item = crud.update_item(db, item_id, new_item, current_user.id)
    if item:
        return item
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
