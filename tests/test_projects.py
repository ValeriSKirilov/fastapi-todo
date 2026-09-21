from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db, Base
from app.models.item import Item
from app.models.user import User
from app.models.project import Project
from app.dependencies.auth import get_current_user

DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
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
    db_item = Project(name="Test Project", owner_id=1)
    session.add(db_item)
    session.commit()
    session.close()


def test_create_project():
    response = client.post("/projects", json={"name": "Test Project"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert "id" in data


def test_get_project():
    response = client.get("/projects/1")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["id"] == 1


def test_get_projects_list():
    response = client.get("/projects")
    assert response.status_code == 200


def test_update_project():
    response = client.post("/projects", json={"name": "Project to update"})
    project_id = response.json()["id"]

    response = client.put(f"/projects/{project_id}", json={"name": "Updated Project"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Project"
    assert data["id"] == project_id


def test_delete_project():
    response = client.post("/projects", json={"name": "Project to delete"})
    project_id = response.json()["id"]

    response = client.delete(f"/projects/{project_id}")
    assert response.status_code == 204


def test_nameless_project():
    response = client.post("/projects", json={})
    assert response.status_code == 400


def test_get_nonexistent_project():
    response = client.get("/projects/9999")
    assert response.status_code == 404


def test_delete_nonexistent_project():
    response = client.delete("/projects/9999")
    assert response.status_code == 404


def test_create_project_name_too_long():
    long_title = "a" * 256
    response = client.post("/projects", json={"name": long_title})
    assert response.status_code == 400


def test_create_project_name_at_max_length():
    max_title = "a" * 255
    response = client.post("/projects", json={"name": max_title})
    assert response.status_code == 201


def test_update_project_name_too_long():
    response = client.post("/projects", json={"name": "Project to update"})
    project_id = response.json()["id"]

    long_title = "a" * 256
    response = client.put(f"/projects/{project_id}", json={"name": long_title})
    assert response.status_code == 400


def test_update_project_name_at_max_length():
    response = client.post("/projects", json={"name": "Project to update"})
    project_id = response.json()["id"]

    max_title = "a" * 255
    response = client.put(f"/projects/{project_id}", json={"name": max_title})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == max_title
    assert data["id"] == project_id


def test_list_projects_scoped_to_owner():
    response = client.post("/projects", json={"name": "User1 Only Project"})
    assert response.status_code == 201
    own_project_id = response.json()["id"]

    response = client.get("/projects")
    assert response.status_code == 200
    own_ids = [project["id"] for project in response.json()]
    assert own_project_id in own_ids

    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.get("/projects")
        assert response.status_code == 200
        other_user_ids = [project["id"] for project in response.json()]
        assert own_project_id not in other_user_ids
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_get_project_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.get("/projects/1")
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_update_project_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.put("/projects/1", json={"name": "Updated Project"})
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_delete_project_ownership_enforcement():
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="b@test.com", hashed_password="x",
                                                                  first_name="Test", last_name="User")
        response = client.delete("/projects/1")
        assert response.status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def teardown_module():
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
