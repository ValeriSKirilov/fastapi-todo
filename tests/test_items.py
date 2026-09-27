from fastapi.testclient import TestClient
import sqlalchemy as sa
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from decimal import Decimal

from app.main import app
from app.database import get_db, Base
from app.models.item import Item
from app.models.user import User
from app.dependencies.auth import get_current_user

DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autoflush=False, bind=engine)

client = TestClient(app)


def override_get_db():
    database = TestingSessionLocal()
    try:
        yield database
    finally:
        database.close()


def override_get_current_user():
    return User(id=1, email="test@test.com", hashed_password="fakepassword", first_name="Test", last_name="User")


def setup_module():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    db_user = User(id=1, email="test@test.com", hashed_password="fakepassword", first_name="Test", last_name="User")
    session.add(db_user)
    session.commit()

    db_item = Item(title="Test Item", description="Test Description", is_done=False, owner_id=1, position=100)
    session.add(db_item)
    session.commit()
    session.close()


def test_foreign_keys_pragma_is_active():
    session = TestingSessionLocal()
    result = session.execute(sa.text("PRAGMA foreign_keys")).scalar()
    session.close()
    assert result == 1


def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Server is running"}


def test_create_item():
    response = client.post("/items", json={"title": "Test Item"})
    assert response.status_code == 201
    data = response.json()
    assert data['title'] == "Test Item"
    assert data['is_done'] == False
    assert "id" in data


def test_create_item_with_project():
    response = client.post("/projects", json={"name": "Test Project"})
    project_id = response.json()['id']

    response = client.post("/items", json={"title": "Test Item", "project_id": project_id})
    assert response.status_code == 201
    data = response.json()
    assert data['title'] == "Test Item"
    assert data['is_done'] == False
    assert data['project_id'] == project_id
    assert "id" in data


def test_create_item_without_project_returns_null():
    response = client.post("/items", json={"title": "Test Item"})
    assert response.status_code == 201
    data = response.json()
    assert data['title'] == "Test Item"
    assert data['is_done'] == False
    assert data['project_id'] is None
    assert "id" in data


def test_create_item_with_nonexistent_project():
    response = client.post("/items", json={"title": "Test Item", "project_id": 9999})
    assert response.status_code == 400


def test_create_item_with_another_users_project():
    response = client.post("/projects", json={"name": "Test Project"})
    project_id = response.json()['id']

    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.post("/items", json={"title": "Test Item", "project_id": project_id})
        assert response.status_code == 400
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_get_item():
    response = client.get("/items/1")
    assert response.status_code == 200
    data = response.json()
    assert data['title'] == "Test Item"
    assert data['description'] == "Test Description"
    assert data['is_done'] == False
    assert data['id'] == 1


def test_get_nonexistent_item():
    response = client.get("/items/9999")
    assert response.status_code == 404


def test_update_item():
    response = client.post("/items", json={"title": "Test Item", "description": "Test Description"})
    item_id = response.json()['id']

    response = client.put(f"/items/{item_id}", json={"is_done": True})
    assert response.status_code == 200
    data = response.json()
    assert data['title'] == "Test Item"
    assert data['description'] == "Test Description"
    assert data['is_done'] == True
    assert data['id'] == item_id


def test_update_item_assign_project():
    response = client.post("/projects", json={"name": "Test Project"})
    project_id = response.json()['id']

    response = client.post("/items", json={"title": "Test Item"})
    item_id = response.json()['id']

    response = client.put(f"/items/{item_id}", json={"project_id": project_id})
    assert response.status_code == 200
    data = response.json()
    assert data['title'] == "Test Item"
    assert data['id'] == item_id
    assert data['project_id'] == project_id


def test_update_item_reassign_project():
    response = client.post("/projects", json={"name": "Test Project"})
    project_id = response.json()['id']

    response = client.post("/items", json={"title": "Test Item", "project_id": project_id})
    item_id = response.json()['id']

    response = client.post("/projects", json={"name": "New Project"})
    new_project_id = response.json()['id']

    response = client.put(f"/items/{item_id}", json={"project_id": new_project_id})
    assert response.status_code == 200
    data = response.json()
    assert data['id'] == item_id
    assert data['project_id'] == new_project_id


def test_update_item_unassign_project():
    response = client.post("/projects", json={"name": "Test Project"})
    project_id = response.json()['id']

    response = client.post("/items", json={"title": "Test Item", "project_id": project_id})
    item_id = response.json()['id']

    response = client.put(f"/items/{item_id}", json={"project_id": None})
    assert response.status_code == 200
    data = response.json()
    assert data['id'] == item_id
    assert data['project_id'] is None


def test_update_item_with_nonexistent_project():
    response = client.post("/items", json={"title": "Test Item"})
    item_id = response.json()['id']

    response = client.put(f"/items/{item_id}", json={"project_id": 9999})
    assert response.status_code == 400


