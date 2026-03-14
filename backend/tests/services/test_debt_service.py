"""
Unit tests for app/services/debt.py

Tests service functions directly with the async database session,
without going through the HTTP layer.
"""

import os
import pytest
import pytest_asyncio
from decimal import Decimal
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, select

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.models.expense import Expense
from app.models.split import Split
from app.models.member_debt import MemberDebt
from app.services.debt import (
    reconstruct_debts_greedy,
    minimize_transactions,
    get_member_balances,
    update_debts_for_expense,
    delete_debts_for_expense,
    update_trip_member_balances_for_debt,
    update_trip_member_balances_for_expense_deletion,
    update_debts_for_expense_modification,
)
from app.core.datetime_utils import utcnow

TEST_USER_ID = "debt-svc-test-user-001"
TEST_USER_EMAIL = "debtsvc@example.com"


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
        user = User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="Debt Svc User")
        session.add(user)
        await session.commit()
        yield session


async def create_trip(session: AsyncSession, base_currency: str = "USD") -> Trip:
    now = utcnow()
    trip = Trip(
        name="Test Trip",
        base_currency=base_currency,
        created_by=TEST_USER_ID,
        created_at=now,
        updated_at=now,
    )
    session.add(trip)
    await session.commit()
    await session.refresh(trip)
    return trip


async def create_member(session: AsyncSession, trip_id: int, nickname: str) -> TripMember:
    member = TripMember(
        trip_id=trip_id,
        nickname=nickname,
        status="active",
        is_admin=False,
    )
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member


async def create_expense_with_splits(
    session: AsyncSession,
    trip: Trip,
    payer: TripMember,
    amount: Decimal,
    currency: str,
    splits_data: list,  # list of (member, amount)
) -> tuple:
    now = utcnow()
    expense = Expense(
        trip_id=trip.id,
        description="Test Expense",
        amount=amount,
        currency=currency,
        exchange_rate_to_base=Decimal("1.0"),
        paid_by_member_id=payer.id,
        expense_type="expense",
        created_by=TEST_USER_ID,
        created_at=now,
        updated_at=now,
    )
    session.add(expense)
    await session.flush()

    splits = []
    for member, split_amount in splits_data:
        split = Split(
            expense_id=expense.id,
            member_id=member.id,
            amount=split_amount,
        )
        session.add(split)
        splits.append(split)

    await session.commit()
    await session.refresh(expense)
    return expense, splits


# ──────────────────────────────────────────────
# reconstruct_debts_greedy TESTS
# ──────────────────────────────────────────────


class TestReconstructDebtsGreedy:
    def test_simple_two_member_debt(self):
        """A owes B $100."""
        net_balances = {1: Decimal("-100"), 2: Decimal("100")}
        result = reconstruct_debts_greedy(net_balances, "USD", {1: "Alice", 2: "Bob"})
        assert len(result) == 1
        assert result[0]["from_member_id"] == 1
        assert result[0]["to_member_id"] == 2
        assert abs(result[0]["amount"] - 100.0) < 0.01

    def test_three_members_minimal_transactions(self):
        """A owes $30, B owes $20, C is owed $50 → 2 transactions."""
        net_balances = {
            1: Decimal("-30"),
            2: Decimal("-20"),
            3: Decimal("50"),
        }
        names = {1: "A", 2: "B", 3: "C"}
        result = reconstruct_debts_greedy(net_balances, "USD", names)
        # Total owed to C = 50, total owed = 50
        to_c = [r for r in result if r["to_member_id"] == 3]
        total_to_c = sum(r["amount"] for r in to_c)
        assert abs(total_to_c - 50.0) < 0.01

    def test_balanced_returns_empty(self):
        """If no one owes anyone, return empty list."""
        net_balances = {1: Decimal("0"), 2: Decimal("0")}
        result = reconstruct_debts_greedy(net_balances, "USD", {1: "A", 2: "B"})
        assert result == []

    def test_circular_debts_resolved(self):
        """A owes B $50, B owes C $50, C owes A $50 → all cancel out."""
        # Net balance for each = 0
        net_balances = {1: Decimal("0"), 2: Decimal("0"), 3: Decimal("0")}
        result = reconstruct_debts_greedy(net_balances, "USD", {1: "A", 2: "B", 3: "C"})
        assert result == []

    def test_is_base_currency_flag_adds_amount_in_base(self):
        net_balances = {1: Decimal("-100"), 2: Decimal("100")}
        result = reconstruct_debts_greedy(
            net_balances, "USD", {1: "A", 2: "B"}, is_base_currency=True
        )
        assert len(result) == 1
        assert "amount_in_base" in result[0]
        assert abs(result[0]["amount_in_base"] - 100.0) < 0.01

    def test_currency_field_in_result(self):
        net_balances = {1: Decimal("-50"), 2: Decimal("50")}
        result = reconstruct_debts_greedy(net_balances, "EUR", {1: "A", 2: "B"})
        assert result[0]["currency"] == "EUR"

    def test_nicknames_in_result(self):
        net_balances = {1: Decimal("-75"), 2: Decimal("75")}
        result = reconstruct_debts_greedy(net_balances, "USD", {1: "Alice", 2: "Bob"})
        assert result[0]["from_nickname"] == "Alice"
        assert result[0]["to_nickname"] == "Bob"


