from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..database import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, nullable=False)
    is_done = Column(Boolean, default=False)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, default=False)
    is_important = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    due_date = Column(DateTime(timezone=True), nullable=True)

    owner = relationship("User", back_populates="items")