def test_update_item_with_another_users_project():
    response = client.post("/projects", json={"name": "Test Project"})
    project_id = response.json()['id']
    assert response.status_code == 201

    try:
        session = TestingSessionLocal()
        db_user = User(email="anot_user_proj@test.com", hashed_password="x", first_name="Test", last_name="User")
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
        session.close()

        app.dependency_overrides[get_current_user] = lambda: db_user
        response = client.post("/items", json={"title": "Test Item"})
        item_id = response.json()['id']
        assert response.status_code == 201

        response = client.put(f"/items/{item_id}", json={"project_id": project_id})
        assert response.status_code == 400
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_delete_item():
    response = client.post("/items", json={"title": "Item to delete"})
    item_id = response.json()['id']

    response = client.delete(f"/items/{item_id}")
    assert response.status_code == 204


def test_delete_nonexistent_item():
    response = client.delete("/items/9999")
    assert response.status_code == 404


def test_delete_project_sets_item_project_id_null():
    response = client.post("/projects", json={"name": "Test Project"})
    project_id = response.json()['id']

    response = client.post("/items", json={"title": "Test Item", "project_id": project_id})
    item_id = response.json()['id']

    response = client.delete(f"/projects/{project_id}")
    assert response.status_code == 204

    response = client.get(f"/items/{item_id}")
    assert response.status_code == 200
    data = response.json()
    assert data['id'] == item_id
    assert data['project_id'] is None


def test_create_item_title_too_long():
    long_title = "a" * 256
    response = client.post("/items", json={"title": long_title})
    assert response.status_code == 400


def test_create_item_title_at_max_length():
    max_title = "a" * 255
    response = client.post("/items", json={"title": max_title})
    assert response.status_code == 201


def test_get_item_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.get("/items/1")
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_update_item_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.put("/items/1", json={"is_done": True})
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_delete_item_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.delete("/items/1")
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_delete_item_permanently():
    response = client.post("/items", json={"title": "Item to permanently delete"})
    item_id = response.json()['id']

    response = client.delete(f"/items/{item_id}/permanent")
    assert response.status_code == 204

    response = client.get(f"/items/{item_id}")
    assert response.status_code == 404


def test_create_child_item():
    parent_response = client.post("/items", json={"title": "Parent Task"})
    parent_id = parent_response.json()['id']

    child_response = client.post("/items", json={"title": "Child Task", "parent_id": parent_id})
    assert child_response.status_code == 201
    data = child_response.json()
    assert data['parent_id'] == parent_id


def test_create_item_with_nonexistent_parent():
    response = client.post("/items", json={"title": "Orphan", "parent_id": 999999})
    assert response.status_code == 400


def test_create_item_with_another_users_parent():
    own_response = client.post("/items", json={"title": "User1 Task"})
    own_id = own_response.json()['id']

    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="c@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")

        response = client.post("/items", json={"title": "Malicious child", "parent_id": own_id})
        assert response.status_code == 400
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_update_item_creates_cycle():
    parent_response = client.post("/items", json={"title": "Cycle Parent"})
    parent_id = parent_response.json()['id']

    child_response = client.post("/items", json={"title": "Cycle Child", "parent_id": parent_id})
    child_id = child_response.json()['id']

    response = client.put(f"/items/{parent_id}", json={"parent_id": child_id})
    assert response.status_code == 400


def test_delete_cascades_to_children():
    parent_response = client.post("/items", json={"title": "Parent To Delete"})
    parent_id = parent_response.json()['id']

    child_response = client.post("/items", json={"title": "Child To Delete", "parent_id": parent_id})
    child_id = child_response.json()['id']

    response = client.delete(f"/items/{parent_id}")
    assert response.status_code == 204

    response = client.get(f"/items/{child_id}")
    assert response.status_code == 404


def test_permanent_delete_cascades_to_children():
    parent_response = client.post("/items", json={"title": "Parent To Delete"})
    parent_id = parent_response.json()['id']

    child_response = client.post("/items", json={"title": "Child To Delete", "parent_id": parent_id})
    child_id = child_response.json()['id']

    response = client.delete(f"/items/{parent_id}/permanent")
    assert response.status_code == 204

    session = TestingSessionLocal()
    child_in_db = session.query(Item).filter(Item.id == child_id).first()
    session.close()

    assert child_in_db is None


def test_restore_cascades_to_children():
    parent_response = client.post("/items", json={"title": "Parent To Restore"})
    parent_id = parent_response.json()['id']

    child_response = client.post("/items", json={"title": "Child To Restore", "parent_id": parent_id})
    child_id = child_response.json()['id']

    client.delete(f"/items/{parent_id}")

    response = client.put(f"/items/{parent_id}", json={"is_deleted": False})
    assert response.status_code == 200

    response = client.get(f"/items/{child_id}")
    assert response.status_code == 200