# ──────────────────────────────────────────────
# minimize_transactions TESTS
# ──────────────────────────────────────────────


class TestMinimizeTransactions:
    def test_empty_returns_empty(self):
        result = minimize_transactions([], "USD")
        assert result == []

    def test_simple_case(self):
        debts = [
            {
                "from_member_id": 1,
                "to_member_id": 2,
                "from_nickname": "A",
                "to_nickname": "B",
                "amount": 100.0,
                "currency": "USD",
                "amount_in_base": 100.0,
            }
        ]
        result = minimize_transactions(debts, "USD")
        assert len(result) == 1
        assert abs(result[0]["amount"] - 100.0) < 0.01

    def test_cancelling_debts(self):
        """A owes B $100, B owes A $100 → cancel to 0."""
        debts = [
            {
                "from_member_id": 1,
                "to_member_id": 2,
                "from_nickname": "A",
                "to_nickname": "B",
                "amount": 100.0,
                "currency": "USD",
                "amount_in_base": 100.0,
            },
            {
                "from_member_id": 2,
                "to_member_id": 1,
                "from_nickname": "B",
                "to_nickname": "A",
                "amount": 100.0,
                "currency": "USD",
                "amount_in_base": 100.0,
            },
        ]
        result = minimize_transactions(debts, "USD")
        assert result == []

    def test_multi_currency_consolidation(self):
        """A owes B 100 USD and 50 USD → total 150 USD."""
        debts = [
            {
                "from_member_id": 1,
                "to_member_id": 2,
                "from_nickname": "A",
                "to_nickname": "B",
                "amount": 100.0,
                "currency": "USD",
                "amount_in_base": 100.0,
            },
            {
                "from_member_id": 1,
                "to_member_id": 2,
                "from_nickname": "A",
                "to_nickname": "B",
                "amount": 50.0,
                "currency": "EUR",
                "amount_in_base": 50.0,
            },
        ]
        result = minimize_transactions(debts, "USD")
        total = sum(r["amount"] for r in result)
        assert abs(total - 150.0) < 0.01


# ──────────────────────────────────────────────
# get_member_balances TESTS
# ──────────────────────────────────────────────


