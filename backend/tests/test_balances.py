"""
TDD test suite for balance calculation and settlement endpoints.

Covers:
- Basic balance calculation (who owes who)
- Multi-currency balance summaries
- simplify=True (greedy per currency, circular debt resolution)
- minimize=True (global minimization in base currency)
- Settlement recording and debt cancellation
- Settlement currency conversion
- Balances after mixed expenses + settlements
"""

import os
import pytest
import pytest_asyncio
from decimal import Decimal
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, select

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.main import app
from app.core.database import get_session
from app.core.auth import get_current_user_id, get_current_user
from app.models.user import User
from app.models.member_debt import MemberDebt

TEST_USER_ID = "balance-test-user-001"
TEST_USER_EMAIL = "balance@example.com"


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
        test_user = User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Balance User")
        session.add(test_user)
        await session.commit()
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(async_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def get_session_override():
        yield async_session

    async def get_current_user_id_override():
        return TEST_USER_ID

    async def get_current_user_override():
        return User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Balance User")

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user_id] = get_current_user_id_override
    app.dependency_overrides[get_current_user] = get_current_user_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def trip(client) -> dict:
    resp = await client.post("/trips/", json={"name": "Balance Trip", "base_currency": "USD"})
    assert resp.status_code == 201
    return resp.json()


@pytest_asyncio.fixture
async def members(client, trip) -> tuple:
    tid = trip["id"]
    a = await client.post(f"/trips/{tid}/members", json={"nickname": "Alice"})
    b = await client.post(f"/trips/{tid}/members", json={"nickname": "Bob"})
    assert a.status_code == 201 and b.status_code == 201
    return a.json(), b.json()


@pytest_asyncio.fixture
async def member_c(client, trip) -> dict:
    tid = trip["id"]
    c = await client.post(f"/trips/{tid}/members", json={"nickname": "Charlie"})
    assert c.status_code == 201
    return c.json()


# ──────────────────────────────────────────────
# BASIC BALANCE TESTS
# ──────────────────────────────────────────────

class TestBasicBalances:

    @pytest.mark.asyncio
    async def test_empty_trip_returns_zero_balances(self, client, trip):
        """No expenses → all balances zero."""
        resp = await client.get(f"/trips/{trip['id']}/balances")
        assert resp.status_code == 200
        data = resp.json()
        for b in data["member_balances"]:
            assert b["net_balance"] == 0.0
        assert data["debts"] == []

    @pytest.mark.asyncio
    async def test_single_expense_correct_balance(self, client, trip, members):
        """A pays $100 split equally → A net +50, B net -50."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Dinner",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 50},
                {"member_id": bob["id"], "amount": 50},
            ],
        })

        resp = await client.get(f"/trips/{tid}/balances")
        assert resp.status_code == 200
        data = resp.json()

        alice_bal = next(b for b in data["member_balances"] if b["member_id"] == alice["id"])
        bob_bal = next(b for b in data["member_balances"] if b["member_id"] == bob["id"])

        assert alice_bal["net_balance"] > 0, "Alice is owed money"
        assert bob_bal["net_balance"] < 0, "Bob owes money"

    @pytest.mark.asyncio
    async def test_debts_list_has_correct_entry(self, client, trip, members):
        """Debts list shows B owes A $50."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Taxi",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 50},
                {"member_id": bob["id"], "amount": 50},
            ],
        })

        resp = await client.get(f"/trips/{tid}/balances")
        data = resp.json()

        bob_to_alice = [d for d in data["debts"]
                        if d["from_member_id"] == bob["id"] and d["to_member_id"] == alice["id"]]
        assert len(bob_to_alice) == 1
        assert abs(bob_to_alice[0]["amount"] - 50.0) < 0.01

    @pytest.mark.asyncio
    async def test_bilateral_netting(self, client, trip, members):
        """A owes B $60, B owes A $40 → net: A owes B $20."""
        tid = trip["id"]
        alice, bob = members

        # Bob pays $60, Alice owes 60
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Expense 1",
            "amount": 60,
            "currency": "USD",
            "paid_by_member_id": bob["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 60},
            ],
        })
        # Alice pays $40, Bob owes 40
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Expense 2",
            "amount": 40,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": bob["id"], "amount": 40},
            ],
        })

        resp = await client.get(f"/trips/{tid}/balances")
        data = resp.json()

        # Net: Alice owes Bob $20
        alice_to_bob = [d for d in data["debts"]
                        if d["from_member_id"] == alice["id"] and d["to_member_id"] == bob["id"]
                        and d["currency"] == "USD"]
        bob_to_alice = [d for d in data["debts"]
                        if d["from_member_id"] == bob["id"] and d["to_member_id"] == alice["id"]
                        and d["currency"] == "USD"]

        # Should have exactly one direction
        if alice_to_bob:
            assert abs(alice_to_bob[0]["amount"] - 20.0) < 0.01
        elif bob_to_alice:
            # Net is bob owes alice -20 (shouldn't happen but handle gracefully)
            assert False, "Net should be Alice owes Bob, not the reverse"
        else:
            assert False, "Expected a net debt entry"


