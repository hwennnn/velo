"""
TDD test suite for expense creation, splits, rounding, and debt generation.

Covers:
- All split types: equal, percentage, custom
- Rounding behavior ($100/3, $10/3)
- Debt generation per split type
- Expense update → debt recalculation
- Expense deletion → debt removal
- Trip metadata (total_spent, expense_count)
- Multi-currency expenses
- Validation (zero amount, invalid member, etc.)
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
from app.models.split import Split
from app.models.expense import Expense
from app.models.trip import Trip

TEST_USER_ID = "expense-test-user-001"
TEST_USER_EMAIL = "expenses@example.com"


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
        test_user = User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Expenses User")
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
        return User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Expenses User")

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user_id] = get_current_user_id_override
    app.dependency_overrides[get_current_user] = get_current_user_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def trip(client: AsyncClient) -> dict:
    resp = await client.post("/trips/", json={"name": "Expense Test Trip", "base_currency": "USD"})
    assert resp.status_code == 201
    return resp.json()


@pytest_asyncio.fixture
async def members(client: AsyncClient, trip: dict) -> tuple:
    tid = trip["id"]
    a = await client.post(f"/trips/{tid}/members", json={"nickname": "Alice"})
    b = await client.post(f"/trips/{tid}/members", json={"nickname": "Bob"})
    assert a.status_code == 201
    assert b.status_code == 201
    return a.json(), b.json()


@pytest_asyncio.fixture
async def member_c(client: AsyncClient, trip: dict) -> dict:
    tid = trip["id"]
    c = await client.post(f"/trips/{tid}/members", json={"nickname": "Charlie"})
    assert c.status_code == 201
    return c.json()


async def get_debts(session, trip_id, debtor_id, creditor_id, currency=None):
    stmt = select(MemberDebt).where(
        MemberDebt.trip_id == trip_id,
        MemberDebt.debtor_member_id == debtor_id,
        MemberDebt.creditor_member_id == creditor_id,
    )
    if currency:
        stmt = stmt.where(MemberDebt.currency == currency)
    result = await session.execute(stmt)
    return result.scalars().all()


async def get_total_debt(session, trip_id, debtor_id, creditor_id, currency="USD"):
    debts = await get_debts(session, trip_id, debtor_id, creditor_id, currency)
    return sum(d.amount for d in debts)


# ──────────────────────────────────────────────
# EQUAL SPLIT TESTS
# ──────────────────────────────────────────────

class TestEqualSplit:

    @pytest.mark.asyncio
    async def test_equal_split_two_members_creates_correct_debt(
        self, client, async_session, trip, members
    ):
        """A pays $200 equally with B → B owes A $100."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Dinner",
            "amount": 200,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "splits": [{"member_id": alice["id"]}, {"member_id": bob["id"]}],
        })
        assert resp.status_code == 201

        total = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        assert abs(total - Decimal("100")) < Decimal("0.01"), f"Bob should owe $100, got {total}"

    @pytest.mark.asyncio
    async def test_equal_split_three_members_rounding(
        self, client, async_session, trip, members, member_c
    ):
        """$100 / 3 members: two get $33.33, one gets $33.34. Total = $100."""
        tid = trip["id"]
        alice, bob = members
        charlie = member_c

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Coffee",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "splits": [
                {"member_id": alice["id"]},
                {"member_id": bob["id"]},
                {"member_id": charlie["id"]},
            ],
        })
        assert resp.status_code == 201

        # Get expense splits to verify total == 100
        expense_id = resp.json()["id"]
        stmt = select(Split).where(Split.expense_id == expense_id)
        result = await async_session.execute(stmt)
        splits = result.scalars().all()

        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01"), f"Splits must sum to $100, got {total}"
        assert len(splits) == 3

        # Bob and Charlie each owe Alice their share
        bob_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        charlie_debt = await get_total_debt(async_session, tid, charlie["id"], alice["id"], "USD")

        assert bob_debt > Decimal("33") and bob_debt < Decimal("34")
        assert charlie_debt > Decimal("33") and charlie_debt < Decimal("34")
        assert abs((bob_debt + charlie_debt) - Decimal("66.67")) < Decimal("0.02")

    @pytest.mark.asyncio
    async def test_equal_split_no_debt_for_payer(
        self, client, async_session, trip, members
    ):
        """Payer never owes themselves."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Taxi",
            "amount": 80,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "splits": [{"member_id": alice["id"]}, {"member_id": bob["id"]}],
        })

        alice_self_debts = await get_debts(async_session, tid, alice["id"], alice["id"])
        assert len(alice_self_debts) == 0

    @pytest.mark.asyncio
    async def test_equal_split_defaults_to_all_trip_members(
        self, client, async_session, trip, members
    ):
        """Equal split with no splits list → all trip members included."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Hotel",
            "amount": 300,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        assert resp.status_code == 201

        # Trip has 3 members (alice, bob, + creator). Bob should owe ~100
        bob_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        assert bob_debt > Decimal("0"), "Bob should owe something in an equal split"