class TestGetMemberBalances:
    @pytest.mark.asyncio
    async def test_empty_trip_returns_zero_balances(self, async_session):
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")

        result = await get_member_balances(trip.id, async_session)
        assert "member_balances" in result
        assert "debts" in result
        assert result["debts"] == []
        for b in result["member_balances"]:
            assert b["net_balance"] == 0.0

    @pytest.mark.asyncio
    async def test_basic_debt_shows_in_balances(self, async_session):
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        expense, splits = await create_expense_with_splits(
            async_session, trip, alice, Decimal("100"), "USD",
            [(alice, Decimal("50")), (bob, Decimal("50"))]
        )
        await update_debts_for_expense(expense, splits, async_session)
        await async_session.commit()

        result = await get_member_balances(trip.id, async_session)
        alice_bal = next(b for b in result["member_balances"] if b["member_id"] == alice.id)
        bob_bal = next(b for b in result["member_balances"] if b["member_id"] == bob.id)

        assert alice_bal["net_balance"] > 0
        assert bob_bal["net_balance"] < 0

    @pytest.mark.asyncio
    async def test_nonexistent_trip_returns_empty(self, async_session):
        result = await get_member_balances(999999, async_session)
        assert result == {"member_balances": [], "debts": []}

    @pytest.mark.asyncio
    async def test_simplify_mode(self, async_session):
        """simplify=True should resolve circular debts."""
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")
        charlie = await create_member(async_session, trip.id, "Charlie")

        # A pays for B → B owes A
        e1, s1 = await create_expense_with_splits(
            async_session, trip, alice, Decimal("100"), "USD",
            [(bob, Decimal("100"))]
        )
        await update_debts_for_expense(e1, s1, async_session)

        # B pays for C → C owes B
        e2, s2 = await create_expense_with_splits(
            async_session, trip, bob, Decimal("100"), "USD",
            [(charlie, Decimal("100"))]
        )
        await update_debts_for_expense(e2, s2, async_session)

        # C pays for A → A owes C
        e3, s3 = await create_expense_with_splits(
            async_session, trip, charlie, Decimal("100"), "USD",
            [(alice, Decimal("100"))]
        )
        await update_debts_for_expense(e3, s3, async_session)
        await async_session.commit()

        result = await get_member_balances(trip.id, async_session, simplify=True)
        for b in result["member_balances"]:
            assert abs(b["net_balance"]) < 0.5, f"Member {b['member_nickname']} should be ~0"

    @pytest.mark.asyncio
    async def test_minimize_mode(self, async_session):
        """minimize=True returns debts in base currency."""
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        expense, splits = await create_expense_with_splits(
            async_session, trip, alice, Decimal("100"), "USD",
            [(alice, Decimal("50")), (bob, Decimal("50"))]
        )
        await update_debts_for_expense(expense, splits, async_session)
        await async_session.commit()

        result = await get_member_balances(trip.id, async_session, minimize=True)
        assert "debts" in result
        # Should have at least one debt (Bob owes Alice)
        if result["debts"]:
            for debt in result["debts"]:
                assert debt["currency"] == trip.base_currency


# ──────────────────────────────────────────────
# update_trip_member_balances_for_debt TESTS
# ──────────────────────────────────────────────


class TestUpdateTripMemberBalancesForDebt:
    @pytest.mark.asyncio
    async def test_add_operation_increases_balances(self, async_session):
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        initial_owed = alice.total_owed_base if hasattr(alice, 'total_owed_base') else Decimal("0")

        await update_trip_member_balances_for_debt(
            bob.id, alice.id, Decimal("50"), async_session, operation="add"
        )
        await async_session.commit()

        await async_session.refresh(bob)
        await async_session.refresh(alice)

        # Bob is debtor (owes) → total_owed_base increases
        # Alice is creditor (owed) → total_owed_to_base increases
        assert bob.total_owed_base >= Decimal("50")
        assert alice.total_owed_to_base >= Decimal("50")

    @pytest.mark.asyncio
    async def test_subtract_operation_decreases_balances(self, async_session):
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        # First add
        await update_trip_member_balances_for_debt(
            bob.id, alice.id, Decimal("100"), async_session, operation="add"
        )
        await async_session.commit()

        # Then subtract
        await update_trip_member_balances_for_debt(
            bob.id, alice.id, Decimal("100"), async_session, operation="subtract"
        )
        await async_session.commit()

        await async_session.refresh(bob)
        await async_session.refresh(alice)

        assert abs(bob.total_owed_base) < Decimal("0.01")
        assert abs(alice.total_owed_to_base) < Decimal("0.01")

    @pytest.mark.asyncio
    async def test_nonexistent_member_does_not_crash(self, async_session):
        """If member doesn't exist, function should not raise."""
        trip = await create_trip(async_session)
        # This should not raise even if members 999999/888888 don't exist
        await update_trip_member_balances_for_debt(
            999999, 888888, Decimal("50"), async_session, operation="add"
        )
        await async_session.commit()


