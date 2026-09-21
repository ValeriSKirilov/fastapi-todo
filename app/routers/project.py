from typing import List

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from ..schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from ..database import get_db

from ..crud import project as crud
from ..dependencies.auth import get_current_user
from ..models.user import User

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
    responses={404: {"description": "Not found"}},
)


@router.get("", response_model=List[ProjectResponse])
def list_projects(
        limit: int = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    if limit is None or limit > 0:
        return crud.get_projects(db, current_user.id, limit=limit)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid index"
        )


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
        project_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    project = crud.get_project(db, project_id, current_user.id)
    if project:
        return project
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
        project: ProjectCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    return crud.create_project(db, project, current_user.id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project(
        project_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    project = crud.delete_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
        project_id: int,
        new_project: ProjectUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    project = crud.update_project(db, project_id, new_project, current_user.id)

    if project:
        return project
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
