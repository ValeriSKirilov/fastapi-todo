from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from datetime import datetime
from decimal import Decimal

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=10000)]


class ItemBase(BaseModel):
    title: Title
    description: Description | None = None
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
    position: Decimal
    model_config = ConfigDict(from_attributes=True)


class ItemUpdate(BaseModel):
    title: Title = None
    description: Description | None = None
    is_done: bool = None
    is_important: bool = None
    is_archived: bool = None
    due_date: datetime | None = None
    parent_id: int | None = None
    project_id: int | None = None


class ItemReorder(BaseModel):
    parent_id: int | None = None
    before_id: int | None = None
    after_id: int | None = None
