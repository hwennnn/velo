"""
TDD test suite for trip CRUD operations.

Covers:
- list_trips: empty, pagination, multiple trips
- get_trip: found/not found/not a member
- update_trip: name, dates, base_currency, simplify_debts
- update_trip date validation (end < start)
- delete_trip (soft delete)
- delete_trip non-admin blocked
- Trip shows correct expense_count and total_spent
"""

import os
import pytest
import pytest_asyncio
from decimal import Decimal
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

TEST_USER_ID = "trips-test-user-001"
TEST_USER_EMAIL = "trips@example.com"

SECOND_USER_ID = "trips-test-user-002"
SECOND_USER_EMAIL = "trips2@example.com"


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
        user = User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Trips User")
        user2 = User(id=SECOND_USER_ID, email=SECOND_USER_EMAIL, display_name="Second User")
        session.add(user)
        session.add(user2)
        await session.commit()
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def get_session_override():
        yield async_session

    async def get_current_user_id_override():
        return TEST_USER_ID

    async def get_current_user_override():
        return User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Trips User")

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user_id] = get_current_user_id_override
    app.dependency_overrides[get_current_user] = get_current_user_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def second_client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Client authenticated as the second user."""
    async def get_session_override():
        yield async_session

    async def get_current_user_id_override():
        return SECOND_USER_ID

    async def get_current_user_override():
        return User(id=SECOND_USER_ID, email=SECOND_USER_EMAIL, display_name="Second User")

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user_id] = get_current_user_id_override
    app.dependency_overrides[get_current_user] = get_current_user_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c

    app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# LIST TRIPS TESTS
# ──────────────────────────────────────────────


class TestListTrips:
    @pytest.mark.asyncio
    async def test_list_trips_empty(self, client):
        """New user with no trips returns empty list."""
        resp = await client.get("/trips/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["trips"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_trips_single_trip(self, client):
        """User with one trip returns that trip."""
        await client.post("/trips/", json={"name": "My Trip", "base_currency": "USD"})
        resp = await client.get("/trips/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert len(data["trips"]) == 1
        assert data["trips"][0]["name"] == "My Trip"

    @pytest.mark.asyncio
    async def test_list_trips_multiple(self, client):
        """Multiple trips all listed."""
        await client.post("/trips/", json={"name": "Trip A", "base_currency": "USD"})
        await client.post("/trips/", json={"name": "Trip B", "base_currency": "EUR"})
        await client.post("/trips/", json={"name": "Trip C", "base_currency": "GBP"})

        resp = await client.get("/trips/")
        data = resp.json()
        assert data["total"] == 3
        names = {t["name"] for t in data["trips"]}
        assert names == {"Trip A", "Trip B", "Trip C"}

    @pytest.mark.asyncio
    async def test_list_trips_pagination(self, client):
        """Pagination with page_size=2 returns 2 items per page."""
        for i in range(5):
            await client.post("/trips/", json={"name": f"Trip {i}", "base_currency": "USD"})

        resp = await client.get("/trips/?page=1&page_size=2")
        data = resp.json()
        assert len(data["trips"]) == 2
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 2

    @pytest.mark.asyncio
    async def test_list_trips_page_2(self, client):
        """Page 2 returns different items than page 1."""
        for i in range(4):
            await client.post("/trips/", json={"name": f"Trip {i}", "base_currency": "USD"})

        resp1 = await client.get("/trips/?page=1&page_size=2")
        resp2 = await client.get("/trips/?page=2&page_size=2")

        ids1 = {t["id"] for t in resp1.json()["trips"]}
        ids2 = {t["id"] for t in resp2.json()["trips"]}
        assert ids1.isdisjoint(ids2), "Pages should not overlap"

    @pytest.mark.asyncio
    async def test_list_trips_includes_member_count(self, client):
        """Each trip in list includes member_count."""
        await client.post("/trips/", json={"name": "Trip with Count", "base_currency": "USD"})
        resp = await client.get("/trips/")
        trip = resp.json()["trips"][0]
        assert "member_count" in trip
        assert trip["member_count"] >= 1  # at least the creator

    @pytest.mark.asyncio
    async def test_deleted_trips_not_listed(self, client):
        """Soft-deleted trips don't appear in list."""
        create_resp = await client.post("/trips/", json={"name": "To Delete", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        await client.delete(f"/trips/{trip_id}")

        resp = await client.get("/trips/")
        names = [t["name"] for t in resp.json()["trips"]]
        assert "To Delete" not in names


# ──────────────────────────────────────────────
# GET TRIP TESTS
# ──────────────────────────────────────────────


class TestGetTrip:
    @pytest.mark.asyncio
    async def test_get_trip_found(self, client):
        """Get a trip by ID returns its details."""
        create_resp = await client.post("/trips/", json={
            "name": "Findable Trip",
            "base_currency": "USD",
            "description": "A trip",
        })
        trip_id = create_resp.json()["id"]

        resp = await client.get(f"/trips/{trip_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == trip_id
        assert data["name"] == "Findable Trip"

    @pytest.mark.asyncio
    async def test_get_trip_not_found(self, client):
        """Non-existent trip ID returns 404."""
        resp = await client.get("/trips/999999")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_trip_includes_members(self, client):
        """Get trip returns members array."""
        create_resp = await client.post("/trips/", json={"name": "Members Trip", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]
        await client.post(f"/trips/{trip_id}/members", json={"nickname": "Guest"})

        resp = await client.get(f"/trips/{trip_id}")
        data = resp.json()
        assert "members" in data
        assert len(data["members"]) >= 2  # creator + Guest

    @pytest.mark.asyncio
    async def test_get_trip_non_member_forbidden(self, async_session):
        """Non-member cannot get trip details."""
        from app.core.auth import get_current_user_id, get_current_user
        from app.core.database import get_session

        # Create trip as user1
        async def get_session_u1():
            yield async_session

        async def get_user_u1():
            return User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="User1")

        app.dependency_overrides[get_session] = get_session_u1
        app.dependency_overrides[get_current_user] = get_user_u1

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test/api") as c1:
            create_resp = await c1.post("/trips/", json={"name": "Private Trip", "base_currency": "USD"})
            trip_id = create_resp.json()["id"]

        # Try to access as user2 (non-member)
        async def get_user_u2():
            return User(id=SECOND_USER_ID, email=SECOND_USER_EMAIL, display_name="User2")

        app.dependency_overrides[get_current_user] = get_user_u2
        async with AsyncClient(transport=transport, base_url="http://test/api") as c2:
            resp = await c2.get(f"/trips/{trip_id}")
            assert resp.status_code == 403

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_deleted_trip_not_found(self, client):
        """Soft-deleted trip returns 404."""
        create_resp = await client.post("/trips/", json={"name": "Gone Trip", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]
        await client.delete(f"/trips/{trip_id}")

        resp = await client.get(f"/trips/{trip_id}")
        assert resp.status_code == 404


# ──────────────────────────────────────────────
# UPDATE TRIP TESTS
# ──────────────────────────────────────────────


class TestUpdateTrip:
    @pytest.mark.asyncio
    async def test_update_trip_name(self, client):
        """Admin can update trip name."""
        create_resp = await client.post("/trips/", json={"name": "Old Name", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        resp = await client.put(f"/trips/{trip_id}", json={"name": "New Name"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    @pytest.mark.asyncio
    async def test_update_trip_base_currency(self, client):
        """Admin can update base currency."""
        create_resp = await client.post("/trips/", json={"name": "Currency Trip", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        resp = await client.put(f"/trips/{trip_id}", json={"base_currency": "EUR"})
        assert resp.status_code == 200
        assert resp.json()["base_currency"] == "EUR"

    @pytest.mark.asyncio
    async def test_update_trip_simplify_debts(self, client):
        """Admin can toggle simplify_debts."""
        create_resp = await client.post("/trips/", json={
            "name": "Simplify Trip",
            "base_currency": "USD",
            "simplify_debts": False,
        })
        trip_id = create_resp.json()["id"]

        resp = await client.put(f"/trips/{trip_id}", json={"simplify_debts": True})
        assert resp.status_code == 200
        assert resp.json()["simplify_debts"] is True

    @pytest.mark.asyncio
    async def test_update_trip_dates(self, client):
        """Admin can update start and end dates."""
        create_resp = await client.post("/trips/", json={"name": "Dated Trip", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        resp = await client.put(f"/trips/{trip_id}", json={
            "start_date": "2025-06-01",
            "end_date": "2025-06-15",
        })
        assert resp.status_code == 200
        assert resp.json()["start_date"] == "2025-06-01"
        assert resp.json()["end_date"] == "2025-06-15"

    @pytest.mark.asyncio
    async def test_update_trip_end_before_start_rejected(self, client):
        """Date validation: end_date < start_date → 400."""
        create_resp = await client.post("/trips/", json={
            "name": "Bad Dates Trip",
            "base_currency": "USD",
            "start_date": "2025-06-10",
            "end_date": "2025-06-20",
        })
        trip_id = create_resp.json()["id"]

        resp = await client.put(f"/trips/{trip_id}", json={
            "start_date": "2025-06-10",
            "end_date": "2025-06-01",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_update_trip_non_admin_blocked(self, async_session):
        """Non-admin member cannot update trip."""
        from app.core.auth import get_current_user_id, get_current_user
        from app.core.database import get_session

        async def get_session_override():
            yield async_session

        async def get_user_u1():
            return User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="User1")

        app.dependency_overrides[get_session] = get_session_override
        app.dependency_overrides[get_current_user] = get_user_u1

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test/api") as c1:
            create_resp = await c1.post("/trips/", json={"name": "Admin Only", "base_currency": "USD"})
            trip_id = create_resp.json()["id"]
            # Add second user as non-admin member
            await c1.post(f"/trips/{trip_id}/members", json={
                "nickname": "NonAdmin",
                "email": SECOND_USER_EMAIL,
            })

        # Try to update as user2 (non-admin member)
        async def get_user_u2():
            return User(id=SECOND_USER_ID, email=SECOND_USER_EMAIL, display_name="User2")

        app.dependency_overrides[get_current_user] = get_user_u2
        async with AsyncClient(transport=transport, base_url="http://test/api") as c2:
            resp = await c2.put(f"/trips/{trip_id}", json={"name": "Changed"})
            assert resp.status_code == 403

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_update_nonexistent_trip_returns_404(self, client):
        """Updating non-existent trip returns 404."""
        resp = await client.put("/trips/999999", json={"name": "Ghost"})
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_trip_invalid_currency_rejected(self, client):
        """Invalid currency code → 422."""
        create_resp = await client.post("/trips/", json={"name": "Currency Trip", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        resp = await client.put(f"/trips/{trip_id}", json={"base_currency": "XYZ"})
        assert resp.status_code == 422


# ──────────────────────────────────────────────
# DELETE TRIP TESTS
# ──────────────────────────────────────────────


class TestDeleteTrip:
    @pytest.mark.asyncio
    async def test_delete_trip_soft_deletes(self, client):
        """DELETE soft-deletes the trip (is_deleted=True)."""
        create_resp = await client.post("/trips/", json={"name": "Delete Me", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        del_resp = await client.delete(f"/trips/{trip_id}")
        assert del_resp.status_code == 204

        # Trip should no longer be accessible
        get_resp = await client.get(f"/trips/{trip_id}")
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_trip_returns_204(self, client):
        """DELETE returns 204 No Content."""
        create_resp = await client.post("/trips/", json={"name": "Delete 204", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        resp = await client.delete(f"/trips/{trip_id}")
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_nonexistent_trip_returns_404(self, client):
        """Deleting non-existent trip returns 404."""
        resp = await client.delete("/trips/999999")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_trip_non_admin_blocked(self, async_session):
        """Non-admin cannot delete trip."""
        from app.core.auth import get_current_user_id, get_current_user
        from app.core.database import get_session

        async def get_session_override():
            yield async_session

        async def get_user_u1():
            return User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="User1")

        app.dependency_overrides[get_session] = get_session_override
        app.dependency_overrides[get_current_user] = get_user_u1

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test/api") as c1:
            create_resp = await c1.post("/trips/", json={"name": "Protected Trip", "base_currency": "USD"})
            trip_id = create_resp.json()["id"]
            await c1.post(f"/trips/{trip_id}/members", json={
                "nickname": "NonAdmin",
                "email": SECOND_USER_EMAIL,
            })

        # Try to delete as user2 (non-admin member)
        async def get_user_u2():
            return User(id=SECOND_USER_ID, email=SECOND_USER_EMAIL, display_name="User2")

        app.dependency_overrides[get_current_user] = get_user_u2
        async with AsyncClient(transport=transport, base_url="http://test/api") as c2:
            resp = await c2.delete(f"/trips/{trip_id}")
            assert resp.status_code == 403

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_delete_already_deleted_trip_returns_404(self, client):
        """Double-deleting a trip returns 404 the second time."""
        create_resp = await client.post("/trips/", json={"name": "Double Delete", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        await client.delete(f"/trips/{trip_id}")
        resp = await client.delete(f"/trips/{trip_id}")
        assert resp.status_code == 404


# ──────────────────────────────────────────────
# TRIP METADATA TESTS
# ──────────────────────────────────────────────


class TestTripMetadata:
    @pytest.mark.asyncio
    async def test_expense_count_increments(self, client):
        """Creating an expense increments expense_count."""
        create_resp = await client.post("/trips/", json={"name": "Meta Trip", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        # Get creator member id
        trip_data = await client.get(f"/trips/{trip_id}")
        creator_member = next(m for m in trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)

        await client.post(f"/trips/{trip_id}/expenses", json={
            "description": "Dinner",
            "amount": 50,
            "currency": "USD",
            "paid_by_member_id": creator_member["id"],
            "split_type": "equal",
        })

        trip_resp = await client.get(f"/trips/{trip_id}")
        assert trip_resp.json()["expense_count"] == 1

    @pytest.mark.asyncio
    async def test_total_spent_increments(self, client):
        """Creating an expense increments total_spent."""
        create_resp = await client.post("/trips/", json={"name": "Spend Trip", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        trip_data = await client.get(f"/trips/{trip_id}")
        creator_member = next(m for m in trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)

        await client.post(f"/trips/{trip_id}/expenses", json={
            "description": "Hotel",
            "amount": 200,
            "currency": "USD",
            "paid_by_member_id": creator_member["id"],
            "split_type": "equal",
        })

        trip_resp = await client.get(f"/trips/{trip_id}")
        assert float(trip_resp.json()["total_spent"]) >= 200.0

    @pytest.mark.asyncio
    async def test_expense_count_decrements_on_delete(self, client):
        """Deleting an expense decrements expense_count."""
        create_resp = await client.post("/trips/", json={"name": "Count Trip", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]

        trip_data = await client.get(f"/trips/{trip_id}")
        creator_member = next(m for m in trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)

        exp_resp = await client.post(f"/trips/{trip_id}/expenses", json={
            "description": "Taxi",
            "amount": 30,
            "currency": "USD",
            "paid_by_member_id": creator_member["id"],
            "split_type": "equal",
        })
        expense_id = exp_resp.json()["id"]

        await client.delete(f"/trips/{trip_id}/expenses/{expense_id}")

        trip_resp = await client.get(f"/trips/{trip_id}")
        assert trip_resp.json()["expense_count"] == 0

    @pytest.mark.asyncio
    async def test_initial_expense_count_is_zero(self, client):
        """New trip starts with expense_count = 0."""
        create_resp = await client.post("/trips/", json={"name": "Zero Count", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]
        trip_resp = await client.get(f"/trips/{trip_id}")
        assert trip_resp.json()["expense_count"] == 0

    @pytest.mark.asyncio
    async def test_initial_total_spent_is_zero(self, client):
        """New trip starts with total_spent = 0."""
        create_resp = await client.post("/trips/", json={"name": "Zero Spend", "base_currency": "USD"})
        trip_id = create_resp.json()["id"]
        trip_resp = await client.get(f"/trips/{trip_id}")
        assert float(trip_resp.json()["total_spent"]) == 0.0


# ──────────────────────────────────────────────
# CREATE TRIP VALIDATION TESTS
# ──────────────────────────────────────────────


class TestCreateTripValidation:
    @pytest.mark.asyncio
    async def test_create_trip_minimal(self, client):
        """Minimal trip (name + base_currency) creates successfully."""
        resp = await client.post("/trips/", json={"name": "Minimal", "base_currency": "USD"})
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_create_trip_with_dates(self, client):
        """Trip with valid dates creates successfully."""
        resp = await client.post("/trips/", json={
            "name": "Dated",
            "base_currency": "USD",
            "start_date": "2025-01-01",
            "end_date": "2025-01-10",
        })
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_create_trip_invalid_dates(self, client):
        """Trip with end before start returns 422."""
        resp = await client.post("/trips/", json={
            "name": "Bad Dates",
            "base_currency": "USD",
            "start_date": "2025-01-10",
            "end_date": "2025-01-01",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_trip_unsupported_currency(self, client):
        """Unsupported currency code returns 422."""
        resp = await client.post("/trips/", json={"name": "Bad Currency", "base_currency": "XYZ"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_trip_empty_name_rejected(self, client):
        """Empty name returns 422."""
        resp = await client.post("/trips/", json={"name": "", "base_currency": "USD"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_trip_creator_is_admin_member(self, client):
        """Creator is automatically added as admin."""
        resp = await client.post("/trips/", json={"name": "Admin Test", "base_currency": "USD"})
        trip_id = resp.json()["id"]

        trip_resp = await client.get(f"/trips/{trip_id}")
        members = trip_resp.json()["members"]
        creator = next((m for m in members if m["user_id"] == TEST_USER_ID), None)
        assert creator is not None
        assert creator["is_admin"] is True
        assert creator["status"] == "active"