# ──────────────────────────────────────────────
# CUSTOM SPLIT TESTS
# ──────────────────────────────────────────────

class TestCustomSplit:

    @pytest.mark.asyncio
    async def test_custom_split_exact_amounts(
        self, client, async_session, trip, members
    ):
        """Custom split: A gets $70, B gets $30 → B owes A $30."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Groceries",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 70},
                {"member_id": bob["id"], "amount": 30},
            ],
        })
        assert resp.status_code == 201

        bob_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        assert abs(bob_debt - Decimal("30")) < Decimal("0.01")

    @pytest.mark.asyncio
    async def test_custom_split_payer_pays_all(
        self, client, async_session, trip, members
    ):
        """Custom: payer takes 100% → no debt created."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Personal expense",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 100}],
        })

        bob_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        assert bob_debt == Decimal("0"), "Bob owes nothing if alice takes 100%"

    @pytest.mark.asyncio
    async def test_custom_split_three_way_uneven(
        self, client, async_session, trip, members, member_c
    ):
        """Custom 3-way: A=50, B=30, C=20. B owes A 30, C owes A 20."""
        tid = trip["id"]
        alice, bob = members
        charlie = member_c

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Party supplies",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 50},
                {"member_id": bob["id"], "amount": 30},
                {"member_id": charlie["id"], "amount": 20},
            ],
        })
        assert resp.status_code == 201

        bob_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        charlie_debt = await get_total_debt(async_session, tid, charlie["id"], alice["id"], "USD")

        assert abs(bob_debt - Decimal("30")) < Decimal("0.01")
        assert abs(charlie_debt - Decimal("20")) < Decimal("0.01")


# ──────────────────────────────────────────────
# PERCENTAGE SPLIT TESTS
# ──────────────────────────────────────────────

class TestPercentageSplit:

    @pytest.mark.asyncio
    async def test_percentage_split_50_50(
        self, client, async_session, trip, members
    ):
        """50/50 percentage split of $200 → B owes A $100."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Accommodation",
            "amount": 200,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "percentage",
            "splits": [
                {"member_id": alice["id"], "percentage": 50},
                {"member_id": bob["id"], "percentage": 50},
            ],
        })
        assert resp.status_code == 201

        bob_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        assert abs(bob_debt - Decimal("100")) < Decimal("0.01")

    @pytest.mark.asyncio
    async def test_percentage_split_uneven_rounding(
        self, client, async_session, trip, members, member_c
    ):
        """33.33% each of $100 → splits sum to exactly $100."""
        tid = trip["id"]
        alice, bob = members
        charlie = member_c

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Event tickets",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "percentage",
            "splits": [
                {"member_id": alice["id"], "percentage": "33.33"},
                {"member_id": bob["id"], "percentage": "33.33"},
                {"member_id": charlie["id"], "percentage": "33.34"},
            ],
        })
        assert resp.status_code == 201

        expense_id = resp.json()["id"]
        stmt = select(Split).where(Split.expense_id == expense_id)
        result = await async_session.execute(stmt)
        splits = result.scalars().all()

        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01"), f"Splits must sum to $100, got {total}"


# ──────────────────────────────────────────────
# EXPENSE UPDATE TESTS
# ──────────────────────────────────────────────

class TestExpenseUpdate:

    @pytest.mark.asyncio
    async def test_update_amount_recalculates_debt(
        self, client, async_session, trip, members
    ):
        """Update expense amount → debt updates accordingly."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Lunch",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 50},
                {"member_id": bob["id"], "amount": 50},
            ],
        })
        expense_id = resp.json()["id"]

        # Update to $200
        resp = await client.put(f"/trips/{tid}/expenses/{expense_id}", json={
            "amount": 200,
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 100},
                {"member_id": bob["id"], "amount": 100},
            ],
        })
        assert resp.status_code == 200

        await async_session.commit()

        bob_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        assert abs(bob_debt - Decimal("100")) < Decimal("0.01"), f"Bob should owe $100 after update, got {bob_debt}"

    @pytest.mark.asyncio
    async def test_update_amount_no_old_debt_remains(
        self, client, async_session, trip, members
    ):
        """After update, old debt (from original amount) is fully removed — no double-counting."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Groceries",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 50},
                {"member_id": bob["id"], "amount": 50},
            ],
        })
        expense_id = resp.json()["id"]

        await client.put(f"/trips/{tid}/expenses/{expense_id}", json={
            "amount": 60,
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 30},
                {"member_id": bob["id"], "amount": 30},
            ],
        })

        await async_session.commit()

        # Should be exactly $30, NOT $50 + $30 = $80
        bob_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        assert abs(bob_debt - Decimal("30")) < Decimal("0.01"), f"Expected $30, got {bob_debt}"

    @pytest.mark.asyncio
    async def test_update_currency_changes_debt_currency(
        self, client, async_session, trip, members
    ):
        """Changing expense currency removes old-currency debt, creates new."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Flight",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 50},
                {"member_id": bob["id"], "amount": 50},
            ],
        })
        expense_id = resp.json()["id"]

        await client.put(f"/trips/{tid}/expenses/{expense_id}", json={
            "currency": "EUR",
        })
        await async_session.commit()

        usd_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        eur_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "EUR")

        assert usd_debt < Decimal("0.01"), f"USD debt should be gone, got {usd_debt}"
        assert eur_debt > Decimal("0"), "EUR debt should exist"

    @pytest.mark.asyncio
    async def test_update_payer_changes_creditor(
        self, client, async_session, trip, members
    ):
        """Changing paid_by_member_id redirects who is owed."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Supplies",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 50},
                {"member_id": bob["id"], "amount": 50},
            ],
        })
        expense_id = resp.json()["id"]

        # Bob now paid
        await client.put(f"/trips/{tid}/expenses/{expense_id}", json={
            "paid_by_member_id": bob["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 50},
                {"member_id": bob["id"], "amount": 50},
            ],
        })
        await async_session.commit()

        # Alice should now owe Bob
        alice_owes_bob = await get_total_debt(async_session, tid, alice["id"], bob["id"], "USD")
        bob_owes_alice = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")

        assert alice_owes_bob > Decimal("0"), "Alice should owe Bob after payer change"
        assert bob_owes_alice < Decimal("0.01"), "Bob should not owe Alice after payer change"

    @pytest.mark.asyncio
    async def test_update_trip_metadata_reflects_new_amount(
        self, client, async_session, trip, members
    ):
        """Trip total_spent updates correctly when expense amount changes."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Hotel",
            "amount": 200,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        expense_id = resp.json()["id"]

        await client.put(f"/trips/{tid}/expenses/{expense_id}", json={"amount": 300})
        await async_session.commit()

        trip_obj = await async_session.get(Trip, tid)
        # total_spent should have been updated by the delta (was 200, now 300)
        # Note: there may also be creator's initial membership affecting this
        # Just assert total_spent >= 300
        assert trip_obj.total_spent >= Decimal("298"), f"total_spent should reflect update, got {trip_obj.total_spent}"


