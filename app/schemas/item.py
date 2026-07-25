from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ItemBase(BaseModel):
    text: str
    is_done: bool = False


class ItemCreate(ItemBase):
    due_date: datetime | None = None


class ItemResponse(ItemBase):
    id: int
    due_date: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class ItemUpdate(BaseModel):
    text: str | None = None
    is_done: bool | None = None
    due_date: datetime | None = None
