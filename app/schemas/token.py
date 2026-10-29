from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str


class TokenData(BaseModel):
    id: str | None = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str
