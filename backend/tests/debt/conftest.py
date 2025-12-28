"""
Async pytest fixtures for debt-related tests.
These fixtures provide async database sessions and test clients.
"""
import os
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

# Set environment variables before importing app
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.main import app
from app.core.database import get_session
from app.core.auth import get_current_user_id, get_current_user
from app.models.user import User


TEST_USER_ID = "test-user-id-12345"
TEST_USER_EMAIL = "test@example.com"


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """Create an async test database engine."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True,
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create an async test database session."""
    async_session_maker = sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session_maker() as session:
        # Create test user
        test_user = User(
            id=TEST_USER_ID,
            email=TEST_USER_EMAIL,
            display_name="Test User",
        )
        session.add(test_user)
        await session.commit()
        yield session


@pytest_asyncio.fixture(scope="function")
async def async_client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client with overridden database session and auth."""
    
    # Override get_session to return our test session
    async def get_session_override():
        yield async_session
    
    # Override auth to return test user ID
    async def get_current_user_id_override():
        return TEST_USER_ID
    
    # Override get_current_user to return test user
    async def get_current_user_override():
        user = User(
            id=TEST_USER_ID,
            email=TEST_USER_EMAIL,
            display_name="Test User",
        )
        return user
    
    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user_id] = get_current_user_id_override
    app.dependency_overrides[get_current_user] = get_current_user_override
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as client:
        yield client
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_trip(async_client: AsyncClient) -> dict:
    """Create a test trip and return its data."""
    trip_data = {
        "name": "Test Trip",
        "description": "A trip for testing",
        "base_currency": "USD",
    }
    response = await async_client.post("/trips/", json=trip_data)
    assert response.status_code == 201, f"Failed to create trip: {response.text}"
    return response.json()


@pytest_asyncio.fixture
async def test_members(async_client: AsyncClient, test_trip: dict) -> tuple:
    """Create two test members (A and B) for a trip."""
    trip_id = test_trip["id"]
    
    # Create Member A (fictional for testing)
    resp_a = await async_client.post(
        f"/trips/{trip_id}/members",
        json={"nickname": "Alice", "is_fictional": True}
    )
    assert resp_a.status_code == 201, f"Failed to create member A: {resp_a.text}"
    member_a = resp_a.json()
    
    # Create Member B (fictional for testing)
    resp_b = await async_client.post(
        f"/trips/{trip_id}/members",
        json={"nickname": "Bob", "is_fictional": True}
    )
    assert resp_b.status_code == 201, f"Failed to create member B: {resp_b.text}"
    member_b = resp_b.json()
    
    return member_a, member_b


@pytest_asyncio.fixture
async def test_member_c(async_client: AsyncClient, test_trip: dict) -> dict:
    """Create a third test member (C) for multi-party tests."""
    trip_id = test_trip["id"]
    resp = await async_client.post(
        f"/trips/{trip_id}/members",
        json={"nickname": "Charlie", "is_fictional": True}
    )
    assert resp.status_code == 201, f"Failed to create member C: {resp.text}"
    return resp.json()