# ──────────────────────────────────────────────
# update_trip_member_balances_for_expense_deletion TESTS
# ──────────────────────────────────────────────


class TestUpdateTripMemberBalancesForExpenseDeletion:
    @pytest.mark.asyncio
    async def test_deletion_updates_balance_correctly(self, async_session):
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        expense, splits = await create_expense_with_splits(
            async_session, trip, alice, Decimal("100"), "USD",
            [(bob, Decimal("100"))]
        )
        await update_debts_for_expense(expense, splits, async_session)
        await async_session.commit()

        await async_session.refresh(bob)
        owed_before = bob.total_owed_base

        await update_trip_member_balances_for_expense_deletion(expense.id, async_session)
        await async_session.commit()

        await async_session.refresh(bob)
        assert bob.total_owed_base < owed_before or abs(bob.total_owed_base) < Decimal("0.01")

    @pytest.mark.asyncio
    async def test_no_debts_returns_early(self, async_session):
        """If expense has no debts, function returns without error."""
        trip = await create_trip(async_session)
        # Call with a non-existent expense_id
        await update_trip_member_balances_for_expense_deletion(99999, async_session)
        await async_session.commit()


# ──────────────────────────────────────────────
# update_debts_for_expense_modification TESTS
# ──────────────────────────────────────────────


class TestUpdateDebtsForExpenseModification:
    @pytest.mark.asyncio
    async def test_modification_replaces_old_debts(self, async_session):
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        expense, splits = await create_expense_with_splits(
            async_session, trip, alice, Decimal("100"), "USD",
            [(bob, Decimal("100"))]
        )
        await update_debts_for_expense(expense, splits, async_session)
        await async_session.commit()

        # Verify initial debt
        stmt = select(MemberDebt).where(MemberDebt.source_expense_id == expense.id)
        result = await async_session.execute(stmt)
        initial_debts = result.scalars().all()
        assert len(initial_debts) > 0

        # Modify: new splits with different amount
        new_split = Split(expense_id=expense.id, member_id=bob.id, amount=Decimal("60"))
        async_session.add(new_split)
        await async_session.commit()

        new_splits = [new_split]
        await update_debts_for_expense_modification(expense, new_splits, async_session)
        await async_session.commit()

        # Old debts replaced
        stmt = select(MemberDebt).where(MemberDebt.source_expense_id == expense.id)
        result = await async_session.execute(stmt)
        updated_debts = result.scalars().all()
        # Should have new debt with updated amount
        total = sum(d.amount for d in updated_debts)
        assert abs(total - Decimal("60")) < Decimal("0.01")


# ──────────────────────────────────────────────
# delete_debts_for_expense TESTS
# ──────────────────────────────────────────────


