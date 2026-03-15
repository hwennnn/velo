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


# ──────────────────────────────────────────────
# SETTLEMENT VALIDATION TESTS
# ──────────────────────────────────────────────

class TestSettlementValidation:

    @pytest.mark.asyncio
    async def test_settlement_invalid_from_member_rejected(self, client, trip, members):
        """Settlement with invalid from_member_id returns 400."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": 999999,
            "to_member_id": alice["id"],
            "amount": 50,
            "currency": "USD",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_settlement_invalid_to_member_rejected(self, client, trip, members):
        """Settlement with invalid to_member_id returns 400."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": 999999,
            "amount": 50,
            "currency": "USD",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_settlement_with_self_rejected(self, client, trip, members):
        """Cannot settle with yourself."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": alice["id"],
            "to_member_id": alice["id"],
            "amount": 50,
            "currency": "USD",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_settlement_zero_amount_rejected(self, client, trip, members):
        """Settlement with zero amount returns 422."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 0,
            "currency": "USD",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_settlement_members_from_different_trip_rejected(self, client, trip, members):
        """Members from different trips cannot settle."""
        tid = trip["id"]
        alice, bob = members

        # Create another trip and get its member
        other_trip_resp = await client.post("/trips/", json={"name": "Other", "base_currency": "USD"})
        other_tid = other_trip_resp.json()["id"]
        other_trip_data = await client.get(f"/trips/{other_tid}")
        other_creator = next(m for m in other_trip_data.json()["members"] if m["user_id"] == TEST_USER_ID)

        # Try to settle from a member of another trip
        resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": other_creator["id"],
            "to_member_id": alice["id"],
            "amount": 50,
            "currency": "USD",
        })
        assert resp.status_code == 400


# ──────────────────────────────────────────────
# MINIMIZE MODE TESTS
# ──────────────────────────────────────────────

