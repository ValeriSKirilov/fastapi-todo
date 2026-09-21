from sqlalchemy.orm import Session

from ..models.project import Project
from ..schemas.project import ProjectCreate, ProjectUpdate


def get_projects(db: Session, user_id: int, limit: int | None = None):
    return db.query(Project).filter(Project.owner_id == user_id).limit(limit).all()


def get_project(db: Session, project_id: int, user_id: int):
    return db.query(Project).filter(Project.id == project_id, Project.owner_id == user_id).first()


def create_project(db: Session, project: ProjectCreate, user_id: int):
    db_project = Project(**project.model_dump(), owner_id=user_id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    return db_project


def delete_project(db: Session, project_id: int, user_id: int):
    db_project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user_id).first()
    if db_project:
        db.delete(db_project)
        db.commit()

    return db_project


def update_project(db: Session, project_id: int, project: ProjectUpdate, user_id: int):
    db_project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user_id).first()

    if db_project:
        for key, value in project.model_dump(exclude_unset=True).items():
            setattr(db_project, key, value)

        db.commit()
        db.refresh(db_project)

    return db_project