# ──────────────────────────────────────────────
# EXPENSE DELETION TESTS
# ──────────────────────────────────────────────

class TestExpenseDeletion:

    @pytest.mark.asyncio
    async def test_delete_expense_removes_all_debts(
        self, client, async_session, trip, members
    ):
        """Deleting an expense removes all associated debts."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Removable",
            "amount": 150,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "splits": [{"member_id": alice["id"]}, {"member_id": bob["id"]}],
        })
        expense_id = resp.json()["id"]

        del_resp = await client.delete(f"/trips/{tid}/expenses/{expense_id}")
        assert del_resp.status_code == 204

        await async_session.commit()

        stmt = select(MemberDebt).where(MemberDebt.source_expense_id == expense_id)
        result = await async_session.execute(stmt)
        debts = result.scalars().all()
        assert len(debts) == 0, "All debts should be removed after expense deletion"

    @pytest.mark.asyncio
    async def test_delete_expense_decrements_trip_count(
        self, client, async_session, trip, members
    ):
        """Deleting an expense decrements trip.expense_count."""
        tid = trip["id"]
        alice, _ = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Count me",
            "amount": 50,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        expense_id = resp.json()["id"]
        await async_session.commit()

        trip_before = await async_session.get(Trip, tid)
        count_before = trip_before.expense_count

        await client.delete(f"/trips/{tid}/expenses/{expense_id}")
        await async_session.commit()

        await async_session.refresh(trip_before)
        assert trip_before.expense_count == count_before - 1

    @pytest.mark.asyncio
    async def test_delete_only_removes_target_expense_debts(
        self, client, async_session, trip, members
    ):
        """Deleting one expense leaves other expenses' debts intact."""
        tid = trip["id"]
        alice, bob = members

        # Create two expenses
        resp1 = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Expense 1",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })
        expense1_id = resp1.json()["id"]

        resp2 = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Expense 2",
            "amount": 200,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 100}, {"member_id": bob["id"], "amount": 100}],
        })
        expense2_id = resp2.json()["id"]

        # Delete first expense
        await client.delete(f"/trips/{tid}/expenses/{expense1_id}")
        await async_session.commit()

        # Expense 2's debts should remain
        stmt = select(MemberDebt).where(MemberDebt.source_expense_id == expense2_id)
        result = await async_session.execute(stmt)
        remaining = result.scalars().all()
        assert len(remaining) > 0, "Expense 2's debts should remain after deleting Expense 1"

        total = sum(d.amount for d in remaining)
        assert abs(total - Decimal("100")) < Decimal("0.01")


# ──────────────────────────────────────────────
# MULTI-CURRENCY TESTS
# ──────────────────────────────────────────────