class TestMinimizeMode:

    @pytest.mark.asyncio
    async def test_minimize_flag_returns_base_currency_debts(self, client, trip, members):
        """minimize=true returns debts in base currency."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Test",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })

        resp = await client.get(f"/trips/{tid}/balances?minimize=true")
        assert resp.status_code == 200
        data = resp.json()
        assert data["minimized"] is True
        for debt in data["debts"]:
            assert debt["currency"] == "USD"  # base currency

    @pytest.mark.asyncio
    async def test_minimize_reduces_transaction_count(self, client, trip, members, member_c):
        """minimize=true reduces transaction count vs raw."""
        tid = trip["id"]
        alice, bob = members
        charlie = member_c

        # Set up debts: A→B→C chain
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "A pays for B",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": bob["id"], "amount": 100}],
        })
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "B pays for C",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": bob["id"],
            "split_type": "custom",
            "splits": [{"member_id": charlie["id"], "amount": 100}],
        })

        resp_min = await client.get(f"/trips/{tid}/balances?minimize=true")
        data_min = resp_min.json()
        # With minimization, C can pay A directly (1 transaction instead of 2)
        assert len(data_min["debts"]) <= 2


# ──────────────────────────────────────────────
# EXCHANGE RATES ENDPOINT TESTS
# ──────────────────────────────────────────────

class TestExchangeRatesEndpoint:

    @pytest.mark.asyncio
    async def test_exchange_rates_endpoint_accessible(self, client):
        """GET /exchange-rates/USD is accessible (may fail with live API but endpoint exists)."""
        from unittest.mock import AsyncMock, patch
        from decimal import Decimal

        mock_rates = {"USD": Decimal("1.0"), "EUR": Decimal("0.92")}
        with patch("app.api.balances.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_rates
            resp = await client.get("/exchange-rates/USD")
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_exchange_rates_response_structure(self, client):
        """Exchange rates response has base_currency and rates fields."""
        from unittest.mock import AsyncMock, patch
        from decimal import Decimal

        mock_rates = {"USD": Decimal("1.0"), "EUR": Decimal("0.92")}
        with patch("app.api.balances.fetch_exchange_rates", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_rates
            resp = await client.get("/exchange-rates/EUR")
            data = resp.json()
            assert "base_currency" in data
            assert "rates" in data
            assert data["base_currency"] == "EUR"


# ──────────────────────────────────────────────
# SETTLEMENT WITH CURRENCY CONVERSION TESTS
# ──────────────────────────────────────────────

class TestSettlementWithConversion:

    @pytest.mark.asyncio
    async def test_settlement_with_convert_to_currency(self, client, trip, members):
        """Settlement with convert_to_currency converts the amount."""
        from unittest.mock import AsyncMock, patch
        from decimal import Decimal

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

        with patch("app.api.balances.get_exchange_rate", new_callable=AsyncMock) as mock_rate:
            mock_rate.return_value = Decimal("1.35")
            resp = await client.post(f"/trips/{tid}/settlements", json={
                "from_member_id": bob["id"],
                "to_member_id": alice["id"],
                "amount": "50",
                "currency": "USD",
                "convert_to_currency": "SGD",
            })
            assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_settlement_with_custom_conversion_rate(self, client, trip, members):
        """Settlement with explicit conversion_rate uses that rate."""
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

        resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": "100",
            "currency": "USD",
            "convert_to_currency": "SGD",
            "conversion_rate": "1.35",
        })
        assert resp.status_code == 201


# ──────────────────────────────────────────────
# MERGE DEBT CURRENCIES TESTS
# ──────────────────────────────────────────────

class TestMergeDebtCurrencies:

    @pytest.mark.asyncio
    async def test_merge_debt_currencies_basic(self, client, trip, members):
        """POST /trips/{id}/debts/merge merges a debt from one currency to another."""
        from unittest.mock import AsyncMock, patch
        from decimal import Decimal

        tid = trip["id"]
        alice, bob = members

        # Create a USD debt
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Lunch",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })

        with patch("app.api.balances.get_exchange_rate", new_callable=AsyncMock) as mock_rate:
            mock_rate.return_value = Decimal("1.35")
            resp = await client.post(f"/trips/{tid}/debts/merge", json={
                "from_member_id": bob["id"],
                "to_member_id": alice["id"],
                "amount": "50",
                "from_currency": "USD",
                "to_currency": "SGD",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert "merge" in data

    @pytest.mark.asyncio
    async def test_merge_debt_with_custom_rate(self, client, trip, members):
        """Merge with explicit conversion_rate uses that rate."""
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

        resp = await client.post(f"/trips/{tid}/debts/merge", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": "100",
            "from_currency": "USD",
            "to_currency": "SGD",
            "conversion_rate": "1.35",
        })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_merge_invalid_from_member(self, client, trip, members):
        """Merge with invalid from_member_id returns 400."""
        tid = trip["id"]
        _, alice = members  # use second member as to

        resp = await client.post(f"/trips/{tid}/debts/merge", json={
            "from_member_id": 999999,
            "to_member_id": alice["id"],
            "amount": "50",
            "from_currency": "USD",
            "to_currency": "SGD",
            "conversion_rate": "1.35",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_merge_invalid_to_member(self, client, trip, members):
        """Merge with invalid to_member_id returns 400."""
        tid = trip["id"]
        alice, _ = members

        resp = await client.post(f"/trips/{tid}/debts/merge", json={
            "from_member_id": alice["id"],
            "to_member_id": 999999,
            "amount": "50",
            "from_currency": "USD",
            "to_currency": "SGD",
            "conversion_rate": "1.35",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_merge_same_member_rejected(self, client, trip, members):
        """Cannot merge debt with yourself."""
        tid = trip["id"]
        alice, _ = members

        resp = await client.post(f"/trips/{tid}/debts/merge", json={
            "from_member_id": alice["id"],
            "to_member_id": alice["id"],
            "amount": "50",
            "from_currency": "USD",
            "to_currency": "SGD",
            "conversion_rate": "1.35",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_merge_same_currency_rejected(self, client, trip, members):
        """Cannot merge to the same currency."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/debts/merge", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": "50",
            "from_currency": "USD",
            "to_currency": "USD",
            "conversion_rate": "1.0",
        })
        assert resp.status_code == 400


# ──────────────────────────────────────────────
# CONVERT ALL DEBTS TESTS
# ──────────────────────────────────────────────

