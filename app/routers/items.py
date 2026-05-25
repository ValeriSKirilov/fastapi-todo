from fastapi import APIRouter, HTTPException
from app.models import Item

items = []

router = APIRouter(
    prefix="/items",
    tags=["items"],
    responses={404: {"description": "Not found"}},
)


@router.get("", response_model=list[Item])
def list_items(limit: int = None):
    if limit is None:
        return items
    else:
        return items[0:limit]


@router.post("", response_model=list[Item])
def create_item(item: Item):
    items.append(item)
    return items


@router.get("/{item_id}", response_model=Item)
def get_item(item_id: int) -> Item:
    if item_id < len(items):
        return items[item_id]
    else:
        raise HTTPException(status_code=404, detail="Item not found")


@router.delete("/{item_id}")
def remove_item(item_id: int):
    if item_id < len(items):
        del items[item_id]
    else:
        raise HTTPException(status_code=404, detail="Item not found")
