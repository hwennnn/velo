"""
Direct route handler tests for coverage.

These tests call the async route handler functions directly
(passing User and AsyncSession directly) rather than going through HTTP.
This approach correctly triggers coverage tracking for async route bodies.
"""

import os
import pytest
import pytest_asyncio
from decimal import Decimal
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, select
from fastapi import HTTPException

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
from app.schemas.trip import TripCreate, TripUpdate
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.core.datetime_utils import utcnow

TEST_USER_ID = "api-direct-test-user-001"
TEST_USER_EMAIL = "apidirect@example.com"


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
        user = User(id=TEST_USER_ID, email=TEST_USER_EMAIL, display_name="API Direct User")
        session.add(user)
        await session.commit()
        yield session


@pytest_asyncio.fixture(scope="function")
async def test_user(async_session) -> User:
    result = await async_session.execute(
        select(User).where(User.id == TEST_USER_ID)
    )
    return result.scalar_one()


async def _make_trip(session: AsyncSession, user: User, name: str = "Test Trip") -> Trip:
    """Helper: create a trip with the given user as admin member."""
    now = utcnow()
    trip = Trip(
        name=name,
        base_currency="USD",
        created_by=user.id,
        created_at=now,
        updated_at=now,
    )
    session.add(trip)
    await session.commit()
    await session.refresh(trip)

    member = TripMember(
        trip_id=trip.id,
        user_id=user.id,
        nickname=user.display_name or "User",
        status="active",
        is_admin=True,
    )
    member.joined_at = utcnow()
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return trip


async def _make_member(session: AsyncSession, trip_id: int, nickname: str, user_id=None) -> TripMember:
    m = TripMember(
        trip_id=trip_id,
        user_id=user_id,
        nickname=nickname,
        status="active",
        is_admin=False,
    )
    session.add(m)
    await session.commit()
    await session.refresh(m)
    return m


# ──────────────────────────────────────────────
# TRIPS API DIRECT TESTS
# ──────────────────────────────────────────────


