"""
Unit tests for app/services/balance.py (legacy service)

Tests the Balance, Settlement classes and get_member_balance_details function.
"""

import os
import pytest
import pytest_asyncio
from decimal import Decimal
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.models.expense import Expense
from app.models.split import Split
from app.core.datetime_utils import utcnow
from app.services.balance import Balance, Settlement, get_member_balance_details

TEST_USER_ID = "balance-svc-test-user-001"


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
        user = User(id=TEST_USER_ID, email="balsvc@example.com", display_name="Bal Svc User")
        session.add(user)
        await session.commit()
        yield session


async def setup_trip_with_members(session):
    """Helper to create trip with two members."""
    now = utcnow()
    trip = Trip(
        name="Balance Test Trip",
        base_currency="USD",
        created_by=TEST_USER_ID,
        created_at=now,
        updated_at=now,
    )
    session.add(trip)
    await session.commit()
    await session.refresh(trip)

    alice = TripMember(trip_id=trip.id, nickname="Alice", status="active", is_admin=False)
    bob = TripMember(trip_id=trip.id, nickname="Bob", status="active", is_admin=False)
    session.add(alice)
    session.add(bob)
    await session.commit()
    await session.refresh(alice)
    await session.refresh(bob)
    return trip, alice, bob


class TestBalance:
    def test_initial_values_zero(self):
        b = Balance(member_id=1, member_nickname="Alice")
        assert b.total_paid == Decimal("0.0")
        assert b.total_owed == Decimal("0.0")
        assert b.net_balance == Decimal("0.0")

    def test_to_dict_structure(self):
        b = Balance(member_id=1, member_nickname="Alice")
        b.total_paid = Decimal("100")
        b.total_owed = Decimal("50")
        b.net_balance = Decimal("50")
        d = b.to_dict()
        assert d["member_id"] == 1
        assert d["member_nickname"] == "Alice"
        assert d["total_paid"] == 100.0
        assert d["total_owed"] == 50.0
        assert d["net_balance"] == 50.0

    def test_to_dict_currency_balances_filters_zeros(self):
        b = Balance(member_id=1, member_nickname="Alice")
        b.currency_balances["USD"] = Decimal("0.005")  # near zero
        b.currency_balances["EUR"] = Decimal("50")
        d = b.to_dict()
        # USD near-zero should be filtered out
        assert "EUR" in d["currency_balances"]
        # USD is below 0.01 threshold
        assert "USD" not in d.get("currency_balances", {})


class TestSettlement:
    def test_to_dict_structure(self):
        s = Settlement(
            from_member_id=1,
            to_member_id=2,
            amount=Decimal("50"),
            currency="USD",
            from_nickname="Alice",
            to_nickname="Bob",
        )
        d = s.to_dict()
        assert d["from_member_id"] == 1
        assert d["to_member_id"] == 2
        assert d["amount"] == 50.0
        assert d["currency"] == "USD"
        assert d["from_nickname"] == "Alice"
        assert d["to_nickname"] == "Bob"

    def test_default_currency(self):
        s = Settlement(from_member_id=1, to_member_id=2, amount=Decimal("10"))
        assert s.currency == ""

    def test_default_nicknames_empty(self):
        s = Settlement(from_member_id=1, to_member_id=2, amount=Decimal("10"))
        assert s.from_nickname == ""
        assert s.to_nickname == ""


