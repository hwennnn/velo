"""
Expense API endpoints for expense tracking
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
import random
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.core.auth import get_current_user
from app.core.database import get_session
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.models.expense import Expense
from app.models.split import Split
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseResponse,
    ExpenseListResponse,
    SplitResponse,
)
from app.services.exchange_rate import get_exchange_rate
from app.services.debt import update_debts_for_expense, delete_debts_for_expense

router = APIRouter()


async def check_trip_access(
    trip_id: int,
    user: User,
    session: AsyncSession,
) -> tuple[Trip, TripMember]:
    """
    Check if user has access to trip.
    Returns (trip, member) if access granted.
    Raises HTTPException if not.
    """
    # Check if trip exists
    trip = await session.get(Trip, trip_id)
    if not trip or trip.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Check if user is a member
    member_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == user.id,
    )
    result = await session.execute(member_statement)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this trip",
        )

    return trip, member


@router.post(
    "/trips/{trip_id}/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_expense(
    trip_id: int,
    expense_data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExpenseResponse:
    """
    Create a new expense in a trip.
    User must be a member of the trip.
    """
    # Check access
    trip, _ = await check_trip_access(trip_id, current_user, session)

    # Verify paid_by_member exists and belongs to this trip
    paid_by_member = await session.get(TripMember, expense_data.paid_by_member_id)
    if not paid_by_member or paid_by_member.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid paid_by_member_id",
        )

    # Get exchange rate
    exchange_rate = await get_exchange_rate(expense_data.currency, trip.base_currency)

    # Create expense
    expense = Expense(
        trip_id=trip_id,
        description=expense_data.description,
        amount=expense_data.amount,
        currency=expense_data.currency,
        exchange_rate_to_base=exchange_rate,
        paid_by_member_id=expense_data.paid_by_member_id,
        expense_date=expense_data.expense_date,
        category=expense_data.category,
        notes=expense_data.notes,
        receipt_url=expense_data.receipt_url,
        expense_type=(
            expense_data.expense_type
            if hasattr(expense_data, "expense_type")
            else "expense"
        ),
        created_by=current_user.id,
    )

    session.add(expense)
    await session.commit()
    await session.refresh(expense)

    # Calculate amount in base currency for debt tracking
    amount_in_base = expense.amount * exchange_rate

    # Create splits based on split_type (store amounts in expense currency)
    splits_to_create = []

    if expense_data.split_type == "equal":
        # If splits are provided, use only those members; otherwise use all trip members
        if expense_data.splits and len(expense_data.splits) > 0:
            member_ids = [split.member_id for split in expense_data.splits]
        else:
            # Fallback: Get all trip members
            members_statement = select(TripMember).where(TripMember.trip_id == trip_id)
            result = await session.execute(members_statement)
            members = result.scalars().all()
            member_ids = [member.id for member in members]

        # Calculate equal splits in expense currency with rounding fix
        num_members = len(member_ids)
        split_amount = (expense.amount / num_members).quantize(Decimal("0.01"))
        split_percentage = (Decimal("100.0") / num_members).quantize(Decimal("0.01"))

        # Calculate total and remainder in expense currency
        total_split = split_amount * num_members
        remainder = expense.amount - total_split

        # Assign remainder to a random member
        lucky_index = random.randint(0, num_members - 1) if remainder != 0 else -1

        for idx, member_id in enumerate(member_ids):
            amount = split_amount
            if idx == lucky_index:
                amount += remainder

            splits_to_create.append(
                Split(
                    expense_id=expense.id,
                    member_id=member_id,
                    amount=amount,  # Now in expense currency
                    percentage=split_percentage,
                )
            )

    elif expense_data.split_type == "percentage":
        # Calculate splits in expense currency with rounding fix
        total_assigned = Decimal("0")
        lucky_index = random.randint(0, len(expense_data.splits) - 1)

        for idx, split_data in enumerate(expense_data.splits):
            split_amount = (expense.amount * (split_data.percentage / 100)).quantize(
                Decimal("0.01")
            )
            total_assigned += split_amount

            splits_to_create.append(
                {
                    "member_id": split_data.member_id,
                    "amount": split_amount,  # Now in expense currency
                    "percentage": split_data.percentage,
                    "index": idx,
                }
            )

        # Assign remainder to random member (in expense currency)
        remainder = expense.amount - total_assigned
        if remainder != 0:
            splits_to_create[lucky_index]["amount"] += remainder

        # Create split objects
        for split_data in splits_to_create:
            session.add(
                Split(
                    expense_id=expense.id,
                    member_id=split_data["member_id"],
                    amount=split_data["amount"],  # Now in expense currency
                    percentage=split_data["percentage"],
                )
            )
        splits_to_create = []  # Clear since we already added them

    elif expense_data.split_type == "custom":
        # Calculate splits in expense currency with rounding fix
        total_assigned = Decimal("0")
        lucky_index = random.randint(0, len(expense_data.splits) - 1)

        for idx, split_data in enumerate(expense_data.splits):
            split_amount = split_data.amount.quantize(Decimal("0.01"))
            split_percentage = ((split_amount / expense.amount) * 100).quantize(
                Decimal("0.01")
            )
            total_assigned += split_amount

            splits_to_create.append(
                {
                    "member_id": split_data.member_id,
                    "amount": split_amount,  # Already in expense currency
                    "percentage": split_percentage,
                    "index": idx,
                }
            )

        # Assign remainder to random member (in expense currency)
        remainder = expense.amount - total_assigned
        if remainder != 0:
            splits_to_create[lucky_index]["amount"] += remainder

        # Create split objects
        for split_data in splits_to_create:
            session.add(
                Split(
                    expense_id=expense.id,
                    member_id=split_data["member_id"],
                    amount=split_data["amount"],  # Now in expense currency
                    percentage=split_data["percentage"],
                )
            )
        splits_to_create = []  # Clear since we already added them

    # Add remaining splits (for equal type)
    for split in splits_to_create:
        session.add(split)

    await session.commit()

    # Get all splits for debt update
    splits_statement = select(Split).where(Split.expense_id == expense.id)
    result = await session.execute(splits_statement)
    all_splits = result.scalars().all()

    # Update member debts (only for regular expenses, not settlements)
    if expense.expense_type == "expense":
        await update_debts_for_expense(expense, all_splits, session)
        # Note: TripMember balance updates are handled within update_debts_for_expense
        # when debts are created/modified

    # Update trip metadata
    trip.total_spent += amount_in_base
    trip.expense_count += 1
    trip.updated_at = datetime.utcnow()
    session.add(trip)
    await session.commit()

    # Build response
    return await get_expense_response(expense, session)


async def get_expense_response(
    expense: Expense, session: AsyncSession
) -> ExpenseResponse:
    """Build expense response with splits"""
    # Get paid by member
    paid_by_member = await session.get(TripMember, expense.paid_by_member_id)

    # Get splits
    splits_statement = select(Split).where(Split.expense_id == expense.id)
    result = await session.execute(splits_statement)
    splits = result.scalars().all()

    split_responses = []
    for split in splits:
        member = await session.get(TripMember, split.member_id)
        split_responses.append(
            SplitResponse(
                id=split.id,
                member_id=split.member_id,
                member_nickname=member.nickname if member else "Unknown",
                amount=split.amount,
                percentage=split.percentage,
            )
        )

    return ExpenseResponse(
        id=expense.id,
        trip_id=expense.trip_id,
        description=expense.description,
        amount=expense.amount,
        currency=expense.currency,
        exchange_rate_to_base=expense.exchange_rate_to_base,
        amount_in_base_currency=expense.amount * expense.exchange_rate_to_base,
        paid_by_member_id=expense.paid_by_member_id,
        paid_by_nickname=paid_by_member.nickname if paid_by_member else "Unknown",
        expense_date=expense.expense_date,
        category=expense.category,
        notes=expense.notes,
        receipt_url=expense.receipt_url,
        expense_type=(
            expense.expense_type if hasattr(expense, "expense_type") else "expense"
        ),
        splits=split_responses,
        created_by=expense.created_by,
    )


@router.get("/trips/{trip_id}/expenses", response_model=ExpenseListResponse)
async def list_expenses(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    paid_by_member_id: Optional[int] = Query(
        default=None, description="Filter by payer"
    ),
    expense_type: Optional[str] = Query(
        default=None,
        description="Filter by expense type: 'expenses', 'settlements', or 'all'",
    ),
) -> ExpenseListResponse:
    """
    List expenses for a trip with optional filters.
    User must be a member of the trip.
    """
    # Check access
    await check_trip_access(trip_id, current_user, session)

    # Build query
    statement = select(Expense).where(Expense.trip_id == trip_id)

    if category:
        statement = statement.where(Expense.category == category.lower())

    if paid_by_member_id:
        statement = statement.where(Expense.paid_by_member_id == paid_by_member_id)

    if expense_type:
        if expense_type == "expenses":
            statement = statement.where(Expense.expense_type == "expense")
        elif expense_type == "settlements":
            statement = statement.where(Expense.expense_type == "settlement")
        # For "all", don't add any filter

    # Order by date descending
    statement = statement.order_by(Expense.expense_date.desc(), Expense.id.desc())

    # Get total count
    count_statement = select(func.count(Expense.id)).where(Expense.trip_id == trip_id)
    if category:
        count_statement = count_statement.where(Expense.category == category.lower())
    if paid_by_member_id:
        count_statement = count_statement.where(
            Expense.paid_by_member_id == paid_by_member_id
        )
    if expense_type:
        if expense_type == "expenses":
            count_statement = count_statement.where(Expense.expense_type == "expense")
        elif expense_type == "settlements":
            count_statement = count_statement.where(
                Expense.expense_type == "settlement"
            )
        # For "all", don't add any filter

    result = await session.execute(count_statement)
    total = result.scalar_one()

    # Apply pagination
    statement = statement.offset((page - 1) * page_size).limit(page_size)

    result = await session.execute(statement)
    expenses = result.scalars().all()

    # Build responses
    expense_responses = []
    for expense in expenses:
        response = await get_expense_response(expense, session)
        expense_responses.append(response)

    return ExpenseListResponse(
        expenses=expense_responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/trips/{trip_id}/expenses/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    trip_id: int,
    expense_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExpenseResponse:
    """
    Get a specific expense.
    User must be a member of the trip.
    """
    # Check access
    await check_trip_access(trip_id, current_user, session)

    # Get expense
    expense = await session.get(Expense, expense_id)
    if not expense or expense.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    return await get_expense_response(expense, session)


@router.put("/trips/{trip_id}/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    trip_id: int,
    expense_id: int,
    expense_data: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExpenseResponse:
    """
    Update an expense.
    Only the creator can update an expense.
    Note: This does not update splits. Delete and recreate if splits need to change.
    """
    # Check access
    await check_trip_access(trip_id, current_user, session)

    # Get expense
    expense = await session.get(Expense, expense_id)
    if not expense or expense.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Check if user is the creator
    if expense.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the expense creator can update it",
        )

    # Update fields
    update_data = expense_data.model_dump(exclude_unset=True)

    # If currency changed, update exchange rate
    if "currency" in update_data:
        trip = await session.get(Trip, trip_id)
        exchange_rate = await get_exchange_rate(
            update_data["currency"], trip.base_currency
        )
        expense.exchange_rate_to_base = exchange_rate

    for field, value in update_data.items():
        setattr(expense, field, value)

    expense.updated_at = datetime.utcnow()

    session.add(expense)
    await session.commit()
    await session.refresh(expense)

    return await get_expense_response(expense, session)


@router.delete(
    "/trips/{trip_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_expense(
    trip_id: int,
    expense_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Delete an expense and all its splits.
    Only the creator or trip admins can delete an expense.
    """
    # Check access and get member info
    trip, member = await check_trip_access(trip_id, current_user, session)

    # Get expense
    expense = await session.get(Expense, expense_id)
    if not expense or expense.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Check if user is the creator or an admin
    if expense.created_by != current_user.id and not member.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the expense creator or trip admins can delete it",
        )

    # Calculate amount in base currency for trip metadata update
    amount_in_base = expense.amount * expense.exchange_rate_to_base

    # Delete all debts created by this expense (only for regular expenses)
    if expense.expense_type == "expense":
        await delete_debts_for_expense(expense.id, session)
        # Update TripMember balance fields to reflect debt deletion
        from app.services.debt import update_trip_member_balances_for_expense_deletion

        await update_trip_member_balances_for_expense_deletion(expense.id, session)

    # Delete all splits first (will cascade with new migration)
    splits_statement = select(Split).where(Split.expense_id == expense.id)
    result = await session.execute(splits_statement)
    splits = result.scalars().all()
    for split in splits:
        await session.delete(split)

    # Delete expense
    await session.delete(expense)

    # Update trip metadata
    trip.total_spent -= amount_in_base
    trip.expense_count -= 1
    trip.updated_at = datetime.utcnow()
    session.add(trip)

    await session.commit()