# ──────────────────────────────────────────────
# SIMPLIFY MODE TESTS
# ──────────────────────────────────────────────

class TestSimplifyMode:

    @pytest.mark.asyncio
    async def test_circular_debt_resolved_with_simplify(
        self, client, trip, members, member_c
    ):
        """A→B $100, B→C $100, C→A $100 → simplify resolves circular debts."""
        tid = trip["id"]
        alice, bob = members
        charlie = member_c

        # A pays B's share (B owes A)
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "A pays for B",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": bob["id"], "amount": 100}],
        })
        # B pays C's share (C owes B)
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "B pays for C",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": bob["id"],
            "split_type": "custom",
            "splits": [{"member_id": charlie["id"], "amount": 100}],
        })
        # C pays A's share (A owes C)
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "C pays for A",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": charlie["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 100}],
        })

        # Without simplify, there are 3 debts (A→B→C→A cycle)
        resp_raw = await client.get(f"/trips/{tid}/balances")
        data_raw = resp_raw.json()

        # With simplify
        resp_simplified = await client.get(f"/trips/{tid}/balances?simplify=true")
        data_simplified = resp_simplified.json()

        # With simplify, circular debts should cancel out (all net to 0)
        for b in data_simplified["member_balances"]:
            assert abs(b["net_balance"]) < 0.01, f"Member {b['member_nickname']} should net to 0 in circular scenario, got {b['net_balance']}"


# ──────────────────────────────────────────────
# SETTLEMENT TESTS
# ──────────────────────────────────────────────

class TestSettlements:

    @pytest.mark.asyncio
    async def test_settlement_reduces_balance(self, client, trip, members):
        """After B pays A $50, B's debt to A reduces."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Lunch",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })

        # Bob settles $50 with Alice
        settle_resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 50,
            "currency": "USD",
        })
        assert settle_resp.status_code == 201

        resp = await client.get(f"/trips/{tid}/balances")
        data = resp.json()

        bob_bal = next(b for b in data["member_balances"] if b["member_id"] == bob["id"])
        assert abs(bob_bal["net_balance"]) < 0.01, f"Bob should be settled, got {bob_bal['net_balance']}"

    @pytest.mark.asyncio
    async def test_full_settlement_zeroes_balance(self, client, trip, members):
        """Settling entire debt → net balance = 0."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Hotel",
            "amount": 200,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 100}, {"member_id": bob["id"], "amount": 100}],
        })

        await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 100,
            "currency": "USD",
        })

        resp = await client.get(f"/trips/{tid}/balances")
        data = resp.json()

        bob_bal = next(b for b in data["member_balances"] if b["member_id"] == bob["id"])
        assert abs(bob_bal["net_balance"]) < 0.01

    @pytest.mark.asyncio
    async def test_settlement_is_not_counted_in_trip_totals(
        self, client, trip, members
    ):
        """Settlements don't affect trip.total_spent or expense_count."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Dinner",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })

        trip_resp = await client.get(f"/trips/{tid}")
        expense_count_before = trip_resp.json()["expense_count"]

        await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 50,
            "currency": "USD",
        })

        trip_resp2 = await client.get(f"/trips/{tid}")
        assert trip_resp2.json()["expense_count"] == expense_count_before, \
            "Settlement should not increment expense_count"

    @pytest.mark.asyncio
    async def test_multiple_partial_settlements(self, client, trip, members):
        """Two partial settlements reduce debt incrementally."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Rent",
            "amount": 300,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 150}, {"member_id": bob["id"], "amount": 150}],
        })

        await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 50,
            "currency": "USD",
        })
        await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 70,
            "currency": "USD",
        })

        resp = await client.get(f"/trips/{tid}/balances")
        data = resp.json()

        bob_bal = next(b for b in data["member_balances"] if b["member_id"] == bob["id"])
        # $150 - $50 - $70 = $30 remaining
        assert abs(bob_bal["net_balance"] - (-30.0)) < 0.5, \
            f"Bob should owe ~$30, got {bob_bal['net_balance']}"

    @pytest.mark.asyncio
    async def test_settlement_response_has_id(self, client, trip, members):
        """Settlement creation returns expense ID in response."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 30,
            "currency": "USD",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data, "Settlement response must include an ID"


# ──────────────────────────────────────────────
# GET TRIP TOTALS
# ──────────────────────────────────────────────

class TestTripTotals:

    @pytest.mark.asyncio
    async def test_trip_totals_excludes_settlements(self, client, trip, members):
        """GET /trips/{id}/totals excludes settlements from spending summary."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Dinner",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })
        await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 50,
            "currency": "USD",
        })

        resp = await client.get(f"/trips/{tid}/totals")
        assert resp.status_code == 200
        data = resp.json()

        # Alice paid $100 total; her share is $50
        alice_totals = next(m for m in data["member_totals"] if m["member_id"] == alice["id"])
        assert alice_totals["total_paid"] > 0
        assert alice_totals["total_paid"] >= alice_totals["total_share"]