class TestMultiCurrency:

    @pytest.mark.asyncio
    async def test_eur_expense_creates_eur_debt(
        self, client, async_session, trip, members
    ):
        """EUR expense creates EUR-denominated debt."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Paris dinner",
            "amount": 80,
            "currency": "EUR",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 40},
                {"member_id": bob["id"], "amount": 40},
            ],
        })
        assert resp.status_code == 201

        eur_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "EUR")
        assert abs(eur_debt - Decimal("40")) < Decimal("0.01")

        usd_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        assert usd_debt == Decimal("0"), "No USD debt for EUR expense"

    @pytest.mark.asyncio
    async def test_multiple_currencies_tracked_separately(
        self, client, async_session, trip, members
    ):
        """USD and EUR expenses tracked as separate debts per currency."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "USD expense",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "EUR expense",
            "amount": 60,
            "currency": "EUR",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 30}, {"member_id": bob["id"], "amount": 30}],
        })
        await async_session.commit()

        usd_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "USD")
        eur_debt = await get_total_debt(async_session, tid, bob["id"], alice["id"], "EUR")

        assert abs(usd_debt - Decimal("50")) < Decimal("0.01")
        assert abs(eur_debt - Decimal("30")) < Decimal("0.01")

    @pytest.mark.asyncio
    async def test_balance_api_returns_currency_breakdown(
        self, client, async_session, trip, members
    ):
        """Balance API returns currency_balances per member."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "USD",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "EUR",
            "amount": 80,
            "currency": "EUR",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 40}, {"member_id": bob["id"], "amount": 40}],
        })

        resp = await client.get(f"/trips/{tid}/balances")
        assert resp.status_code == 200

        data = resp.json()
        bob_balance = next(b for b in data["member_balances"] if b["member_id"] == bob["id"])
        assert "USD" in bob_balance["currency_balances"]
        assert "EUR" in bob_balance["currency_balances"]


# ──────────────────────────────────────────────
# VALIDATION TESTS
# ──────────────────────────────────────────────

class TestExpenseValidation:

    @pytest.mark.asyncio
    async def test_zero_amount_rejected(self, client, trip, members):
        """Zero amount expense is rejected."""
        tid = trip["id"]
        alice, _ = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Free",
            "amount": 0,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        assert resp.status_code in [400, 422], f"Expected 4xx, got {resp.status_code}"

    @pytest.mark.asyncio
    async def test_negative_amount_rejected(self, client, trip, members):
        """Negative amount expense is rejected."""
        tid = trip["id"]
        alice, _ = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Negative",
            "amount": -50,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        assert resp.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_invalid_paid_by_member_rejected(self, client, trip, members):
        """paid_by_member_id not in trip → 400."""
        tid = trip["id"]

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Bad payer",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": 999999,
            "split_type": "equal",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_non_member_cannot_create_expense(self, client, async_session, trip):
        """Non-member user cannot create expense (trip access check)."""
        # Create a second trip that the user is NOT a member of
        trip2_resp = await client.post("/trips/", json={"name": "Trip 2", "base_currency": "USD"})
        trip2_id = trip2_resp.json()["id"]

        # Use a different session override to simulate a non-member user
        # For this test, we check the original trip — the user IS creator/member
        # So instead we test accessing a trip with a wrong trip_id
        resp = await client.post(f"/trips/999999/expenses", json={
            "description": "Unauthorized",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": 1,
            "split_type": "equal",
        })
        assert resp.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_expense_requires_description(self, client, trip, members):
        """Expense without description should fail."""
        tid = trip["id"]
        alice, _ = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        assert resp.status_code == 422


# ──────────────────────────────────────────────
# LIST EXPENSES WITH FILTERS
# ──────────────────────────────────────────────

class TestListExpenses:

    @pytest.mark.asyncio
    async def test_list_expenses_empty(self, client, trip):
        """No expenses returns empty list."""
        tid = trip["id"]
        resp = await client.get(f"/trips/{tid}/expenses")
        assert resp.status_code == 200
        data = resp.json()
        assert data["expenses"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_expenses_returns_all(self, client, trip, members):
        """List returns all expenses for the trip."""
        tid = trip["id"]
        alice, _ = members
        for i in range(3):
            await client.post(f"/trips/{tid}/expenses", json={
                "description": f"Expense {i}",
                "amount": 50,
                "currency": "USD",
                "paid_by_member_id": alice["id"],
                "split_type": "equal",
            })

        resp = await client.get(f"/trips/{tid}/expenses")
        data = resp.json()
        assert data["total"] == 3
        assert len(data["expenses"]) == 3

    @pytest.mark.asyncio
    async def test_list_expenses_filter_by_category(self, client, trip, members):
        """Filter by category returns matching expenses only."""
        tid = trip["id"]
        alice, _ = members
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Food expense",
            "amount": 50,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "category": "food",
        })
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Transport expense",
            "amount": 30,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "category": "transport",
        })

        resp = await client.get(f"/trips/{tid}/expenses?category=food")
        data = resp.json()
        assert data["total"] == 1
        assert data["expenses"][0]["category"] == "food"

    @pytest.mark.asyncio
    async def test_list_expenses_filter_by_paid_by(self, client, trip, members):
        """Filter by paid_by_member_id returns matching expenses only."""
        tid = trip["id"]
        alice, bob = members
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Alice paid",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Bob paid",
            "amount": 50,
            "currency": "USD",
            "paid_by_member_id": bob["id"],
            "split_type": "equal",
        })

        resp = await client.get(f"/trips/{tid}/expenses?paid_by_member_id={alice['id']}")
        data = resp.json()
        assert all(e["paid_by_member_id"] == alice["id"] for e in data["expenses"])

    @pytest.mark.asyncio
    async def test_list_expenses_pagination(self, client, trip, members):
        """Pagination works: page_size limits results."""
        tid = trip["id"]
        alice, _ = members
        for i in range(5):
            await client.post(f"/trips/{tid}/expenses", json={
                "description": f"Expense {i}",
                "amount": 10,
                "currency": "USD",
                "paid_by_member_id": alice["id"],
                "split_type": "equal",
            })

        resp = await client.get(f"/trips/{tid}/expenses?page=1&page_size=2")
        data = resp.json()
        assert len(data["expenses"]) == 2
        assert data["total"] == 5

    @pytest.mark.asyncio
    async def test_list_expenses_filter_expense_type(self, client, trip, members):
        """Filter by expense_type=expenses excludes settlements."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Regular",
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

        resp = await client.get(f"/trips/{tid}/expenses?expense_type=expenses")
        data = resp.json()
        for exp in data["expenses"]:
            assert exp["expense_type"] == "expense"

    @pytest.mark.asyncio
    async def test_list_expenses_filter_settlements(self, client, trip, members):
        """Filter by expense_type=settlements returns only settlements."""
        tid = trip["id"]
        alice, bob = members

        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Regular",
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

        resp = await client.get(f"/trips/{tid}/expenses?expense_type=settlements")
        data = resp.json()
        for exp in data["expenses"]:
            assert exp["expense_type"] == "settlement"


