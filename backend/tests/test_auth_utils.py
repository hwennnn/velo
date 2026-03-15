"""
Unit tests for app/core/auth.py - create_user_if_not_exists function.
"""
import os
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, select

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.models.user import User
from app.core.auth import create_user_if_not_exists, get_current_user
from app.core.database import get_session
from fastapi import HTTPException


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    maker = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s


class TestCreateUserIfNotExists:

    @pytest.mark.asyncio
    async def test_creates_new_user(self, session):
        """Creates a new user when none exists."""
        user = await create_user_if_not_exists(
            user_id="new-user-001",
            email="new@example.com",
            session=session,
        )
        assert user.id == "new-user-001"
        assert user.email == "new@example.com"
        assert user.display_name == "new"  # from email split

    @pytest.mark.asyncio
    async def test_creates_new_user_with_display_name(self, session):
        """Creates a new user with display name."""
        user = await create_user_if_not_exists(
            user_id="new-user-002",
            email="name@example.com",
            session=session,
            display_name="John Doe",
        )
        assert user.display_name == "John Doe"

    @pytest.mark.asyncio
    async def test_creates_new_user_with_avatar(self, session):
        """Creates a new user with avatar URL."""
        user = await create_user_if_not_exists(
            user_id="new-user-003",
            email="avatar@example.com",
            session=session,
            avatar_url="https://example.com/avatar.png",
        )
        assert user.avatar_url == "https://example.com/avatar.png"

    @pytest.mark.asyncio
    async def test_returns_existing_user_unchanged(self, session):
        """Returns existing user without changes when no new profile data."""
        existing = User(id="existing-001", email="existing@example.com", display_name="Existing")
        session.add(existing)
        await session.commit()

        user = await create_user_if_not_exists(
            user_id="existing-001",
            email="existing@example.com",
            session=session,
        )
        assert user.id == "existing-001"
        assert user.display_name == "Existing"

    @pytest.mark.asyncio
    async def test_updates_existing_user_display_name_when_empty(self, session):
        """Updates display_name for existing user when they don't have one."""
        existing = User(id="no-name-001", email="noname@example.com", display_name=None)
        session.add(existing)
        await session.commit()

        user = await create_user_if_not_exists(
            user_id="no-name-001",
            email="noname@example.com",
            session=session,
            display_name="New Name",
        )
        assert user.display_name == "New Name"

    @pytest.mark.asyncio
    async def test_does_not_overwrite_existing_display_name(self, session):
        """Does not overwrite display_name when already set."""
        existing = User(id="has-name-001", email="hasname@example.com", display_name="Old Name")
        session.add(existing)
        await session.commit()

        user = await create_user_if_not_exists(
            user_id="has-name-001",
            email="hasname@example.com",
            session=session,
            display_name="New Name",
        )
        assert user.display_name == "Old Name"

    @pytest.mark.asyncio
    async def test_updates_existing_user_avatar_when_empty(self, session):
        """Updates avatar_url for existing user when they don't have one."""
        existing = User(id="no-avatar-001", email="noavatar@example.com", display_name="User", avatar_url=None)
        session.add(existing)
        await session.commit()

        user = await create_user_if_not_exists(
            user_id="no-avatar-001",
            email="noavatar@example.com",
            session=session,
            avatar_url="https://example.com/new.png",
        )
        assert user.avatar_url == "https://example.com/new.png"

    @pytest.mark.asyncio
    async def test_does_not_overwrite_existing_avatar(self, session):
        """Does not overwrite avatar_url when already set."""
        existing = User(
            id="has-avatar-001",
            email="hasavatar@example.com",
            display_name="User",
            avatar_url="https://example.com/old.png",
        )
        session.add(existing)
        await session.commit()

        user = await create_user_if_not_exists(
            user_id="has-avatar-001",
            email="hasavatar@example.com",
            session=session,
            avatar_url="https://example.com/new.png",
        )
        assert user.avatar_url == "https://example.com/old.png"

    @pytest.mark.asyncio
    async def test_updates_both_display_name_and_avatar_when_both_empty(self, session):
        """Updates both display_name and avatar_url when both are missing."""
        existing = User(id="empty-both-001", email="both@example.com", display_name=None, avatar_url=None)
        session.add(existing)
        await session.commit()

        user = await create_user_if_not_exists(
            user_id="empty-both-001",
            email="both@example.com",
            session=session,
            display_name="Full Name",
            avatar_url="https://example.com/pic.png",
        )
        assert user.display_name == "Full Name"
        assert user.avatar_url == "https://example.com/pic.png"


