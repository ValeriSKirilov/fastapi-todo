from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..database import Base


class Item(Base):
    __tablename__ = 'items'

    __table_args__ = (
        Index('idx_owner_id_parent_id_position', 'owner_id', 'parent_id', 'position'),
    )

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_done = Column(Boolean, nullable=False, default=False, server_default="false")
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False, server_default="false")
    is_important = Column(Boolean, nullable=False, default=False, server_default="false")
    is_archived = Column(Boolean, nullable=False, default=False, server_default="false")
    due_date = Column(DateTime(timezone=True), nullable=True)
    parent_id = Column(Integer, ForeignKey('items.id'), nullable=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='SET NULL'), index=True, nullable=True)
    position = Column(Numeric, nullable=False)

    owner = relationship('User', back_populates='items')
    parent = relationship('Item', back_populates='children', remote_side=[id])
    children = relationship('Item', back_populates='parent')
    project = relationship('Project', back_populates='items')