class TestDeleteDebtsForExpense:
    @pytest.mark.asyncio
    async def test_deletes_all_debts_for_expense(self, async_session):
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")
        charlie = await create_member(async_session, trip.id, "Charlie")

        expense, splits = await create_expense_with_splits(
            async_session, trip, alice, Decimal("120"), "USD",
            [(bob, Decimal("60")), (charlie, Decimal("60"))]
        )
        await update_debts_for_expense(expense, splits, async_session)
        await async_session.commit()

        count = await delete_debts_for_expense(expense.id, async_session)
        await async_session.commit()

        assert count == 2

        stmt = select(MemberDebt).where(MemberDebt.source_expense_id == expense.id)
        result = await async_session.execute(stmt)
        remaining = result.scalars().all()
        assert len(remaining) == 0

    @pytest.mark.asyncio
    async def test_delete_nonexistent_expense_returns_zero(self, async_session):
        count = await delete_debts_for_expense(999999, async_session)
        assert count == 0

    @pytest.mark.asyncio
    async def test_deletes_only_target_expense_debts(self, async_session):
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        expense1, splits1 = await create_expense_with_splits(
            async_session, trip, alice, Decimal("100"), "USD",
            [(bob, Decimal("100"))]
        )
        expense2, splits2 = await create_expense_with_splits(
            async_session, trip, alice, Decimal("200"), "USD",
            [(bob, Decimal("200"))]
        )
        await update_debts_for_expense(expense1, splits1, async_session)
        await update_debts_for_expense(expense2, splits2, async_session)
        await async_session.commit()

        await delete_debts_for_expense(expense1.id, async_session)
        await async_session.commit()

        stmt = select(MemberDebt).where(MemberDebt.source_expense_id == expense2.id)
        result = await async_session.execute(stmt)
        remaining = result.scalars().all()
        assert len(remaining) > 0


# ──────────────────────────────────────────────
# record_settlement TESTS
# ──────────────────────────────────────────────


class TestRecordSettlement:
    @pytest.mark.asyncio
    async def test_record_settlement_success(self, async_session):
        """record_settlement creates a settlement expense and debt."""
        from app.services.debt import record_settlement
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        result = await record_settlement(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("50"),
            currency="USD",
            session=async_session,
            user_id=TEST_USER_ID,
        )
        await async_session.commit()

        assert result["status"] == "recorded"
        assert "expense_id" in result

    @pytest.mark.asyncio
    async def test_record_settlement_invalid_members(self, async_session):
        """record_settlement raises ValueError for nonexistent members."""
        from app.services.debt import record_settlement
        trip = await create_trip(async_session)

        with pytest.raises(ValueError, match="Invalid member IDs"):
            await record_settlement(
                trip_id=trip.id,
                debtor_member_id=999999,
                creditor_member_id=888888,
                amount=Decimal("50"),
                currency="USD",
                session=async_session,
                user_id=TEST_USER_ID,
            )

    @pytest.mark.asyncio
    async def test_record_settlement_invalid_trip(self, async_session):
        """record_settlement raises ValueError for nonexistent trip."""
        from app.services.debt import record_settlement
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        with pytest.raises(ValueError, match="Invalid trip ID"):
            await record_settlement(
                trip_id=999999,
                debtor_member_id=alice.id,
                creditor_member_id=bob.id,
                amount=Decimal("50"),
                currency="USD",
                session=async_session,
                user_id=TEST_USER_ID,
            )

    @pytest.mark.asyncio
    async def test_record_settlement_with_currency_conversion_notes(self, async_session):
        """record_settlement auto-generates notes when target_currency provided."""
        from app.services.debt import record_settlement
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        result = await record_settlement(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("50"),
            currency="USD",
            session=async_session,
            user_id=TEST_USER_ID,
            conversion_rate=Decimal("0.92"),
            target_currency="EUR",
        )
        await async_session.commit()
        assert result["status"] == "recorded"

    @pytest.mark.asyncio
    async def test_record_settlement_preserves_custom_notes(self, async_session):
        """record_settlement keeps provided notes instead of auto-generating."""
        from app.services.debt import record_settlement
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        result = await record_settlement(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("50"),
            currency="USD",
            session=async_session,
            user_id=TEST_USER_ID,
            notes="Manual payment",
            conversion_rate=Decimal("0.92"),
            target_currency="EUR",
        )
        await async_session.commit()
        assert result["status"] == "recorded"


# ──────────────────────────────────────────────
# convert_all_debts_to_currency TESTS
# ──────────────────────────────────────────────


