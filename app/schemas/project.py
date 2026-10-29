from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class ProjectBase(BaseModel):
    name: Name


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ProjectUpdate(BaseModel):
    name: Name
