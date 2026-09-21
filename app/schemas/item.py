from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

_title_max_len = 255
_desc_max_len = 10000


class ItemBase(BaseModel):
    title: str = Field(max_length=_title_max_len)
    description: str | None = Field(default=None, max_length=_desc_max_len)
    is_done: bool = False
    is_important: bool = False
    due_date: datetime | None = None
    parent_id: int | None = None
    project_id: int | None = None


class ItemCreate(ItemBase):
    pass


class ItemResponse(ItemBase):
    id: int
    is_deleted: bool = False
    is_archived: bool = False
    deleted_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class ItemUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=_title_max_len)
    description: str | None = Field(default=None, max_length=_desc_max_len)
    is_done: bool | None = None
    is_deleted: bool | None = None
    is_important: bool | None = None
    is_archived: bool | None = None
    deleted_at: datetime | None = None
    due_date: datetime | None = None
    parent_id: int | None = None
    project_id: int | None = None
