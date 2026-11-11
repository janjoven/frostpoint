import os

import pytest

TEST_URL = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://frostpoint:frostpoint@db:5432/frostpoint_test")
os.environ["DATABASE_URL"] = TEST_URL
os.environ["SEED_DEMO"] = "false"

from sqlalchemy import create_engine, text  # noqa: E402

admin_url = TEST_URL.rsplit("/", 1)[0] + "/postgres"
with create_engine(admin_url, isolation_level="AUTOCOMMIT").connect() as c:
    if not c.scalar(text("select 1 from pg_database where datname='frostpoint_test'")):
        c.execute(text("create database frostpoint_test"))

from fastapi.testclient import TestClient  # noqa: E402

from app import models, seed  # noqa: E402,F401
from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed.run()
    from app.routers import auth
    auth._attempts.clear()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}


@pytest.fixture
def admin(client):
    return login(client, "admin@frostpoint.ph", "Frostpoint123!")


@pytest.fixture
def customer(client):
    r = client.post("/api/auth/register", json={
        "name": "Test Cust", "email": "t@example.com", "password": "Password123", "phone": "+63 917 123 4567"})
    assert r.status_code == 201, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}
