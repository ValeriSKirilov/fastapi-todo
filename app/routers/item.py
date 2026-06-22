from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..schemas.item import ItemResponse, ItemCreate, ItemUpdate
from ..database import get_db
from ..crud import item as crud

router = APIRouter(
    prefix="/items",
    tags=["items"],
    responses={404: {"description": "Not found"}},
)


@router.get("", response_model=List[ItemResponse])
def list_items(limit: int = None, db: Session = Depends(get_db)):
    if limit is None or limit > 0:
        return crud.get_items(db, limit)
    else:
        raise HTTPException(status_code=400, detail="Invalid index")


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = crud.get_item(db, item_id)
    if item:
        return item
    else:
        raise HTTPException(status_code=404, detail="Item not found")


@router.post("", response_model=ItemResponse)
def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    return crud.create_item(db, item)


@router.delete("/{item_id}", status_code=204)
def remove_item(item_id: int, db: Session = Depends(get_db)):
    item = crud.delete_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")


@router.put("/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, new_item: ItemUpdate, db: Session = Depends(get_db)):
    item = crud.update_item(db, item_id, new_item)
    if item:
        return item
    else:
        raise HTTPException(status_code=404, detail="Item not found")