class TestTripsAPIDirect:
    @pytest.mark.asyncio
    async def test_create_trip_direct(self, async_session, test_user):
        """Call create_trip route handler directly."""
        from app.api.trips import create_trip

        trip_data = TripCreate(name="Direct Trip", base_currency="USD")
        result = await create_trip(
            trip_data=trip_data,
            current_user=test_user,
            session=async_session,
        )
        assert result.name == "Direct Trip"
        assert result.member_count == 1

    @pytest.mark.asyncio
    async def test_list_trips_direct(self, async_session, test_user):
        """Call list_trips route handler directly."""
        from app.api.trips import list_trips

        await _make_trip(async_session, test_user, "Trip A")
        await _make_trip(async_session, test_user, "Trip B")

        result = await list_trips(
            current_user=test_user,
            session=async_session,
            page=1,
            page_size=10,
        )
        assert result.total >= 2
        assert len(result.trips) >= 2

    @pytest.mark.asyncio
    async def test_list_trips_pagination_direct(self, async_session, test_user):
        """list_trips pagination works."""
        from app.api.trips import list_trips

        for i in range(3):
            await _make_trip(async_session, test_user, f"Paged Trip {i}")

        result = await list_trips(
            current_user=test_user,
            session=async_session,
            page=1,
            page_size=2,
        )
        assert len(result.trips) <= 2

    @pytest.mark.asyncio
    async def test_get_trip_direct(self, async_session, test_user):
        """Call get_trip route handler directly."""
        from app.api.trips import get_trip

        trip = await _make_trip(async_session, test_user)
        result = await get_trip(
            trip_id=trip.id,
            current_user=test_user,
            session=async_session,
        )
        assert result.id == trip.id

    @pytest.mark.asyncio
    async def test_get_trip_not_found_raises(self, async_session, test_user):
        """get_trip raises 404 for nonexistent trip."""
        from app.api.trips import get_trip

        with pytest.raises(HTTPException) as exc_info:
            await get_trip(
                trip_id=999999,
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_trip_non_member_raises(self, async_session, test_user):
        """get_trip raises 403 when user is not a member."""
        from app.api.trips import get_trip

        # Create a trip NOT associated with test_user
        now = utcnow()
        other_trip = Trip(
            name="Other Trip",
            base_currency="USD",
            created_by="other-user",
            created_at=now,
            updated_at=now,
        )
        async_session.add(other_trip)
        await async_session.commit()
        await async_session.refresh(other_trip)

        with pytest.raises(HTTPException) as exc_info:
            await get_trip(
                trip_id=other_trip.id,
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_trip_direct(self, async_session, test_user):
        """Call update_trip route handler directly."""
        from app.api.trips import update_trip

        trip = await _make_trip(async_session, test_user)
        update = TripUpdate(name="Updated Trip Name")
        result = await update_trip(
            trip_id=trip.id,
            trip_data=update,
            current_user=test_user,
            session=async_session,
        )
        assert result.name == "Updated Trip Name"

    @pytest.mark.asyncio
    async def test_update_trip_not_found_raises(self, async_session, test_user):
        """update_trip raises 404 for nonexistent trip."""
        from app.api.trips import update_trip

        with pytest.raises(HTTPException) as exc_info:
            await update_trip(
                trip_id=999999,
                trip_data=TripUpdate(name="X"),
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_trip_direct(self, async_session, test_user):
        """Call delete_trip route handler directly."""
        from app.api.trips import delete_trip

        trip = await _make_trip(async_session, test_user)
        result = await delete_trip(
            trip_id=trip.id,
            current_user=test_user,
            session=async_session,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_trip_not_found_raises(self, async_session, test_user):
        """delete_trip raises 404 for nonexistent trip."""
        from app.api.trips import delete_trip

        with pytest.raises(HTTPException) as exc_info:
            await delete_trip(
                trip_id=999999,
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 404


# ──────────────────────────────────────────────
# USERS API DIRECT TESTS
# ──────────────────────────────────────────────


class TestUsersAPIDirect:
    @pytest.mark.asyncio
    async def test_get_current_user_direct(self, async_session, test_user):
        """Call get_current_user_profile route handler directly."""
        from app.api.users import get_current_user_profile

        result = await get_current_user_profile(current_user=test_user)
        assert result.id == TEST_USER_ID

    @pytest.mark.asyncio
    async def test_update_current_user_direct(self, async_session, test_user):
        """Call update_current_user_profile route handler directly."""
        from app.api.users import update_current_user_profile
        from app.api.users import UserUpdate

        update = UserUpdate(display_name="Updated Name")
        result = await update_current_user_profile(
            user_data=update,
            current_user=test_user,
            session=async_session,
        )
        assert result.display_name == "Updated Name"

    @pytest.mark.asyncio
    async def test_register_user_direct(self, async_session):
        """Call register_user route handler directly."""
        from app.api.users import register_user, UserRegister

        register_data = UserRegister(
            user_id="new-direct-user",
            email="newdirect@example.com",
            display_name="New Direct User",
        )
        result = await register_user(
            user_data=register_data,
            session=async_session,
        )
        assert result.id == "new-direct-user"

    @pytest.mark.asyncio
    async def test_register_existing_user_direct(self, async_session, test_user):
        """Registering an existing user returns the existing user."""
        from app.api.users import register_user, UserRegister

        register_data = UserRegister(
            user_id=TEST_USER_ID,
            email=TEST_USER_EMAIL,
            display_name="Same User",
        )
        result = await register_user(
            user_data=register_data,
            session=async_session,
        )
        assert result.id == TEST_USER_ID


# ──────────────────────────────────────────────
# EXPENSES API DIRECT TESTS
# ──────────────────────────────────────────────


class TestExpensesAPIDirect:
    @pytest.mark.asyncio
    async def test_create_expense_equal_split_direct(self, async_session, test_user):
        """Call create_expense route handler directly with equal split."""
        from app.api.expenses import create_expense

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        member = member_result.scalar_one()

        expense_data = ExpenseCreate(
            description="Test Expense",
            amount=Decimal("100"),
            currency="USD",
            paid_by_member_id=member.id,
            split_type="equal",
            member_ids=[member.id],
        )

        result = await create_expense(
            trip_id=trip.id,
            expense_data=expense_data,
            current_user=test_user,
            session=async_session,
        )
        assert result.description == "Test Expense"
        assert float(result.amount) == 100.0

    @pytest.mark.asyncio
    async def test_create_expense_custom_split_direct(self, async_session, test_user):
        """Call create_expense with custom split type."""
        from app.api.expenses import create_expense
        from app.schemas.expense import SplitCreate

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        member = member_result.scalar_one()

        expense_data = ExpenseCreate(
            description="Custom Split Expense",
            amount=Decimal("100"),
            currency="USD",
            paid_by_member_id=member.id,
            split_type="custom",
            splits=[SplitCreate(member_id=member.id, amount=Decimal("100"))],
        )

        result = await create_expense(
            trip_id=trip.id,
            expense_data=expense_data,
            current_user=test_user,
            session=async_session,
        )
        assert result.description == "Custom Split Expense"

    @pytest.mark.asyncio
    async def test_create_expense_percentage_split_direct(self, async_session, test_user):
        """Call create_expense with percentage split type."""
        from app.api.expenses import create_expense
        from app.schemas.expense import SplitCreate

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        member = member_result.scalar_one()

        expense_data = ExpenseCreate(
            description="Pct Split",
            amount=Decimal("100"),
            currency="USD",
            paid_by_member_id=member.id,
            split_type="percentage",
            splits=[SplitCreate(member_id=member.id, percentage=100.0)],
        )

        result = await create_expense(
            trip_id=trip.id,
            expense_data=expense_data,
            current_user=test_user,
            session=async_session,
        )
        assert result.description == "Pct Split"

    @pytest.mark.asyncio
    async def test_create_expense_invalid_paid_by_raises(self, async_session, test_user):
        """create_expense raises 400 when paid_by_member_id is invalid."""
        from app.api.expenses import create_expense

        trip = await _make_trip(async_session, test_user)

        expense_data = ExpenseCreate(
            description="Bad Paid By",
            amount=Decimal("100"),
            currency="USD",
            paid_by_member_id=999999,
            split_type="equal",
            member_ids=[999999],
        )

        with pytest.raises(HTTPException) as exc_info:
            await create_expense(
                trip_id=trip.id,
                expense_data=expense_data,
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code in [400, 404]

    @pytest.mark.asyncio
    async def test_list_expenses_direct(self, async_session, test_user):
        """Call list_expenses route handler directly."""
        from app.api.expenses import list_expenses, create_expense

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        member = member_result.scalar_one()

        # Create an expense first
        expense_data = ExpenseCreate(
            description="Listed Expense",
            amount=Decimal("50"),
            currency="USD",
            paid_by_member_id=member.id,
            split_type="equal",
            member_ids=[member.id],
        )
        await create_expense(
            trip_id=trip.id,
            expense_data=expense_data,
            current_user=test_user,
            session=async_session,
        )

        result = await list_expenses(
            trip_id=trip.id,
            current_user=test_user,
            session=async_session,
            expense_type=None,
            category=None,
            paid_by_member_id=None,
            page=1,
            page_size=20,
        )
        assert result.total >= 1

    @pytest.mark.asyncio
    async def test_list_expenses_with_filters_direct(self, async_session, test_user):
        """list_expenses with category filter."""
        from app.api.expenses import list_expenses

        trip = await _make_trip(async_session, test_user)

        result = await list_expenses(
            trip_id=trip.id,
            current_user=test_user,
            session=async_session,
            expense_type="expense",
            category="food",
            paid_by_member_id=None,
            page=1,
            page_size=20,
        )
        assert result.total == 0

    @pytest.mark.asyncio
    async def test_get_expense_direct(self, async_session, test_user):
        """Call get_expense route handler directly."""
        from app.api.expenses import get_expense, create_expense

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        member = member_result.scalar_one()

        expense_data = ExpenseCreate(
            description="Get Direct",
            amount=Decimal("75"),
            currency="USD",
            paid_by_member_id=member.id,
            split_type="equal",
            member_ids=[member.id],
        )
        created = await create_expense(
            trip_id=trip.id,
            expense_data=expense_data,
            current_user=test_user,
            session=async_session,
        )

        result = await get_expense(
            trip_id=trip.id,
            expense_id=created.id,
            current_user=test_user,
            session=async_session,
        )
        assert result.id == created.id

    @pytest.mark.asyncio
    async def test_get_expense_not_found_raises(self, async_session, test_user):
        """get_expense raises 404 for nonexistent expense."""
        from app.api.expenses import get_expense

        trip = await _make_trip(async_session, test_user)

        with pytest.raises(HTTPException) as exc_info:
            await get_expense(
                trip_id=trip.id,
                expense_id=999999,
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_expense_direct(self, async_session, test_user):
        """Call delete_expense route handler directly."""
        from app.api.expenses import delete_expense, create_expense

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        member = member_result.scalar_one()

        expense_data = ExpenseCreate(
            description="Delete Me",
            amount=Decimal("30"),
            currency="USD",
            paid_by_member_id=member.id,
            split_type="equal",
            member_ids=[member.id],
        )
        created = await create_expense(
            trip_id=trip.id,
            expense_data=expense_data,
            current_user=test_user,
            session=async_session,
        )

        result = await delete_expense(
            trip_id=trip.id,
            expense_id=created.id,
            current_user=test_user,
            session=async_session,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_update_expense_direct(self, async_session, test_user):
        """Call update_expense route handler directly."""
        from app.api.expenses import update_expense, create_expense

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        member = member_result.scalar_one()

        expense_data = ExpenseCreate(
            description="Original",
            amount=Decimal("100"),
            currency="USD",
            paid_by_member_id=member.id,
            split_type="equal",
            member_ids=[member.id],
        )
        created = await create_expense(
            trip_id=trip.id,
            expense_data=expense_data,
            current_user=test_user,
            session=async_session,
        )

        update = ExpenseUpdate(description="Updated Description")
        result = await update_expense(
            trip_id=trip.id,
            expense_id=created.id,
            expense_data=update,
            current_user=test_user,
            session=async_session,
        )
        assert result.description == "Updated Description"

    @pytest.mark.asyncio
    async def test_update_expense_not_found_raises(self, async_session, test_user):
        """update_expense raises 404 for nonexistent expense."""
        from app.api.expenses import update_expense

        trip = await _make_trip(async_session, test_user)

        with pytest.raises(HTTPException) as exc_info:
            await update_expense(
                trip_id=trip.id,
                expense_id=999999,
                expense_data=ExpenseUpdate(description="X"),
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 404


# ──────────────────────────────────────────────
# BALANCES API DIRECT TESTS
# ──────────────────────────────────────────────


class TestBalancesAPIDirect:
    @pytest.mark.asyncio
    async def test_get_trip_balances_direct(self, async_session, test_user):
        """Call get_trip_balances route handler directly."""
        from app.api.balances import get_trip_balances

        trip = await _make_trip(async_session, test_user)
        result = await get_trip_balances(
            trip_id=trip.id,
            minimize=False,
            current_user=test_user,
            session=async_session,
        )
        assert "member_balances" in result

    @pytest.mark.asyncio
    async def test_get_trip_balances_minimize_direct(self, async_session, test_user):
        """Call get_trip_balances with minimize=True directly."""
        from app.api.balances import get_trip_balances

        trip = await _make_trip(async_session, test_user)
        result = await get_trip_balances(
            trip_id=trip.id,
            minimize=True,
            current_user=test_user,
            session=async_session,
        )
        assert result["minimized"] is True

    @pytest.mark.asyncio
    async def test_get_trip_totals_direct(self, async_session, test_user):
        """Call get_trip_totals route handler directly."""
        from app.api.balances import get_trip_totals

        trip = await _make_trip(async_session, test_user)
        result = await get_trip_totals(
            trip_id=trip.id,
            current_user=test_user,
            session=async_session,
        )
        assert result is not None

    @pytest.mark.asyncio
    async def test_record_settlement_direct(self, async_session, test_user):
        """Call record_settlement_payment route handler directly."""
        from app.api.balances import record_settlement_payment, SettlementCreate

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        payer = member_result.scalar_one()

        # Create a second member to receive payment
        receiver = await _make_member(async_session, trip.id, "Receiver")

        settlement_data = SettlementCreate(
            from_member_id=payer.id,
            to_member_id=receiver.id,
            amount=Decimal("50"),
            currency="USD",
        )

        result = await record_settlement_payment(
            trip_id=trip.id,
            settlement_data=settlement_data,
            current_user=test_user,
            session=async_session,
        )
        # Returns an ExpenseResponse for the settlement expense
        assert result is not None
        assert result.expense_type == "settlement"

    @pytest.mark.asyncio
    async def test_record_settlement_invalid_from_member_raises(self, async_session, test_user):
        """record_settlement_payment raises 400 when from_member is invalid."""
        from app.api.balances import record_settlement_payment, SettlementCreate

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        payer = member_result.scalar_one()

        settlement_data = SettlementCreate(
            from_member_id=999999,  # Invalid
            to_member_id=payer.id,
            amount=Decimal("50"),
            currency="USD",
        )

        with pytest.raises(HTTPException) as exc_info:
            await record_settlement_payment(
                trip_id=trip.id,
                settlement_data=settlement_data,
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_record_settlement_invalid_to_member_raises(self, async_session, test_user):
        """record_settlement_payment raises 400 when to_member is invalid."""
        from app.api.balances import record_settlement_payment, SettlementCreate

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        payer = member_result.scalar_one()

        settlement_data = SettlementCreate(
            from_member_id=payer.id,
            to_member_id=999999,  # Invalid
            amount=Decimal("50"),
            currency="USD",
        )

        with pytest.raises(HTTPException) as exc_info:
            await record_settlement_payment(
                trip_id=trip.id,
                settlement_data=settlement_data,
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 400


# ──────────────────────────────────────────────
# MEMBERS API DIRECT TESTS
# ──────────────────────────────────────────────


class TestMembersAPIDirect:
    @pytest.mark.asyncio
    async def test_list_members_direct(self, async_session, test_user):
        """Call list_members route handler directly."""
        from app.api.members import list_members

        trip = await _make_trip(async_session, test_user)
        result = await list_members(
            trip_id=trip.id,
            current_user=test_user,
            session=async_session,
        )
        assert len(result) >= 1

    @pytest.mark.asyncio
    async def test_add_member_direct(self, async_session, test_user):
        """Call add_member route handler directly."""
        from app.api.members import add_member
        from app.schemas.member import MemberAdd

        trip = await _make_trip(async_session, test_user)

        member_data = MemberAdd(nickname="New Guest")
        result = await add_member(
            trip_id=trip.id,
            member_data=member_data,
            current_user=test_user,
            session=async_session,
        )
        assert result.nickname == "New Guest"

    @pytest.mark.asyncio
    async def test_add_member_with_email_direct(self, async_session, test_user):
        """Call add_member with email (pending status)."""
        from app.api.members import add_member
        from app.schemas.member import MemberAdd

        trip = await _make_trip(async_session, test_user)

        member_data = MemberAdd(nickname="Pending Member", email="pending@example.com")
        result = await add_member(
            trip_id=trip.id,
            member_data=member_data,
            current_user=test_user,
            session=async_session,
        )
        assert result.nickname == "Pending Member"

    @pytest.mark.asyncio
    async def test_update_member_direct(self, async_session, test_user):
        """Call update_member route handler directly."""
        from app.api.members import update_member
        from app.schemas.member import MemberUpdate

        trip = await _make_trip(async_session, test_user)
        guest = await _make_member(async_session, trip.id, "Original Name")

        update = MemberUpdate(nickname="New Name")
        result = await update_member(
            trip_id=trip.id,
            member_id=guest.id,
            member_data=update,
            current_user=test_user,
            session=async_session,
        )
        assert result.nickname == "New Name"

    @pytest.mark.asyncio
    async def test_update_member_not_found_raises(self, async_session, test_user):
        """update_member raises 404 for nonexistent member."""
        from app.api.members import update_member
        from app.schemas.member import MemberUpdate

        trip = await _make_trip(async_session, test_user)

        with pytest.raises(HTTPException) as exc_info:
            await update_member(
                trip_id=trip.id,
                member_id=999999,
                member_data=MemberUpdate(nickname="X"),
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_remove_member_direct(self, async_session, test_user):
        """Call remove_member route handler directly."""
        from app.api.members import remove_member

        trip = await _make_trip(async_session, test_user)
        guest = await _make_member(async_session, trip.id, "Guest To Remove")

        result = await remove_member(
            trip_id=trip.id,
            member_id=guest.id,
            current_user=test_user,
            session=async_session,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_remove_last_admin_raises(self, async_session, test_user):
        """remove_member raises 400 when removing the last admin."""
        from app.api.members import remove_member

        trip = await _make_trip(async_session, test_user)
        member_result = await async_session.execute(
            select(TripMember).where(
                TripMember.trip_id == trip.id,
                TripMember.user_id == test_user.id,
            )
        )
        admin = member_result.scalar_one()

        with pytest.raises(HTTPException) as exc_info:
            await remove_member(
                trip_id=trip.id,
                member_id=admin.id,
                current_user=test_user,
                session=async_session,
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_generate_invite_link_direct(self, async_session, test_user):
        """Call generate_invite_link route handler directly."""
        from app.api.members import generate_invite_link

        trip = await _make_trip(async_session, test_user)

        result = await generate_invite_link(
            trip_id=trip.id,
            current_user=test_user,
            session=async_session,
        )
        assert "invite_code" in result or result is not None

    @pytest.mark.asyncio
    async def test_decode_invite_link_direct(self, async_session, test_user):
        """Call decode_invite_link after generate."""
        from app.api.members import generate_invite_link, decode_invite_link

        trip = await _make_trip(async_session, test_user)
        invite_result = await generate_invite_link(
            trip_id=trip.id,
            request=None,
            current_user=test_user,
            session=async_session,
        )
        invite_code = invite_result.invite_code

        result = await decode_invite_link(
            code=invite_code,
            claim=None,
            current_user=test_user,
            session=async_session,
        )
        assert result is not None
