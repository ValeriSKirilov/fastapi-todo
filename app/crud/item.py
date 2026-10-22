from sqlalchemy.sql import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from ..models.item import Item
from ..models.project import Project
from ..schemas.item import ItemCreate, ItemUpdate, ItemReorder

CASCADE_FIELDS = {"is_done", "is_archived", "project_id"}
MAX_SUBTASK_DEPTH = 2


class InvalidParentError(Exception):
    pass


class InvalidProjectError(Exception):
    pass


class InvalidNeighborError(Exception):
    pass


def _would_create_cycle(db: Session, item_id: int, new_parent_id: int) -> bool:
    path_cte = (db.query(Item).filter(Item.id == new_parent_id)
                .cte(name="path_members_cte", recursive=True))
    recursive_q = db.query(Item).join(path_cte, Item.id == path_cte.c.parent_id)
    path_cte = path_cte.union_all(recursive_q)

    return db.query(path_cte).filter(path_cte.c.id == item_id).first() is not None


def _get_all_descendants(db: Session, item_id: int) -> list[Item]:
    children_cte = (db.query(Item).filter(Item.parent_id == item_id)
                    .cte(name="descendants_cte", recursive=True))
    recursive_q = db.query(Item).join(children_cte, Item.parent_id == children_cte.c.id)
    children_cte = children_cte.union_all(recursive_q)

    return db.query(Item).from_statement(children_cte.select()).all()


def _depth(db: Session, task_id: int) -> int:
    ancestors_cte = (db.query(Item).filter(Item.id == task_id, Item.is_deleted == False, Item.is_archived == False)
                     .cte(name="ancestors_cte", recursive=True))
    recursive_q = (db.query(Item).join(ancestors_cte, Item.id == ancestors_cte.c.parent_id)
                   .filter(Item.is_deleted == False, Item.is_archived == False))
    ancestors_cte = ancestors_cte.union_all(recursive_q)

    return db.query(func.count()).select_from(ancestors_cte).scalar() - 1


def _height(db: Session, task_id: int) -> int:
    subtree_cte = (db.query(Item).filter(Item.parent_id == task_id, Item.is_deleted == False, Item.is_archived == False)
                   .cte(name="subtree_cte", recursive=True))
    recursive_q = (db.query(Item).join(subtree_cte, Item.parent_id == subtree_cte.c.id)
                   .filter(Item.is_deleted == False, Item.is_archived == False))
    subtree_cte = subtree_cte.union_all(recursive_q)

    return db.query(func.count(func.distinct(subtree_cte.c.parent_id))).select_from(subtree_cte).scalar()


def _validate_parent(db: Session, item_id: int | None, parent_id: int, user_id: int):
    parent_item = db.query(Item).filter(
        Item.id == parent_id,
        Item.is_deleted == False,
        Item.is_archived == False
    ).first()

    if parent_item is None or parent_item.owner_id != user_id:
        raise InvalidParentError("Parent task not found or not owned by user")

    if item_id is not None and _would_create_cycle(db, item_id, parent_id):
        raise InvalidParentError("This would create a cycle")

    item_height = 0 if item_id is None else _height(db, item_id)
    if (_depth(db, parent_id) + 1 + item_height) > MAX_SUBTASK_DEPTH:
        raise InvalidParentError("This would exceed the maximum depth limit")


def _validate_project(db: Session, project_id: int, user_id: int):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None or project.owner_id != user_id:
        raise InvalidProjectError("Project not found or not owned by user")


def _needs_rebalance(position: Decimal) -> bool:
    exponent = position.as_tuple().exponent
    return exponent < -20


def _rebalance_siblings(db: Session, parent_id: int | None, user_id: int):
    siblings = (
        db.query(Item)
        .filter(Item.parent_id == parent_id, Item.owner_id == user_id)
        .order_by(Item.position)
        .all()
    )
    for i, item in enumerate(siblings):
        item.position = Decimal((i + 1) * 100)
    db.commit()


def get_items(db: Session, user_id: int, limit: int | None = None):
    return db.query(Item).filter(Item.owner_id == user_id).limit(limit).order_by(Item.position).all()


def get_item(db: Session, item_id: int, user_id: int):
    return db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()


def create_item(db: Session, item: ItemCreate, user_id: int):
    if item.parent_id is not None:
        _validate_parent(db, None, item.parent_id, user_id)

    position = (
        db.query(func.max(Item.position))
        .filter(Item.parent_id == item.parent_id, Item.owner_id == user_id)
        .scalar()
    )
    position = (position or 0) + 100

    if item.project_id is not None:
        _validate_project(db, item.project_id, user_id)

    db_item = Item(**item.model_dump(), owner_id=user_id, position=position)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return db_item


