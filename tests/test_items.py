from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db, Base
from app.models.item import Item

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


app.dependency_overrides[get_db] = override_get_db


def setup_module():
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    db_item = Item(text="Test Item", is_done=False)
    session.add(db_item)
    session.commit()
    session.close()


def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Server is running"}


def test_create_item():
    response = client.post("/items", json={"text": "Test Item"})
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Test Item"
    assert data["is_done"] == False
    assert "id" in data


def test_get_item():
    response = client.get("/items/1")
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Test Item"
    assert data["is_done"] == False
    assert data["id"] == 1


def test_update_item():
    response = client.put("/items/1", json={"is_done": True})
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Test Item"
    assert data["is_done"] == True
    assert data["id"] == 1


def test_delete_item():
    response = client.delete("/items/1")
    assert response.status_code == 204


def test_get_nonexistent_item():
    response = client.get("/items/999")
    assert response.status_code == 404


def test_delete_nonexistent_item():
    response = client.delete("/items/999")
    assert response.status_code == 404


def teardown_module():
    Base.metadata.drop_all(bind=engine)
