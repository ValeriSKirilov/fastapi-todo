from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from ..models.item import Item
from ..schemas.item import ItemCreate, ItemUpdate


class InvalidParentError(Exception):
    pass


def _would_create_cycle(db: Session, item_id: int, new_parent_id: int) -> bool:
    current_id = new_parent_id
    visited = set()

    while current_id is not None:
        if current_id == item_id:
            return True
        if current_id in visited:
            break;
        visited.add(current_id)

        current = db.query(Item).filter(Item.id == current_id).first()
        if current is None:
            break
        current_id = current.parent_id

    return False


def _get_all_descendants(db: Session, item_id: int) -> list[Item]:
    descendants = []
    to_process = [item_id]

    while to_process:
        current_id = to_process.pop()
        children = db.query(Item).filter(Item.parent_id == current_id).all()

        for child in children:
            descendants.append(child)
            to_process.append(child)

        return descendants


def get_items(db: Session, user_id: int, limit: int | None = None):
    return db.query(Item).filter(Item.owner_id == user_id).limit(limit).all()


def get_item(db: Session, item_id: int, user_id: int):
    return db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id, Item.is_deleted == False).first()


def create_item(db: Session, item: ItemCreate, user_id: int):
    if item.parent_id is not None:
        parent_item = db.query(Item).filter(Item.id == item.parent_id).first()
        if parent_item is None or parent_item.owner_id != user_id:
            raise InvalidParentError("Parent task not found or not owned by user")

    db_item = Item(**item.model_dump(), owner_id=user_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return db_item


def delete_item(db: Session, item_id: int, user_id: int):
    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()
    if db_item:
        now = datetime.now(timezone.utc)
        db_item.is_deleted = True
        db_item.deleted_at = now

        for descendant in _get_all_descendants(db, item_id):
            descendant.is_deleted = True
            descendant.deleted_at = now

        db.commit()
        db.refresh(db_item)

    return db_item


def delete_item_permanently(db: Session, item_id: int, user_id: int):
    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()
    if db_item:
        for descendant in _get_all_descendants(db, item_id):
            db.delete(descendant)

        db.delete(db_item)
        db.commit()

    return db_item


def update_item(db: Session, item_id: int, item: ItemUpdate, user_id: int):
    if item.parent_id is not None:
        parent_item = db.query(Item).filter(Item.id == item.parent_id).first()
        if parent_item is None or parent_item.owner_id != user_id:
            raise InvalidParentError("Parent task not found or not owned by user")

        if _would_create_cycle(db, item_id, item.parent_id):
            raise InvalidParentError("This would create a cycle")

    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()

    if db_item:
        for key, value in item.model_dump(exclude_unset=True).items():
            setattr(db_item, key, value)
            if key == "is_deleted" and value is False:
                db_item.deleted_at = None

                for descendant in _get_all_descendants(db, item_id):
                    descendant.is_deleted = False
                    descendant.deleted_at = None

        db.commit()
        db.refresh(db_item)

    return db_item