def delete_item(db: Session, item_id: int, user_id: int):
    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()
    if not db_item or db_item.is_deleted == True:
        return None

    now = datetime.now(timezone.utc)
    db_item.is_deleted = True
    db_item.deleted_at = now

    for descendant in _get_all_descendants(db, item_id):
        if not descendant.is_deleted:
            descendant.is_deleted = True
            descendant.deleted_at = now

    db.commit()
    db.refresh(db_item)

    return db_item


def delete_item_permanently(db: Session, item_id: int, user_id: int):
    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()
    if not db_item:
        return None

    for descendant in _get_all_descendants(db, item_id):
        db.delete(descendant)

    db.delete(db_item)
    db.commit()

    return db_item


def update_item(db: Session, item_id: int, item: ItemUpdate, user_id: int):
    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id).first()
    if not db_item:
        return None

    if item.parent_id is not None:
        _validate_parent(db, item_id, item.parent_id, user_id)

    if item.project_id is not None:
        _validate_project(db, item.project_id, user_id)

    update_data = item.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_item, key, value)

    cascade_updates = {k: v for k, v in update_data.items() if k in CASCADE_FIELDS}
    if cascade_updates:
        for descendant in _get_all_descendants(db, item_id):
            for key, value in cascade_updates.items():
                setattr(descendant, key, value)

    db.commit()
    db.refresh(db_item)

    return db_item


def restore_item(db: Session, item_id: int, user_id: int):
    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id, Item.is_deleted == True).first()
    if not db_item:
        return None

    parent_deleted_time = db_item.deleted_at

    db_item.is_deleted = False
    db_item.deleted_at = None
    for descendant in _get_all_descendants(db, item_id):
        if descendant.deleted_at == parent_deleted_time:
            descendant.is_deleted = False
            descendant.deleted_at = None

    db.commit()
    db.refresh(db_item)

    return db_item


def _validate_neighbors_are_adjacent(db: Session, before: Item | None, after: Item | None, item_id: int,
                                     parent_id: int | None, user_id: int):
    if before is None or after is None:
        return

    if before.position > after.position:
        raise InvalidNeighborError("before_id position must be less than after_id position")

    intervening = (
        db.query(Item)
        .filter(
            Item.parent_id == parent_id,
            Item.owner_id == user_id,
            Item.position > before.position,
            Item.position < after.position,
            Item.id != item_id,
            Item.is_deleted == False,
            Item.is_done == False,
            Item.is_archived == False,
        )
        .first()
    )
    if intervening is not None:
        raise InvalidNeighborError("before_id and after_id are not adjacent")


def _get_reorder_neighbor(db: Session, neighbor_id: int | None, target_parent_id: int | None, item_id: int,
                          user_id: int):
    if neighbor_id is None:
        return None
    if neighbor_id == item_id:
        raise InvalidNeighborError("An item cannot be its own neighbor")

    neighbor = db.query(Item).filter(Item.id == neighbor_id, Item.owner_id == user_id).first()
    if neighbor is None or neighbor.parent_id != target_parent_id:
        raise InvalidNeighborError("Neighbor item not found in the target group")

    return neighbor


def _compute_position(before: Item | None, after: Item | None) -> Decimal:
    if before is None and after is None:
        return Decimal(100)
    if before is None:
        return after.position - 100
    if after is None:
        return before.position + 100
    return (before.position + after.position) / 2


def reorder_item(db: Session, item_id: int, item: ItemReorder, user_id: int):
    db_item = db.query(Item).filter(Item.id == item_id, Item.owner_id == user_id, Item.is_deleted == False,
                                    Item.is_archived == False).first()
    if not db_item:
        return None

    if item.parent_id is not None:
        _validate_parent(db, item_id, item.parent_id, user_id)

    item_before = _get_reorder_neighbor(db, item.before_id, item.parent_id, item_id, user_id)
    item_after = _get_reorder_neighbor(db, item.after_id, item.parent_id, item_id, user_id)

    _validate_neighbors_are_adjacent(db, item_before, item_after, item_id, item.parent_id, user_id)

    new_position = _compute_position(item_before, item_after)

    if (_needs_rebalance(new_position)
            or (item_before is not None and item_after is not None and item_before.position == item_after.position)):
        _rebalance_siblings(db, item.parent_id, user_id)
        if item_before:
            db.refresh(item_before)
        if item_after:
            db.refresh(item_after)
        new_position = _compute_position(item_before, item_after)

    db_item.position = new_position
    db_item.parent_id = item.parent_id

    db.commit()
    db.refresh(db_item)

    return db_item
