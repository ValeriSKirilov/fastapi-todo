from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    text: str
    is_done: bool = False


items = []


@app.get("/")
def root():
    return {"message": "Hello World"}


@app.get("/items", response_model=list[Item])
def list_items(limit: int = None):
    if limit is None:
        return items
    else:
        return items[0:limit]


@app.post("/items", response_model=list[Item])
def create_item(item: Item):
    items.append(item)
    return items


@app.get("/items/{item_id}", response_model=Item)
def get_item(item_id: int) -> Item:
    if item_id < len(items):
        return items[item_id]
    else:
        raise HTTPException(status_code=404, detail="Item not found")


@app.delete("/items/{item_id}")
def remove_item(item_id: int):
    if item_id < len(items):
        del items[item_id]
    else:
        raise HTTPException(status_code=404, detail="Item not found")