class TestGetMemberBalanceDetails:
    @pytest.mark.asyncio
    async def test_nonexistent_member_returns_empty(self, async_session):
        result = await get_member_balance_details(999, 9999, async_session)
        assert result == {}

    @pytest.mark.asyncio
    async def test_wrong_trip_returns_empty(self, async_session):
        """Member from different trip returns empty."""
        trip, alice, bob = await setup_trip_with_members(async_session)

        # Create another trip
        now = utcnow()
        trip2 = Trip(
            name="Other Trip", base_currency="USD",
            created_by=TEST_USER_ID, created_at=now, updated_at=now,
        )
        async_session.add(trip2)
        await async_session.commit()
        await async_session.refresh(trip2)

        # Try to get alice's balance for the wrong trip
        result = await get_member_balance_details(trip2.id, alice.id, async_session)
        assert result == {}

    @pytest.mark.asyncio
    async def test_member_with_no_expenses_zero_balance(self, async_session):
        trip, alice, bob = await setup_trip_with_members(async_session)
        result = await get_member_balance_details(trip.id, alice.id, async_session)
        assert result["total_paid"] == 0.0
        assert result["total_owed"] == 0.0
        assert result["net_balance"] == 0.0

    @pytest.mark.asyncio
    async def test_member_balance_with_expense(self, async_session):
        trip, alice, bob = await setup_trip_with_members(async_session)

        now = utcnow()
        expense = Expense(
            trip_id=trip.id,
            description="Dinner",
            amount=Decimal("100"),
            currency="USD",
            exchange_rate_to_base=Decimal("1.0"),
            paid_by_member_id=alice.id,
            expense_type="expense",
            created_by=TEST_USER_ID,
            created_at=now,
            updated_at=now,
        )
        async_session.add(expense)
        await async_session.flush()

        split_a = Split(expense_id=expense.id, member_id=alice.id, amount=Decimal("50"))
        split_b = Split(expense_id=expense.id, member_id=bob.id, amount=Decimal("50"))
        async_session.add(split_a)
        async_session.add(split_b)
        await async_session.commit()

        result = await get_member_balance_details(trip.id, alice.id, async_session)
        assert result["member_id"] == alice.id
        assert result["member_nickname"] == "Alice"
        assert abs(result["total_paid"] - 100.0) < 0.01
        assert abs(result["total_owed"] - 50.0) < 0.01
        assert abs(result["net_balance"] - 50.0) < 0.01

    @pytest.mark.asyncio
    async def test_result_includes_expenses_paid_list(self, async_session):
        trip, alice, bob = await setup_trip_with_members(async_session)

        now = utcnow()
        expense = Expense(
            trip_id=trip.id,
            description="Groceries",
            amount=Decimal("80"),
            currency="USD",
            exchange_rate_to_base=Decimal("1.0"),
            paid_by_member_id=alice.id,
            expense_type="expense",
            created_by=TEST_USER_ID,
            created_at=now,
            updated_at=now,
        )
        async_session.add(expense)
        await async_session.flush()

        split = Split(expense_id=expense.id, member_id=alice.id, amount=Decimal("80"))
        async_session.add(split)
        await async_session.commit()

        result = await get_member_balance_details(trip.id, alice.id, async_session)
        assert "expenses_paid" in result
        assert len(result["expenses_paid"]) == 1
        assert result["expenses_paid"][0]["description"] == "Groceries"

    @pytest.mark.asyncio
    async def test_result_includes_expenses_owed_list(self, async_session):
        trip, alice, bob = await setup_trip_with_members(async_session)

        now = utcnow()
        expense = Expense(
            trip_id=trip.id,
            description="Hotel",
            amount=Decimal("200"),
            currency="USD",
            exchange_rate_to_base=Decimal("1.0"),
            paid_by_member_id=bob.id,
            expense_type="expense",
            created_by=TEST_USER_ID,
            created_at=now,
            updated_at=now,
        )
        async_session.add(expense)
        await async_session.flush()

        # Alice owes Bob $100
        split = Split(expense_id=expense.id, member_id=alice.id, amount=Decimal("100"))
        async_session.add(split)
        await async_session.commit()

        result = await get_member_balance_details(trip.id, alice.id, async_session)
        assert "expenses_owed" in result
        assert len(result["expenses_owed"]) == 1
        assert result["expenses_owed"][0]["description"] == "Hotel"
        assert abs(result["expenses_owed"][0]["original_amount"] - 100.0) < 0.01