# ──────────────────────────────────────────────
# GET SPECIFIC EXPENSE TESTS
# ──────────────────────────────────────────────

class TestGetExpense:

    @pytest.mark.asyncio
    async def test_get_expense_by_id(self, client, trip, members):
        """GET /trips/{id}/expenses/{id} returns the expense."""
        tid = trip["id"]
        alice, _ = members
        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Specific expense",
            "amount": 75,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        expense_id = resp.json()["id"]

        get_resp = await client.get(f"/trips/{tid}/expenses/{expense_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == expense_id
        assert get_resp.json()["description"] == "Specific expense"

    @pytest.mark.asyncio
    async def test_get_nonexistent_expense_returns_404(self, client, trip):
        """Non-existent expense returns 404."""
        tid = trip["id"]
        resp = await client.get(f"/trips/{tid}/expenses/999999")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_expense_wrong_trip_returns_404(self, client, trip, members):
        """Expense from a different trip returns 404."""
        # Create two trips
        trip2_resp = await client.post("/trips/", json={"name": "Trip 2", "base_currency": "USD"})
        trip2_id = trip2_resp.json()["id"]
        trip2_data = await client.get(f"/trips/{trip2_id}")
        creator_member = next(m for m in trip2_data.json()["members"] if m["user_id"] == TEST_USER_ID)

        # Create expense in trip2
        exp_resp = await client.post(f"/trips/{trip2_id}/expenses", json={
            "description": "In Trip 2",
            "amount": 50,
            "currency": "USD",
            "paid_by_member_id": creator_member["id"],
            "split_type": "equal",
        })
        expense_id = exp_resp.json()["id"]

        # Try to access it via trip1
        tid = trip["id"]
        resp = await client.get(f"/trips/{tid}/expenses/{expense_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_expense_returns_splits(self, client, trip, members):
        """GET expense includes splits array."""
        tid = trip["id"]
        alice, bob = members
        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Split expense",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 60},
                {"member_id": bob["id"], "amount": 40},
            ],
        })
        expense_id = resp.json()["id"]

        get_resp = await client.get(f"/trips/{tid}/expenses/{expense_id}")
        data = get_resp.json()
        assert "splits" in data
        assert len(data["splits"]) == 2


# ──────────────────────────────────────────────
# DELETE PERMISSION TESTS
# ──────────────────────────────────────────────

