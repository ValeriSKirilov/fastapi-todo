from sqlalchemy.orm import Session

from ..models.item import Item
from ..schemas.item import ItemCreate, ItemUpdate


def get_items(db: Session, user_id: int, limit: int | None = None):
    return db.query(Item).filter(Item.owner_id == user_id).limit(limit).all()


def get_item(db: Session, item_id: int, user_id: int):
    return db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()


def create_item(db: Session, item: ItemCreate, user_id: int):
    db_item = Item(**item.model_dump(), owner_id=user_id)

    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return db_item


def delete_item(db: Session, item_id: int, user_id: int):
    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()

    return db_item


def update_item(db: Session, item_id: int, item: ItemUpdate, user_id: int):
    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()

    if db_item:
        for key, value in item.model_dump(exclude_unset=True).items():
            setattr(db_item, key, value)
        db.commit()
        db.refresh(db_item)

    return db_item