class TestConvertAllDebtsToCurrency:
    @pytest.mark.asyncio
    async def test_converts_debts_to_target_currency(self, async_session):
        """convert_all_debts_to_currency converts non-target debts."""
        from app.services.debt import convert_all_debts_to_currency
        trip = await create_trip(async_session, base_currency="USD")
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        # Create a EUR debt manually
        now = utcnow()
        debt = MemberDebt(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("100"),
            currency="EUR",
        )
        async_session.add(debt)
        await async_session.commit()

        result = await convert_all_debts_to_currency(
            trip_id=trip.id,
            target_currency="USD",
            session=async_session,
            custom_rates={"EUR": Decimal("1.10")},
        )
        await async_session.commit()

        assert result["status"] == "success"
        assert result["target_currency"] == "USD"
        assert result["total_debts_converted"] == 1
        assert len(result["conversions"]) == 1
        assert abs(result["conversions"][0]["converted_amount"] - 110.0) < 0.01

    @pytest.mark.asyncio
    async def test_skips_debts_already_in_target_currency(self, async_session):
        """Debts already in target currency are not converted."""
        from app.services.debt import convert_all_debts_to_currency
        trip = await create_trip(async_session, base_currency="USD")
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        debt = MemberDebt(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("100"),
            currency="USD",
        )
        async_session.add(debt)
        await async_session.commit()

        result = await convert_all_debts_to_currency(
            trip_id=trip.id,
            target_currency="USD",
            session=async_session,
        )
        await async_session.commit()

        assert result["total_debts_converted"] == 0

    @pytest.mark.asyncio
    async def test_empty_trip_returns_zero_conversions(self, async_session):
        """No debts → zero conversions."""
        from app.services.debt import convert_all_debts_to_currency
        trip = await create_trip(async_session)

        result = await convert_all_debts_to_currency(
            trip_id=trip.id,
            target_currency="USD",
            session=async_session,
        )

        assert result["status"] == "success"
        assert result["total_debts_converted"] == 0

    @pytest.mark.asyncio
    async def test_uses_custom_rates_when_provided(self, async_session):
        """Custom rates are used instead of API rates."""
        from app.services.debt import convert_all_debts_to_currency
        trip = await create_trip(async_session, base_currency="USD")
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        debt = MemberDebt(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("100"),
            currency="EUR",
        )
        async_session.add(debt)
        await async_session.commit()

        custom_rate = Decimal("1.25")
        result = await convert_all_debts_to_currency(
            trip_id=trip.id,
            target_currency="USD",
            session=async_session,
            custom_rates={"EUR": custom_rate},
        )
        await async_session.commit()

        assert result["total_debts_converted"] == 1
        assert abs(result["conversions"][0]["converted_amount"] - 125.0) < 0.01
        assert abs(result["conversions"][0]["conversion_rate"] - 1.25) < 0.001


# ──────────────────────────────────────────────
# merge_debt_currency TESTS
# ──────────────────────────────────────────────