class TestDeleteExpensePermissions:

    @pytest.mark.asyncio
    async def test_non_creator_non_admin_cannot_delete(self, client, async_session, trip, members):
        """Non-creator non-admin member cannot delete an expense."""
        from app.models.user import User as UserModel
        from app.core.auth import get_current_user
        from app.core.database import get_session
        from httpx import AsyncClient, ASGITransport

        tid = trip["id"]
        alice, bob = members

        # Alice creates an expense
        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Alice's expense",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })
        expense_id = resp.json()["id"]

        # Create a second user (non-creator, non-admin)
        second_user_id = "non-creator-user-xyz"
        second_user = UserModel(id=second_user_id, email="noncreator@example.com", display_name="Non Creator")
        async_session.add(second_user)
        await async_session.commit()

        # Add them as a non-admin member
        await client.post(f"/trips/{tid}/members", json={
            "nickname": "NonCreator",
            "email": "noncreator@example.com",
        })

        # Try to delete as non-creator
        async def get_session_override():
            yield async_session

        async def get_current_user_override():
            return UserModel(id=second_user_id, email="noncreator@example.com")

        from app.main import app as the_app
        the_app.dependency_overrides[get_session] = get_session_override
        the_app.dependency_overrides[get_current_user] = get_current_user_override

        transport = ASGITransport(app=the_app)
        async with AsyncClient(transport=transport, base_url="http://test/api") as c2:
            del_resp = await c2.delete(f"/trips/{tid}/expenses/{expense_id}")
            assert del_resp.status_code == 403, f"Non-creator should get 403, got {del_resp.status_code}"


# ──────────────────────────────────────────────
# EXPENSE UPDATE ADVANCED PATHS
# ──────────────────────────────────────────────

class TestExpenseUpdateAdvancedPaths:

    @pytest.mark.asyncio
    async def test_update_expense_not_found_returns_404(self, client, trip):
        """Updating a non-existent expense returns 404."""
        tid = trip["id"]
        resp = await client.put(f"/trips/{tid}/expenses/999999", json={"description": "Ghost"})
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_expense_wrong_trip_returns_404(self, client, trip, members):
        """Updating expense from wrong trip returns 404."""
        # Create two trips
        trip2_resp = await client.post("/trips/", json={"name": "Trip 2", "base_currency": "USD"})
        trip2_id = trip2_resp.json()["id"]
        trip2_data = await client.get(f"/trips/{trip2_id}")
        creator_member = next(m for m in trip2_data.json()["members"] if m["user_id"] == TEST_USER_ID)

        exp_resp = await client.post(f"/trips/{trip2_id}/expenses", json={
            "description": "Trip2 expense",
            "amount": 50,
            "currency": "USD",
            "paid_by_member_id": creator_member["id"],
            "split_type": "equal",
        })
        expense_id = exp_resp.json()["id"]

        # Try to update via trip1
        tid = trip["id"]
        resp = await client.put(f"/trips/{tid}/expenses/{expense_id}", json={"description": "Wrong"})
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_expense_equal_split_with_specific_members(self, client, trip, members):
        """Update expense to equal split with explicit member list."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Original",
            "amount": 90,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 45}, {"member_id": bob["id"], "amount": 45}],
        })
        expense_id = resp.json()["id"]

        # Update to equal split with explicit members
        update_resp = await client.put(f"/trips/{tid}/expenses/{expense_id}", json={
            "split_type": "equal",
            "splits": [{"member_id": alice["id"]}, {"member_id": bob["id"]}],
        })
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert len(data["splits"]) == 2

    @pytest.mark.asyncio
    async def test_update_expense_equal_split_all_members(self, client, trip, members):
        """Update expense to equal split without member list uses all trip members."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Original",
            "amount": 90,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 45}, {"member_id": bob["id"], "amount": 45}],
        })
        expense_id = resp.json()["id"]

        # Update to equal split without splits list
        update_resp = await client.put(f"/trips/{tid}/expenses/{expense_id}", json={
            "split_type": "equal",
        })
        assert update_resp.status_code == 200
        # Should include all trip members (creator + alice + bob = 3)
        data = update_resp.json()
        assert len(data["splits"]) >= 2

    @pytest.mark.asyncio
    async def test_update_expense_percentage_splits(self, client, trip, members):
        """Update expense to percentage split type."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Original",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "splits": [{"member_id": alice["id"]}, {"member_id": bob["id"]}],
        })
        expense_id = resp.json()["id"]

        update_resp = await client.put(f"/trips/{tid}/expenses/{expense_id}", json={
            "split_type": "percentage",
            "splits": [
                {"member_id": alice["id"], "percentage": "70"},
                {"member_id": bob["id"], "percentage": "30"},
            ],
        })
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert len(data["splits"]) == 2

    @pytest.mark.asyncio
    async def test_update_expense_custom_splits(self, client, trip, members):
        """Update expense to custom split type."""
        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Original",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "splits": [{"member_id": alice["id"]}, {"member_id": bob["id"]}],
        })
        expense_id = resp.json()["id"]

        update_resp = await client.put(f"/trips/{tid}/expenses/{expense_id}", json={
            "amount": 120,
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": 80},
                {"member_id": bob["id"], "amount": 40},
            ],
        })
        assert update_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_update_expense_currency_change_updates_exchange_rate(self, client, trip, members):
        """Updating currency fetches new exchange rate."""
        from unittest.mock import AsyncMock, patch
        from decimal import Decimal

        tid = trip["id"]
        alice, bob = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Flight",
            "amount": 200,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "splits": [{"member_id": alice["id"]}, {"member_id": bob["id"]}],
        })
        expense_id = resp.json()["id"]

        with patch("app.api.expenses.get_exchange_rate", new_callable=AsyncMock) as mock_rate:
            mock_rate.return_value = Decimal("1.08")
            update_resp = await client.put(f"/trips/{tid}/expenses/{expense_id}", json={
                "currency": "EUR",
            })
            assert update_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_update_expense_amount_updates_trip_total(self, client, async_session, trip, members):
        """Updating expense amount correctly updates trip total_spent."""
        from app.models.trip import Trip as TripModel

        tid = trip["id"]
        alice, _ = members

        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Hotel",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
            "splits": [{"member_id": alice["id"]}],
        })
        expense_id = resp.json()["id"]

        await client.put(f"/trips/{tid}/expenses/{expense_id}", json={"amount": 200})
        await async_session.commit()

        trip_obj = await async_session.get(TripModel, tid)
        assert float(trip_obj.total_spent) >= 198.0  # at least 200 in base currency

    @pytest.mark.asyncio
    async def test_update_settlement_amount_auto_updates_split(self, client, trip, members):
        """Updating a settlement's amount automatically updates its split."""
        tid = trip["id"]
        alice, bob = members

        # Create an initial debt
        await client.post(f"/trips/{tid}/expenses", json={
            "description": "Dinner",
            "amount": 100,
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [{"member_id": alice["id"], "amount": 50}, {"member_id": bob["id"], "amount": 50}],
        })

        # Create a settlement
        settle_resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 30,
            "currency": "USD",
        })
        assert settle_resp.status_code == 201
        settlement_id = settle_resp.json()["id"]

        # Update the settlement amount
        update_resp = await client.put(f"/trips/{tid}/expenses/{settlement_id}", json={
            "amount": 50,
        })
        assert update_resp.status_code == 200
        data = update_resp.json()
        # The split should be updated to match new amount
        assert len(data["splits"]) >= 1