def test_delete_user_cascades_to_items():
    session = TestingSessionLocal()
    db_user = User(email="cascade@test.com", hashed_password="x", first_name="Test", last_name="User")
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    user_id = db_user.id

    db_item = Item(title="Cascade Item", owner_id=user_id, position=100)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    item_id = db_item.id
    session.close()

    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=user_id, email="cascade@test.com",
                                                                  hashed_password="x", first_name="Test",
                                                                  last_name="User")
        response = client.delete("/users/me")
        assert response.status_code == 204
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user

    session = TestingSessionLocal()
    item_in_db = session.query(Item).filter(Item.id == item_id).first()
    session.close()
    assert item_in_db is None


def test_reorder_places_item_between_two_siblings():
    parent = client.post("/items", json={"title": "Order Parent"}).json()
    child_a = client.post("/items", json={"title": "Child A", "parent_id": parent['id']}).json()
    child_b = client.post("/items", json={"title": "Child B", "parent_id": parent['id']}).json()
    mover = client.post("/items", json={"title": "Mover", "parent_id": parent['id']}).json()

    response = client.patch(f"/items/{mover['id']}/reorder", json={
        "parent_id": parent['id'],
        "before_id": child_a['id'],
        "after_id": child_b['id']
    })

    assert response.status_code == 200
    data = response.json()
    assert Decimal(child_a['position']) < Decimal(data['position']) < Decimal(child_b['position'])
    assert data['parent_id'] == parent['id']


def test_reorder_to_top_of_list():
    parent = client.post("/items", json={"title": "Top Parent"}).json()
    child_a = client.post("/items", json={"title": "Child A", "parent_id": parent['id']}).json()
    mover = client.post("/items", json={"title": "Mover", "parent_id": parent['id']}).json()

    response = client.patch(f"/items/{mover['id']}/reorder", json={
        "parent_id": parent['id'],
        "after_id": child_a['id'],
    })

    assert response.status_code == 200
    assert Decimal(response.json()['position']) < Decimal(child_a['position'])


def test_reorder_to_bottom_of_list():
    parent = client.post("/items", json={"title": "Bottom Parent"}).json()
    child_a = client.post("/items", json={"title": "Child A", "parent_id": parent['id']}).json()
    mover = client.post("/items", json={"title": "Mover", "parent_id": parent['id']}).json()

    response = client.patch(f"/items/{mover['id']}/reorder", json={
        "parent_id": parent['id'],
        "before_id": child_a['id'],
    })

    assert response.status_code == 200
    assert Decimal(response.json()['position']) > Decimal(child_a['position'])


def test_reorder_into_empty_group_gets_first_position():
    empty_parent = client.post("/items", json={"title": "Empty Parent"}).json()
    mover = client.post("/items", json={"title": "Mover"}).json()

    response = client.patch(f"/items/{mover['id']}/reorder", json={"parent_id": empty_parent['id']})
    assert response.status_code == 200
    data = response.json()
    assert data['parent_id'] == empty_parent['id']
    assert Decimal(data['position']) == Decimal(100)


def test_reorder_makes_top_level_task_a_subtask():
    parent = client.post("/items", json={"title": "New Parent"}).json()
    mover = client.post("/items", json={"title": "Was Top Level"}).json()

    response = client.patch(f"/items/{mover['id']}/reorder", json={"parent_id": parent['id']})
    assert response.status_code == 200
    assert response.json()['parent_id'] == parent['id']


def test_reorder_makes_subtask_a_top_level_task():
    parent = client.post("/items", json={"title": "Parent For Promotion Test"}).json()
    child = client.post("/items", json={"title": "Child To Promote", "parent_id": parent['id']}).json()

    response = client.patch(f"/items/{child['id']}/reorder", json={"parent_id": None})
    assert response.status_code == 200
    assert response.json()['parent_id'] is None


def test_reorder_creates_cycle_rejected():
    parent = client.post("/items", json={"title": "Reorder Cycle Parent"}).json()
    child = client.post("/items", json={"title": "Reorder Cycle Child", "parent_id": parent['id']}).json()

    response = client.patch(f"/items/{parent['id']}/reorder", json={"parent_id": child['id']})
    assert response.status_code == 400


def test_reorder_with_nonexistent_parent():
    item = client.post("/items", json={"title": "Reorder Orphan Test"}).json()

    response = client.patch(f"/items/{item['id']}/reorder", json={"parent_id": 9999})
    assert response.status_code == 400


