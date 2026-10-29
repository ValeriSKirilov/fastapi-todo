from sqlalchemy import Column, Integer, String, Boolean, Index, text
from sqlalchemy.orm import relationship

from ..database import Base


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
    )

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)

    items = relationship("Item", back_populates="owner", passive_deletes=True)
    projects = relationship("Project", back_populates="owner", passive_deletes=True)
