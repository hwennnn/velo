"""
TDD test suite for user profile endpoints.

Covers:
- GET /users/me: returns current user profile
- PUT /users/me: updates display_name, avatar_url
- POST /users/register: creates user profile
"""

import os
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.main import app
from app.core.database import get_session
from app.core.auth import get_current_user_id, get_current_user
from app.models.user import User

TEST_USER_ID = "users-test-user-001"
TEST_USER_EMAIL = "users@example.com"


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    maker = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        user = User(
            id=TEST_USER_ID,
            email=TEST_USER_EMAIL,
            display_name="Test User",
            avatar_url=None,
        )
        session.add(user)
        await session.commit()
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def get_session_override():
        yield async_session

    async def get_current_user_id_override():
        return TEST_USER_ID

    async def get_current_user_override():
        # Return the user from the session to avoid SQLAlchemy identity conflicts
        from sqlmodel import select
        result = await async_session.execute(
            select(User).where(User.id == TEST_USER_ID)
        )
        user = result.scalar_one_or_none()
        if user is None:
            user = User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Test User")
        return user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user_id] = get_current_user_id_override
    app.dependency_overrides[get_current_user] = get_current_user_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c

    app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# GET /users/me TESTS
# ──────────────────────────────────────────────


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_get_me_returns_user(self, client):
        """GET /users/me returns current user profile."""
        resp = await client.get("/users/me")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_get_me_returns_correct_id(self, client):
        """GET /users/me returns the correct user ID."""
        resp = await client.get("/users/me")
        data = resp.json()
        assert data["id"] == TEST_USER_ID

    @pytest.mark.asyncio
    async def test_get_me_returns_correct_email(self, client):
        """GET /users/me returns the correct email."""
        resp = await client.get("/users/me")
        data = resp.json()
        assert data["email"] == TEST_USER_EMAIL

    @pytest.mark.asyncio
    async def test_get_me_returns_display_name(self, client):
        """GET /users/me includes display_name field."""
        resp = await client.get("/users/me")
        data = resp.json()
        assert "display_name" in data

    @pytest.mark.asyncio
    async def test_get_me_includes_avatar_url_field(self, client):
        """GET /users/me includes avatar_url field (may be null)."""
        resp = await client.get("/users/me")
        data = resp.json()
        assert "avatar_url" in data


# ──────────────────────────────────────────────
# PUT /users/me TESTS
# ──────────────────────────────────────────────


class TestUpdateCurrentUser:
    @pytest.mark.asyncio
    async def test_update_display_name(self, client, async_session):
        """PUT /users/me updates display_name."""
        resp = await client.put("/users/me", json={"display_name": "New Display Name"})
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "New Display Name"

    @pytest.mark.asyncio
    async def test_update_avatar_url(self, client, async_session):
        """PUT /users/me updates avatar_url."""
        url = "https://example.com/avatar.png"
        resp = await client.put("/users/me", json={"avatar_url": url})
        assert resp.status_code == 200
        assert resp.json()["avatar_url"] == url

    @pytest.mark.asyncio
    async def test_update_partial_fields_preserves_others(self, client, async_session):
        """Partial update leaves other fields unchanged."""
        # First set avatar
        await client.put("/users/me", json={"avatar_url": "https://old.com/img.png"})

        # Update only display_name
        resp = await client.put("/users/me", json={"display_name": "Only Name Changed"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["display_name"] == "Only Name Changed"
        # Email should be unchanged
        assert data["email"] == TEST_USER_EMAIL

    @pytest.mark.asyncio
    async def test_update_clears_avatar_url(self, client, async_session):
        """Can clear avatar_url by setting to null."""
        await client.put("/users/me", json={"avatar_url": "https://example.com/img.png"})
        resp = await client.put("/users/me", json={"avatar_url": None})
        assert resp.status_code == 200
        # avatar_url should be None or cleared
        data = resp.json()
        assert data.get("avatar_url") is None or data.get("avatar_url") == ""

    @pytest.mark.asyncio
    async def test_update_returns_full_user_object(self, client, async_session):
        """PUT /users/me returns the full user object."""
        resp = await client.put("/users/me", json={"display_name": "Full Object"})
        data = resp.json()
        assert "id" in data
        assert "email" in data
        assert "display_name" in data
        assert "avatar_url" in data

    @pytest.mark.asyncio
    async def test_update_empty_body_does_not_error(self, client, async_session):
        """PUT /users/me with empty body is OK (no changes)."""
        resp = await client.put("/users/me", json={})
        assert resp.status_code == 200


# ──────────────────────────────────────────────
# POST /users/register TESTS
# ──────────────────────────────────────────────


class TestRegisterUser:
    @pytest.mark.asyncio
    async def test_register_new_user(self, client, async_session):
        """POST /users/register creates a new user profile."""
        new_user_id = "brand-new-user-999"
        resp = await client.post("/users/register", json={
            "user_id": new_user_id,
            "email": "brandnew@example.com",
            "display_name": "Brand New",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == new_user_id
        assert data["email"] == "brandnew@example.com"

    @pytest.mark.asyncio
    async def test_register_existing_user_idempotent(self, client, async_session):
        """POST /users/register for existing user is idempotent (returns existing user)."""
        resp = await client.post("/users/register", json={
            "user_id": TEST_USER_ID,
            "email": TEST_USER_EMAIL,
            "display_name": "Same User",
        })
        # Should succeed (not error)
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert data["id"] == TEST_USER_ID

    @pytest.mark.asyncio
    async def test_register_without_display_name(self, client, async_session):
        """POST /users/register works without display_name."""
        resp = await client.post("/users/register", json={
            "user_id": "user-no-display",
            "email": "nodisplay@example.com",
        })
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_register_returns_correct_fields(self, client, async_session):
        """POST /users/register returns id, email, display_name, avatar_url."""
        resp = await client.post("/users/register", json={
            "user_id": "field-check-user",
            "email": "fields@example.com",
            "display_name": "Field Check",
        })
        data = resp.json()
        assert "id" in data
        assert "email" in data
        assert "display_name" in data
        assert "avatar_url" in data

    @pytest.mark.asyncio
    async def test_register_with_avatar_url(self, client, async_session):
        """POST /users/register with avatar_url stores it."""
        resp = await client.post("/users/register", json={
            "user_id": "avatar-user",
            "email": "avatar@example.com",
            "avatar_url": "https://example.com/avatar.png",
        })
        assert resp.status_code == 201
        assert resp.json()["avatar_url"] == "https://example.com/avatar.png"

    @pytest.mark.asyncio
    async def test_register_invalid_email_rejected(self, client, async_session):
        """POST /users/register with invalid email returns 422."""
        resp = await client.post("/users/register", json={
            "user_id": "bad-email-user",
            "email": "not-an-email",
        })
        assert resp.status_code == 422