def test_reorder_with_another_users_parent_rejected():
    session = TestingSessionLocal()
    other_user = User(email="reorder_parent_other@test.com", hashed_password="x", first_name="Test", last_name="User")
    session.add(other_user)
    session.commit()
    session.refresh(other_user)
    other_user_id = other_user.id
    session.close()

    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=other_user_id,
                                                                  email="reorder_parent_other@test.com",
                                                                  hashed_password="x", first_name="Test",
                                                                  last_name="User")
        other_parent = client.post("/items", json={"title": "Other User's Parent"}).json()
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user

    item = client.post("/items", json={"title": "Reorder Malicious Test"}).json()

    response = client.patch(f"/items/{item['id']}/reorder", json={"parent_id": other_parent['id']})
    assert response.status_code == 400


def test_reorder_self_as_neighbor_rejected():
    item = client.post("/items", json={"title": "Self Neighbor Test"}).json()

    response = client.patch(f"/items/{item['id']}/reorder", json={"before_id": item['id']})
    assert response.status_code == 400


def test_reorder_nonexistent_neighbor_rejected():
    item = client.post("/items", json={"title": "Nonexistent Neighbor Test"}).json()

    response = client.patch(f"/items/{item['id']}/reorder", json={"before_id": 9999})
    assert response.status_code == 400


def test_reorder_neighbor_from_different_parent_rejected():
    parent_one = client.post("/items", json={"title": "Parent One"}).json()
    parent_two = client.post("/items", json={"title": "Parent Two"}).json()

    child_of_one = client.post("/items", json={"title": "Child of One", "parent_id": parent_one['id']}).json()
    child_of_two = client.post("/items", json={"title": "Child of Two", "parent_id": parent_two['id']}).json()
    mover = client.post("/items", json={"title": "Mover", "parent_id": parent_one['id']}).json()

    response = client.patch(f"/items/{mover['id']}/reorder", json={
        "parent_id": parent_one['id'],
        "before_id": child_of_one['id'],
        "after_id": child_of_two['id']
    })
    assert response.status_code == 400


def test_reorder_neighbor_owned_by_another_user_rejected():
    session = TestingSessionLocal()
    other_user = User(email="reorder_other@test.com", hashed_password="x", first_name="Test", last_name="User")
    session.add(other_user)
    session.commit()
    session.refresh(other_user)
    other_user_id = other_user.id
    session.close()

    item = client.post("/items", json={"title": "My Item"}).json()

    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=other_user_id, email="reorder_other@test.com",
                                                                  hashed_password="x", first_name="Test",
                                                                  last_name="User")
        other_item = client.post("/items", json={"title": "Other User Item"}).json()
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user

    response = client.patch(f"/items/{item['id']}/reorder", json={"before_id": other_item['id']})
    assert response.status_code == 400


def test_reorder_nonexistent_item():
    response = client.patch("/items/9999/reorder", json={"parent_id": None})
    assert response.status_code == 404


def test_reorder_item_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.patch("/items/1/reorder", json={"parent_id": None})
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_reorder_deleted_item_returns_404():
    item = client.post("/items", json={"title": "To delete for reorder test"}).json()
    client.delete(f"/items/{item['id']}")

    response = client.patch(f"/items/{item['id']}/reorder", json={"parent_id": None})
    assert response.status_code == 404


def test_reorder_archived_item_returns_404():
    item = client.post("/items", json={"title": "To archive for reorder test"}).json()
    client.put(f"/items/{item['id']}", json={"is_archived": True})

    response = client.patch(f"/items/{item['id']}/reorder", json={"parent_id": None})
    assert response.status_code == 404


def test_reorder_triggers_rebalance_when_precision_exhausted():
    parent = client.post("/items", json={"title": "Rebalance Parent"}).json()
    child_a = client.post("/items", json={"title": "Child A", "parent_id": parent['id']}).json()
    child_b = client.post("/items", json={"title": "Child B", "parent_id": parent['id']}).json()

    session = TestingSessionLocal()
    db_a = session.query(Item).filter(Item.id == child_a['id']).first()
    db_a.position = Decimal("100")
    db_b = session.query(Item).filter(Item.id == child_b['id']).first()
    db_b.position = Decimal("100." + "1" * 21)
    session.commit()
    session.close()

    mover = client.post("/items", json={"title": "Mover", "parent_id": parent['id']}).json()

    response = client.patch(f"/items/{mover['id']}/reorder", json={
        "parent_id": parent['id'],
        "before_id": child_a['id'],
        "after_id": child_b['id'],
    })
    assert response.status_code == 200

    session = TestingSessionLocal()
    siblings = (
        session.query(Item)
        .filter(Item.parent_id == parent['id'])
        .order_by(Item.position)
        .all()
    )
    session.close()

    for sibling in siblings:
        assert sibling.position.as_tuple().exponent >= -20


def teardown_module():
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