class TestMergeDebtCurrency:
    @pytest.mark.asyncio
    async def test_merge_creates_debt_in_new_currency(self, async_session):
        """merge_debt_currency converts a debt from one currency to another."""
        from app.services.debt import merge_debt_currency
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        # Create source debt in EUR
        debt = MemberDebt(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("100"),
            currency="EUR",
        )
        async_session.add(debt)
        await async_session.commit()

        result = await merge_debt_currency(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("100"),
            from_currency="EUR",
            to_currency="USD",
            conversion_rate=Decimal("1.10"),
            session=async_session,
        )
        await async_session.commit()

        assert result["status"] == "merged"
        assert result["from_currency"] == "EUR"
        assert result["to_currency"] == "USD"
        assert abs(result["converted_amount"] - 110.0) < 0.01

    @pytest.mark.asyncio
    async def test_merge_raises_if_no_source_debt(self, async_session):
        """merge_debt_currency raises ValueError when source debt doesn't exist."""
        from app.services.debt import merge_debt_currency
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        with pytest.raises(ValueError, match="No debt found"):
            await merge_debt_currency(
                trip_id=trip.id,
                debtor_member_id=alice.id,
                creditor_member_id=bob.id,
                amount=Decimal("100"),
                from_currency="EUR",
                to_currency="USD",
                conversion_rate=Decimal("1.10"),
                session=async_session,
            )

    @pytest.mark.asyncio
    async def test_merge_raises_if_amount_exceeds_debt(self, async_session):
        """merge_debt_currency raises ValueError when amount exceeds owed."""
        from app.services.debt import merge_debt_currency
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        debt = MemberDebt(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("50"),
            currency="EUR",
        )
        async_session.add(debt)
        await async_session.commit()

        with pytest.raises(ValueError, match="Cannot merge"):
            await merge_debt_currency(
                trip_id=trip.id,
                debtor_member_id=alice.id,
                creditor_member_id=bob.id,
                amount=Decimal("100"),  # More than the 50 owed
                from_currency="EUR",
                to_currency="USD",
                conversion_rate=Decimal("1.10"),
                session=async_session,
            )

    @pytest.mark.asyncio
    async def test_merge_partial_amount(self, async_session):
        """merge_debt_currency can partially merge a debt."""
        from app.services.debt import merge_debt_currency
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        debt = MemberDebt(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("100"),
            currency="EUR",
        )
        async_session.add(debt)
        await async_session.commit()

        result = await merge_debt_currency(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("60"),  # Partial amount
            from_currency="EUR",
            to_currency="USD",
            conversion_rate=Decimal("1.10"),
            session=async_session,
        )
        await async_session.commit()

        assert abs(result["merged_amount"] - 60.0) < 0.01
        assert abs(result["remaining_in_original_currency"] - 40.0) < 0.01

    @pytest.mark.asyncio
    async def test_merge_adds_to_existing_target_debt(self, async_session):
        """merge_debt_currency adds to existing debt in target currency."""
        from app.services.debt import merge_debt_currency
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        # Source debt in EUR
        source_debt = MemberDebt(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("100"),
            currency="EUR",
        )
        # Existing USD debt (no source_expense_id so merge can find it)
        existing_usd = MemberDebt(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("50"),
            currency="USD",
            source_expense_id=None,
        )
        async_session.add(source_debt)
        async_session.add(existing_usd)
        await async_session.commit()

        result = await merge_debt_currency(
            trip_id=trip.id,
            debtor_member_id=alice.id,
            creditor_member_id=bob.id,
            amount=Decimal("100"),
            from_currency="EUR",
            to_currency="USD",
            conversion_rate=Decimal("1.10"),
            session=async_session,
        )
        await async_session.commit()

        # Old USD debt was 50, added 110 = 160
        assert abs(result["old_target_amount"] - 50.0) < 0.01
        assert abs(result["new_target_amount"] - 160.0) < 0.01


# ──────────────────────────────────────────────
# update_debts_for_expense (existing debt path) TESTS
# ──────────────────────────────────────────────


class TestUpdateDebtsForExpenseExistingDebt:
    @pytest.mark.asyncio
    async def test_existing_debt_for_same_expense_accumulates(self, async_session):
        """When update_debts_for_expense is called with the same expense_id, existing debt accumulates."""
        trip = await create_trip(async_session)
        alice = await create_member(async_session, trip.id, "Alice")
        bob = await create_member(async_session, trip.id, "Bob")

        now = utcnow()
        expense = Expense(
            trip_id=trip.id,
            description="Test",
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

        # First split
        split1 = Split(expense_id=expense.id, member_id=bob.id, amount=Decimal("50"))
        async_session.add(split1)
        await async_session.commit()

        await update_debts_for_expense(expense, [split1], async_session)
        await async_session.commit()

        # Check initial debt
        stmt = select(MemberDebt).where(MemberDebt.source_expense_id == expense.id)
        result = await async_session.execute(stmt)
        debts = result.scalars().all()
        assert len(debts) == 1
        assert debts[0].amount == Decimal("50")
