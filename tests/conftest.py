import itertools
import os
from contextlib import contextmanager
from dotenv import load_dotenv

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db, Base
from app.dependencies.auth import get_current_user
from app.models.item import Item
from app.models.user import User
from app.models.project import Project

load_dotenv()

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")


@pytest.fixture(scope="session")
def engine():
    url = make_url(TEST_DATABASE_URL)

    if url.get_backend_name() == "sqlite":
        eng = create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)

        @event.listens_for(eng, "connect")
        def _enable_foreign_keys(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    else:
        if "test" not in (url.database or ""):
            raise RuntimeError("Refusing to run: the test database name must contain 'test'.")
        eng = create_engine(url)

    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture(scope="session")
def session_factory(engine):
    return sessionmaker(autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def _wipe_db_after_test(engine):
    yield
    tables = Base.metadata.sorted_tables
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            names = ", ".join(f'"{table.name}"' for table in tables)
            conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
        else:
            for table in reversed(tables):
                conn.execute(table.delete())


@pytest.fixture
def db(session_factory):
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sqlite_only(engine):
    if engine.dialect.name != "sqlite":
        pytest.skip("SQLite-only test")


@pytest.fixture
def postgres_only(engine):
    if engine.dialect.name != "postgresql":
        pytest.skip("needs PostgreSQL (arbitrary-precision Numeric, Unicode lower())")


@pytest.fixture
def make_user(session_factory):
    counter = itertools.count(1)

    def _make(**fields) -> User:
        data = {
            "email": f"user{next(counter)}@test.com",
            "hashed_password": "x",
            "first_name": "Test",
            "last_name": "User",
        }
        data.update(fields)
        with session_factory() as session:
            obj = User(**data)
            session.add(obj)
            session.commit()
            session.refresh(obj)
            session.expunge(obj)
            return obj

    return _make


@pytest.fixture
def user(make_user):
    return make_user(email="test@test.com")


@pytest.fixture
def other_user(make_user):
    return make_user(email="other@test.com")


@pytest.fixture
def anon_client(session_factory):
    def override_get_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client(anon_client, user):
    app.dependency_overrides[get_current_user] = lambda: user
    return anon_client


@pytest.fixture
def as_user():
    @contextmanager
    def _as_user(target: User):
        previous = app.dependency_overrides.get(get_current_user)
        app.dependency_overrides[get_current_user] = lambda: target
        try:
            yield
        finally:
            if previous is None:
                app.dependency_overrides.pop(get_current_user, None)
            else:
                app.dependency_overrides[get_current_user] = previous

    return _as_user


@pytest.fixture
def project(db, user):
    obj = Project(name="Test Project", owner_id=user.id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture
def item(db, user):
    obj = Item(title="Test Item", description="Test Description", is_done=False, owner_id=user.id, position=100)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
