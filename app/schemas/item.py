from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ItemBase(BaseModel):
    text: str
    is_done: bool = False
    is_important: bool = False
    due_date: datetime | None = None


class ItemCreate(ItemBase):
    pass


class ItemResponse(ItemBase):
    id: int
    is_deleted: bool = False
    is_archived: bool = False
    model_config = ConfigDict(from_attributes=True)


class ItemUpdate(BaseModel):
    text: str | None = None
    is_done: bool | None = None
    is_deleted: bool | None = None
    is_important: bool | None = None
    is_archived: bool | None = None
    due_date: datetime | None = None
