from pydantic import BaseModel, ConfigDict


class UserBase(BaseModel):
    email: str
    first_name: str
    last_name: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    email: str | None = None
    password: str | None = None
