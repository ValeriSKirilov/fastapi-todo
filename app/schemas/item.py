from pydantic import BaseModel, ConfigDict


class ItemBase(BaseModel):
    text: str
    is_done: bool = False


class ItemCreate(ItemBase):
    pass


class ItemResponse(ItemBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ItemUpdate(BaseModel):
    text: str | None = None
    is_done: bool | None = None
