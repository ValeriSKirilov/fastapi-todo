from pydantic import BaseModel


class Item(BaseModel):
    text: str
    is_done: bool = False
