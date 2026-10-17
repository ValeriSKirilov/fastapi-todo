from sqlalchemy import Column, Integer, String, ForeignKey, Index, text
from sqlalchemy.orm import relationship

from ..database import Base


class Project(Base):
    __tablename__ = 'projects'

    __table_args__ = (
        Index('uq_projects_owner_lower_name', 'owner_id', text('lower(name)'), unique=True),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    owner = relationship('User', back_populates='projects')
    items = relationship('Item', back_populates='project', passive_deletes=True)