class TestGetCurrentUser:

    @pytest.mark.asyncio
    async def test_get_current_user_returns_existing_user(self, session):
        """get_current_user returns user from database."""
        from app.main import app
        from app.core.auth import get_current_user_id

        user = User(id="get-user-001", email="getuser@example.com", display_name="Get User")
        session.add(user)
        await session.commit()

        async def get_session_override():
            yield session

        async def get_user_id_override():
            return "get-user-001"

        app.dependency_overrides[get_session] = get_session_override
        app.dependency_overrides[get_current_user_id] = get_user_id_override

        try:
            from httpx import AsyncClient, ASGITransport
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test/api") as client:
                resp = await client.get("/users/me")
                assert resp.status_code == 200
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_current_user_not_found_returns_404(self, session):
        """get_current_user raises 404 when user not in DB."""
        from app.main import app
        from app.core.auth import get_current_user_id

        async def get_session_override():
            yield session

        async def get_user_id_override():
            return "nonexistent-user-xyz"

        app.dependency_overrides[get_session] = get_session_override
        app.dependency_overrides[get_current_user_id] = get_user_id_override

        try:
            from httpx import AsyncClient, ASGITransport
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test/api") as client:
                resp = await client.get("/users/me")
                assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()


class TestGetCurrentUserId:

    @pytest.mark.asyncio
    async def test_valid_token_returns_user_id(self):
        """get_current_user_id extracts user_id from a valid JWT payload."""
        from unittest.mock import MagicMock, patch
        from fastapi.security import HTTPAuthorizationCredentials
        from app.core.auth import get_current_user_id

        mock_key = MagicMock()
        mock_key.key = "test-key"

        with patch("app.core.auth._get_supabase_jwks_client") as mock_jwks, \
             patch("app.core.auth.jwt_decode") as mock_decode:
            mock_jwks.return_value.get_signing_key_from_jwt.return_value = mock_key
            mock_decode.return_value = {"sub": "user-abc-123"}
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake.jwt.token")
            result = await get_current_user_id(credentials)
            assert result == "user-abc-123"

    @pytest.mark.asyncio
    async def test_missing_sub_raises_401(self):
        """get_current_user_id raises 401 when JWT payload has no sub field."""
        from unittest.mock import MagicMock, patch
        from fastapi.security import HTTPAuthorizationCredentials
        from fastapi import HTTPException
        from app.core.auth import get_current_user_id

        mock_key = MagicMock()
        mock_key.key = "test-key"

        with patch("app.core.auth._get_supabase_jwks_client") as mock_jwks, \
             patch("app.core.auth.jwt_decode") as mock_decode:
            mock_jwks.return_value.get_signing_key_from_jwt.return_value = mock_key
            mock_decode.return_value = {"email": "test@example.com"}  # no sub
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake.jwt.token")
            with pytest.raises(HTTPException) as exc:
                await get_current_user_id(credentials)
            assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        """get_current_user_id raises 401 when InvalidTokenError is thrown."""
        from unittest.mock import patch
        from fastapi.security import HTTPAuthorizationCredentials
        from fastapi import HTTPException
        from jwt import InvalidTokenError
        from app.core.auth import get_current_user_id

        with patch("app.core.auth._get_supabase_jwks_client") as mock_jwks:
            mock_jwks.return_value.get_signing_key_from_jwt.side_effect = InvalidTokenError("bad token")
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token")
            with pytest.raises(HTTPException) as exc:
                await get_current_user_id(credentials)
            assert exc.value.status_code == 401

    def test_get_supabase_jwks_client_returns_pyjwkclient(self):
        """_get_supabase_jwks_client creates and returns a PyJWKClient instance."""
        from jwt import PyJWKClient
        from app.core.auth import _get_supabase_jwks_client
        _get_supabase_jwks_client.cache_clear()
        client = _get_supabase_jwks_client()
        assert isinstance(client, PyJWKClient)

    @pytest.mark.asyncio
    async def test_no_audience_skips_aud_verification(self):
        """get_current_user_id sets verify_aud=False when supabase_jwt_audience is falsy."""
        from unittest.mock import MagicMock, patch
        from fastapi.security import HTTPAuthorizationCredentials
        from app.core.auth import get_current_user_id

        mock_key = MagicMock()
        mock_key.key = "test-key"

        with patch("app.core.auth._get_supabase_jwks_client") as mock_jwks, \
             patch("app.core.auth.jwt_decode") as mock_decode, \
             patch("app.core.auth.settings") as mock_settings:
            mock_settings.supabase_jwt_audience = None
            mock_settings.supabase_url = "http://localhost:54321"
            mock_settings.jwt_algorithm = "ES256"
            mock_jwks.return_value.get_signing_key_from_jwt.return_value = mock_key
            mock_decode.return_value = {"sub": "user-no-aud"}
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake.jwt.token")
            result = await get_current_user_id(credentials)
            assert result == "user-no-aud"
            # Verify verify_aud=False was passed
            call_kwargs = mock_decode.call_args
            options = call_kwargs.kwargs.get("options") or (call_kwargs.args[4] if len(call_kwargs.args) > 4 else None)
            assert options is not None
            assert options.get("verify_aud") is False