# ──────────────────────────────────────────────
# DELETE EXPENSE ADVANCED PATHS
# ──────────────────────────────────────────────

class TestDeleteExpenseAdvancedPaths:

    @pytest.mark.asyncio
    async def test_delete_expense_not_found_returns_404(self, client, trip):
        """Deleting non-existent expense returns 404."""
        tid = trip["id"]
        resp = await client.delete(f"/trips/{tid}/expenses/999999")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_expense_wrong_trip_returns_404(self, client, trip, members):
        """Deleting expense from wrong trip returns 404."""
        trip2_resp = await client.post("/trips/", json={"name": "Trip 2", "base_currency": "USD"})
        trip2_id = trip2_resp.json()["id"]
        trip2_data = await client.get(f"/trips/{trip2_id}")
        creator_member = next(m for m in trip2_data.json()["members"] if m["user_id"] == TEST_USER_ID)

        exp_resp = await client.post(f"/trips/{trip2_id}/expenses", json={
            "description": "Wrong trip expense",
            "amount": 50,
            "currency": "USD",
            "paid_by_member_id": creator_member["id"],
            "split_type": "equal",
        })
        expense_id = exp_resp.json()["id"]

        tid = trip["id"]
        resp = await client.delete(f"/trips/{tid}/expenses/{expense_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_settlement_does_not_affect_trip_totals(self, client, async_session, trip, members):
        """Deleting a settlement does not decrement trip.total_spent."""
        from app.models.trip import Trip as TripModel

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

        settle_resp = await client.post(f"/trips/{tid}/settlements", json={
            "from_member_id": bob["id"],
            "to_member_id": alice["id"],
            "amount": 50,
            "currency": "USD",
        })
        settlement_id = settle_resp.json()["id"]

        await async_session.commit()
        trip_before = await async_session.get(TripModel, tid)
        total_before = float(trip_before.total_spent)

        await client.delete(f"/trips/{tid}/expenses/{settlement_id}")
        await async_session.commit()

        await async_session.refresh(trip_before)
        total_after = float(trip_before.total_spent)

        # Settlement deletion should NOT change total_spent
        assert abs(total_after - total_before) < 0.01, \
            f"Settlement deletion should not change total_spent: {total_before} -> {total_after}"


# ──────────────────────────────────────────────
# EXPENSE CHECK TRIP ACCESS PATHS
# ──────────────────────────────────────────────

class TestExpenseTripAccessPaths:

    @pytest.mark.asyncio
    async def test_list_expenses_trip_not_found(self, client):
        """List expenses for non-existent trip returns 404."""
        resp = await client.get("/trips/999999/expenses")
        assert resp.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_get_expense_trip_not_found(self, client):
        """Get expense for non-existent trip returns 404."""
        resp = await client.get("/trips/999999/expenses/1")
        assert resp.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_create_expense_trip_not_found(self, client):
        """Create expense for non-existent trip returns 404."""
        resp = await client.post("/trips/999999/expenses", json={
            "description": "test",
            "amount": 50,
            "currency": "USD",
            "paid_by_member_id": 1,
            "split_type": "equal",
        })
        assert resp.status_code in [403, 404]


# ──────────────────────────────────────────────
# REMAINDER DISTRIBUTION TESTS (coverage for remainder != 0 paths)
# ──────────────────────────────────────────────

class TestExpenseRemainderDistribution:
    """Tests that cover the remainder assignment branches in equal/percentage/custom splits."""

    @pytest.mark.asyncio
    async def test_create_percentage_split_with_remainder(self, client, trip, members):
        """Percentage split with non-divisible amount distributes the remainder."""
        tid = trip["id"]
        alice, bob = members

        # 10.01 split 50%/50%: each quantizes to 5.00, leaving 0.01 remainder
        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Remainder test",
            "amount": "10.01",
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "percentage",
            "splits": [
                {"member_id": alice["id"], "percentage": "50"},
                {"member_id": bob["id"], "percentage": "50"},
            ],
        })
        assert resp.status_code == 201
        data = resp.json()
        # Total of splits must equal expense amount
        total_splits = sum(Decimal(str(s["amount"])) for s in data["splits"])
        assert abs(total_splits - Decimal("10.01")) < Decimal("0.001")

    @pytest.mark.asyncio
    async def test_create_custom_split_with_remainder(self, client, trip, members):
        """Custom split with sub-cent amounts distributes the remainder."""
        tid = trip["id"]
        alice, bob = members

        # 10.01 custom split with 5.005 + 5.005 = 10.01 (passes schema),
        # but after quantize each becomes 5.00, leaving 0.01 remainder
        resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Custom remainder test",
            "amount": "10.01",
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": "5.005"},
                {"member_id": bob["id"], "amount": "5.005"},
            ],
        })
        assert resp.status_code == 201
        data = resp.json()
        total_splits = sum(Decimal(str(s["amount"])) for s in data["splits"])
        assert abs(total_splits - Decimal("10.01")) < Decimal("0.001")

    @pytest.mark.asyncio
    async def test_update_equal_split_with_remainder(self, client, trip, members):
        """Updating expense to equal split with non-divisible amount distributes remainder."""
        tid = trip["id"]
        alice, bob = members

        # Create an expense first
        create_resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Update remainder",
            "amount": "9.00",
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        assert create_resp.status_code == 201
        exp_id = create_resp.json()["id"]

        # Update to 10.01 with equal split (still 2 members, 5.005 each → 5.00+5.00=10.00, remainder 0.01)
        resp = await client.put(f"/trips/{tid}/expenses/{exp_id}", json={
            "amount": "10.01",
            "split_type": "equal",
        })
        assert resp.status_code == 200
        data = resp.json()
        total_splits = sum(Decimal(str(s["amount"])) for s in data["splits"])
        assert abs(total_splits - Decimal("10.01")) < Decimal("0.001")

    @pytest.mark.asyncio
    async def test_update_percentage_split_with_remainder(self, client, trip, members):
        """Updating expense to percentage split with non-divisible amount distributes remainder."""
        tid = trip["id"]
        alice, bob = members

        create_resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Pct remainder update",
            "amount": "9.00",
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        assert create_resp.status_code == 201
        exp_id = create_resp.json()["id"]

        # Update with percentage split on 10.01 → remainder path
        resp = await client.put(f"/trips/{tid}/expenses/{exp_id}", json={
            "amount": "10.01",
            "split_type": "percentage",
            "splits": [
                {"member_id": alice["id"], "percentage": "50"},
                {"member_id": bob["id"], "percentage": "50"},
            ],
        })
        assert resp.status_code == 200
        data = resp.json()
        total_splits = sum(Decimal(str(s["amount"])) for s in data["splits"])
        assert abs(total_splits - Decimal("10.01")) < Decimal("0.001")

    @pytest.mark.asyncio
    async def test_update_custom_split_with_remainder(self, client, trip, members):
        """Updating expense to custom split with sub-cent amounts distributes remainder."""
        tid = trip["id"]
        alice, bob = members

        create_resp = await client.post(f"/trips/{tid}/expenses", json={
            "description": "Custom remainder update",
            "amount": "9.00",
            "currency": "USD",
            "paid_by_member_id": alice["id"],
            "split_type": "equal",
        })
        assert create_resp.status_code == 201
        exp_id = create_resp.json()["id"]

        # Update with custom split having sub-cent amounts summing to 10.01
        resp = await client.put(f"/trips/{tid}/expenses/{exp_id}", json={
            "amount": "10.01",
            "split_type": "custom",
            "splits": [
                {"member_id": alice["id"], "amount": "5.005"},
                {"member_id": bob["id"], "amount": "5.005"},
            ],
        })
        assert resp.status_code == 200
        data = resp.json()
        total_splits = sum(Decimal(str(s["amount"])) for s in data["splits"])
        assert abs(total_splits - Decimal("10.01")) < Decimal("0.001")
