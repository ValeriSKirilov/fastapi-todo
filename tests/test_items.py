from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db, Base
from app.models.item import Item
from app.models.user import User
from app.dependencies.auth import get_current_user

DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False
    },
    poolclass=StaticPool,
)
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
    db_item = Item(title="Test Item", description="Test Description", is_done=False, owner_id=1)
    session.add(db_item)
    session.commit()
    session.close()


def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Server is running"}


def test_create_item():
    response = client.post("/items", json={"title": "Test Item"})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["is_done"] == False
    assert "id" in data


def test_get_item():
    response = client.get("/items/1")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["description"] == "Test Description"
    assert data["is_done"] == False
    assert data["id"] == 1


def test_update_item():
    response = client.put("/items/1", json={"is_done": True})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["description"] == "Test Description"
    assert data["is_done"] == True
    assert data["id"] == 1


def test_delete_item():
    response = client.post("/items", json={"title": "Item to delete"})
    item_id = response.json()["id"]

    response = client.delete(f"/items/{item_id}")
    assert response.status_code == 204


def test_get_nonexistent_item():
    response = client.get("/items/999")
    assert response.status_code == 404


def test_delete_nonexistent_item():
    response = client.delete("/items/999")
    assert response.status_code == 404


def test_create_item_title_too_long():
    long_title = "a" * 256
    response = client.post("/items", json={"title": long_title})
    assert response.status_code == 400


def test_create_item_title_at_max_length():
    max_title = "a" * 255
    response = client.post("/items", json={"title": max_title})
    assert response.status_code == 200


def test_get_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.get("/items/1")
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_update_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.put("/items/1", json={"is_done": True})
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_delete_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.delete("/items/1")
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_delete_item_permanently():
    response = client.post("/items", json={"title": "Item to permanently delete"})
    item_id = response.json()["id"]

    response = client.delete(f"/items/{item_id}/permanent")
    assert response.status_code == 204

    response = client.get(f"/items/{item_id}")
    assert response.status_code == 404


def test_create_child_item():
    parent_response = client.post("/items", json={"title": "Parent Task"})
    parent_id = parent_response.json()["id"]

    child_response = client.post("/items", json={"title": "Child Task", "parent_id": parent_id})
    assert child_response.status_code == 200
    data = child_response.json()
    assert data["parent_id"] == parent_id


def test_create_item_with_nonexistent_parent():
    response = client.post("/items", json={"title": "Orphan", "parent_id": 999999})
    assert response.status_code == 400


def test_create_item_with_another_users_parent():
    own_response = client.post("/items", json={"title": "User1 Task"})
    own_id = own_response.json()["id"]

    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="c@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")

        response = client.post("/items", json={"title": "Malicious child", "parent_id": own_id})
        assert response.status_code == 400
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_update_item_creates_cycle():
    parent_response = client.post("/items", json={"title": "Cycle Parent"})
    parent_id = parent_response.json()["id"]

    child_response = client.post("/items", json={"title": "Cycle Child", "parent_id": parent_id})
    child_id = child_response.json()["id"]

    response = client.put(f"/items/{parent_id}", json={"parent_id": child_id})
    assert response.status_code == 400


def test_delete_cascades_to_children():
    parent_response = client.post("/items", json={"title": "Parent To Delete"})
    parent_id = parent_response.json()["id"]

    child_response = client.post("/items", json={"title": "Child To Delete", "parent_id": parent_id})
    child_id = child_response.json()["id"]

    response = client.delete(f"/items/{parent_id}")
    assert response.status_code == 204

    response = client.get(f"/items/{child_id}")
    assert response.status_code == 404


def test_permanent_delete_cascades_to_children():
    parent_response = client.post("/items", json={"title": "Parent To Delete"})
    parent_id = parent_response.json()["id"]

    child_response = client.post("/items", json={"title": "Child To Delete", "parent_id": parent_id})
    child_id = child_response.json()["id"]

    response = client.delete(f"/items/{parent_id}/permanent")
    assert response.status_code == 204

    session = TestingSessionLocal()
    child_in_db = session.query(Item).filter(Item.id == child_id).first()
    session.close()

    assert child_in_db is None


def test_restore_cascades_to_children():
    parent_response = client.post("/items", json={"title": "Parent To Restore"})
    parent_id = parent_response.json()["id"]

    child_response = client.post("/items", json={"title": "Child To Restore", "parent_id": parent_id})
    child_id = child_response.json()["id"]

    client.delete(f"/items/{parent_id}")

    response = client.put(f"/items/{parent_id}", json={"is_deleted": False})
    assert response.status_code == 200

    response = client.get(f"/items/{child_id}")
    assert response.status_code == 200


def teardown_module():
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
