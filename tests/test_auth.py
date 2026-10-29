from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db, Base
from app.models.user import User
from app.models.item import Item

DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,
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


def setup_module():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    client.post("/users/register", json={"email": "test@test.com", "password": "password123"})


def get_tokens():
    response = client.post("/auth/login", data={"username": "test@test.com", "password": "password123"})
    return response.json()


def test_register_new_user():
    response = client.post("/users/register", json={"email": "a@test.com", "password": "qwerty"})
    assert response.status_code == 201


def test_register_duplicate_user():
    response = client.post("/users/register", json={"email": "test@test.com", "password": "pass123"})
    assert response.status_code == 409


def test_correct_login():
    response = client.post("/auth/login", data={"username": "test@test.com", "password": "password123"})
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert "token_type" in response.json()
    assert "refresh_token" in response.json()


def test_login_with_wrong_password():
    response = client.post("/auth/login", data={"username": "test@test.com", "password": "123"})
    assert response.status_code == 401


def test_login_with_nonexistent_email():
    response = client.post("/auth/login", data={"username": "a@a.com", "password": "password123"})
    assert response.status_code == 401


def test_me_with_valid_token():
    login_response = get_tokens()
    token = login_response["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_me_with_no_token():
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token():
    response = client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken123"})
    assert response.status_code == 401


def test_refresh_with_valid_token():
    login_response = get_tokens()
    refresh_token = login_response["refresh_token"]

    response = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_refresh_with_access_token():
    login_response = get_tokens()
    access_token = login_response["access_token"]

    response = client.post("/auth/refresh", json={"refresh_token": access_token})
    assert response.status_code == 401


def test_refresh_with_invalid_token():
    response = client.post("/auth/refresh", json={"refresh_token": "invalid"})
    assert response.status_code == 401


def test_logout():
    response = client.post("/auth/logout")
    assert response.status_code == 200


def teardown_module():
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