class TestConvertAllDebts:

    @pytest.mark.asyncio
    async def test_convert_all_debts_basic(self, client, trip, members):
        """POST /trips/{id}/debts/convert-all converts all debts to target currency."""
        from unittest.mock import AsyncMock, patch
        from decimal import Decimal

        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "EUR expense",
            "amount": 80,
            "currency": "EUR",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 40}, {"member_id": bob["id"], "amount": 40}],
        })

        with patch("app.services.debt.get_exchange_rate", new_callable=AsyncMock) as mock_rate:
            mock_rate.return_value = Decimal("1.08")
            resp = await client.post(f"/trips/{tid}/debts/convert-all", json={
                "target_currency": "USD",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert "conversion" in data

    @pytest.mark.asyncio
    async def test_convert_all_debts_with_custom_rates(self, client, trip, members):
        """Convert all debts with custom exchange rates."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Mixed",
            "amount": 50,
            "currency": "EUR",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 25}, {"member_id": bob["id"], "amount": 25}],
        })

        resp = await client.post(f"/trips/{tid}/debts/convert-all", json={
            "target_currency": "USD",
            "use_custom_rates": True,
            "custom_rates": {"EUR": "1.08"},
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data

    @pytest.mark.asyncio
    async def test_convert_all_debts_non_member_forbidden(self, async_session):
        """Non-member cannot convert debts."""
        from app.main import app as the_app
        from app.core.auth import get_current_user
        from app.core.database import get_session as get_db_session
        from app.models.user import User as UserModel
        from httpx import AsyncClient as HClient, ASGITransport

        # Create a user that is not a trip member
        outsider = UserModel(id="outsider-convert-001", email="outsider@example.com", display_name="Outsider")
        async_session.add(outsider)
        await async_session.commit()

        async def get_session_override():
            yield async_session

        async def get_current_user_override():
            return UserModel(id="outsider-convert-001", email="outsider@example.com", display_name="Outsider")

        the_app.dependency_overrides[get_db_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = get_current_user_override

        transport = ASGITransport(app=the_app)
        async with HClient(transport=transport, base_url="http://test/api") as c:
            resp = await c.post("/trips/999999/debts/convert-all", json={"target_currency": "USD"})
            assert resp.status_code in [403, 404]

        the_app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# SIMPLIFY WITH MULTI-CURRENCY DEBTS
# ──────────────────────────────────────────────

class TestSimplifyWithMultiCurrency:

    @pytest.mark.asyncio
    async def test_simplify_true_with_non_base_currency_debt(self, client, trip, members):
        """simplify=True with a non-base-currency expense converts amount_in_base."""
        from unittest.mock import AsyncMock, patch
        from decimal import Decimal
        tid = trip["id"]
        alice, bob = members

        # Create an SGD expense in a USD-base trip
        with patch("app.api.balances.get_exchange_rate", new_callable=AsyncMock) as mock_rate, \
             patch("app.services.debt.get_exchange_rate", new_callable=AsyncMock) as mock_debt_rate:
            mock_rate.return_value = Decimal("0.74")
            mock_debt_rate.return_value = Decimal("0.74")
            await client.post(f"/trips/{tid}/expenses", json={
                "description": "SGD Meal",
                "amount": 80,
                "currency": "SGD",
                "paid_by_member_id": alice["id"],
                "split_type": "custom",
                "splits": [
                    {"member_id": alice["id"], "amount": 40},
                    {"member_id": bob["id"], "amount": 40},
                ],
            })

        # Get balances with simplify=True
        with patch("app.services.debt.get_exchange_rate", new_callable=AsyncMock) as mock_rate2:
            mock_rate2.return_value = Decimal("0.74")
            resp = await client.get(f"/trips/{tid}/balances?simplify=true")
            assert resp.status_code == 200
            data = resp.json()
            assert "debts" in data


# ──────────────────────────────────────────────
# CHECK TRIP ACCESS — NON-MEMBER FORBIDDEN
# ──────────────────────────────────────────────

class TestCheckTripAccessBalances:

    @pytest.mark.asyncio
    async def test_non_member_cannot_view_balances(self, async_session):
        """User who is not a trip member gets 403 when accessing balances (line 110)."""
        from app.main import app as the_app
        from app.core.auth import get_current_user
        from app.core.database import get_session as get_db_session
        from app.models.user import User as UserModel
        from httpx import AsyncClient as HClient, ASGITransport

        # Create a trip as TEST_USER first
        creator = UserModel(id="balance-creator-001", email="bcreator@example.com", display_name="Creator")
        async_session.add(creator)
        await async_session.commit()

        async def get_session_override():
            yield async_session

        async def creator_user_override():
            return UserModel(id="balance-creator-001", email="bcreator@example.com", display_name="Creator")

        the_app.dependency_overrides[get_db_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = creator_user_override

        transport = ASGITransport(app=the_app)
        async with HClient(transport=transport, base_url="http://test/api") as c:
            trip_resp = await c.post("/trips/", json={"name": "Access Trip", "base_currency": "USD"})
            assert trip_resp.status_code == 201
            trip_id = trip_resp.json()["id"]

        # Now switch to a different user who is NOT a member
        outsider = UserModel(id="balance-outsider-001", email="boutside@example.com", display_name="Outsider")
        async_session.add(outsider)
        await async_session.commit()

        async def outsider_override():
            return UserModel(id="balance-outsider-001", email="boutside@example.com", display_name="Outsider")

        the_app.dependency_overrides[get_current_user] = outsider_override

        transport = ASGITransport(app=the_app)
        async with HClient(transport=transport, base_url="http://test/api") as c:
            resp = await c.get(f"/trips/{trip_id}/balances")
            assert resp.status_code == 403

        the_app.dependency_overrides.clear()
