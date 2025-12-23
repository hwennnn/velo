"""
Expense API endpoints for expense tracking
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

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

router = APIRouter()


def check_trip_access(
    trip_id: int,
    user: User,
    session: Session,
) -> tuple[Trip, TripMember]:
    """
    Check if user has access to trip.
    Returns (trip, member) if access granted.
    Raises HTTPException if not.
    """
    # Check if trip exists
    trip = session.get(Trip, trip_id)
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
    member = session.exec(member_statement).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this trip",
        )

    return trip, member


async def get_exchange_rate(from_currency: str, to_currency: str) -> Decimal:
    """
    Get exchange rate from one currency to another.
    In a real app, this would call an external API.
    For now, returns 1.0 if currencies are the same.
    """
    if from_currency == to_currency:
        return Decimal("1.0")

    # TODO: Implement real exchange rate API
    # For now, use hardcoded rates (should be from an API like exchangerate-api.com)
    # This is a simplified example
    rates_to_usd = {
        "USD": Decimal("1.0"),
        "EUR": Decimal("1.18"),
        "GBP": Decimal("1.37"),
        "JPY": Decimal("0.0091"),
        "CAD": Decimal("0.80"),
        "AUD": Decimal("0.76"),
        "CHF": Decimal("1.12"),
        "CNY": Decimal("0.15"),
        "INR": Decimal("0.013"),
    }

    # Convert through USD
    if from_currency in rates_to_usd and to_currency in rates_to_usd:
        rate_from = rates_to_usd[from_currency]
        rate_to = rates_to_usd[to_currency]
        return rate_to / rate_from

    # Default to 1.0 if currencies not found
    return Decimal("1.0")


@router.post("/trips/{trip_id}/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    trip_id: int,
    expense_data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExpenseResponse:
    """
    Create a new expense in a trip.
    User must be a member of the trip.
    """
    # Check access
    trip, _ = check_trip_access(trip_id, current_user, session)

    # Verify paid_by_member exists and belongs to this trip
    paid_by_member = session.get(TripMember, expense_data.paid_by_member_id)
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
        created_by=current_user.id,
    )

    session.add(expense)
    session.commit()
    session.refresh(expense)

    # Calculate amount in base currency
    amount_in_base = expense.amount * exchange_rate

    # Create splits based on split_type
    if expense_data.split_type == "equal":
        # Get all trip members
        members_statement = select(TripMember).where(
            TripMember.trip_id == trip_id)
        members = session.exec(members_statement).all()

        split_amount = amount_in_base / len(members)
        split_percentage = Decimal("100.0") / len(members)

        for member in members:
            split = Split(
                expense_id=expense.id,
                member_id=member.id,
                amount=split_amount,
                percentage=split_percentage,
            )
            session.add(split)

    elif expense_data.split_type == "percentage":
        for split_data in expense_data.splits:
            split_amount = amount_in_base * (split_data.percentage / 100)
            split = Split(
                expense_id=expense.id,
                member_id=split_data.member_id,
                amount=split_amount,
                percentage=split_data.percentage,
            )
            session.add(split)

    elif expense_data.split_type == "custom":
        for split_data in expense_data.splits:
            # Convert custom amount to base currency
            split_amount_in_base = split_data.amount * exchange_rate
            split_percentage = (split_amount_in_base / amount_in_base) * 100

            split = Split(
                expense_id=expense.id,
                member_id=split_data.member_id,
                amount=split_amount_in_base,
                percentage=split_percentage,
            )
            session.add(split)

    session.commit()

    # Build response
    return await get_expense_response(expense, session)


async def get_expense_response(expense: Expense, session: Session) -> ExpenseResponse:
    """Build expense response with splits"""
    # Get paid by member
    paid_by_member = session.get(TripMember, expense.paid_by_member_id)

    # Get splits
    splits_statement = select(Split).where(Split.expense_id == expense.id)
    splits = session.exec(splits_statement).all()

    split_responses = []
    for split in splits:
        member = session.get(TripMember, split.member_id)
        split_responses.append(SplitResponse(
            id=split.id,
            member_id=split.member_id,
            member_nickname=member.nickname if member else "Unknown",
            amount=split.amount,
            percentage=split.percentage,
        ))

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
        splits=split_responses,
        created_by=expense.created_by,
    )


@router.get("/trips/{trip_id}/expenses", response_model=ExpenseListResponse)
async def list_expenses(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100,
                           description="Items per page"),
    category: Optional[str] = Query(
        default=None, description="Filter by category"),
    paid_by_member_id: Optional[int] = Query(
        default=None, description="Filter by payer"),
) -> ExpenseListResponse:
    """
    List expenses for a trip with optional filters.
    User must be a member of the trip.
    """
    # Check access
    check_trip_access(trip_id, current_user, session)

    # Build query
    statement = select(Expense).where(Expense.trip_id == trip_id)

    if category:
        statement = statement.where(Expense.category == category.lower())

    if paid_by_member_id:
        statement = statement.where(
            Expense.paid_by_member_id == paid_by_member_id)

    # Order by date descending
    statement = statement.order_by(
        Expense.expense_date.desc(), Expense.id.desc())

    # Get total count
    count_statement = select(func.count(Expense.id)).where(
        Expense.trip_id == trip_id)
    if category:
        count_statement = count_statement.where(
            Expense.category == category.lower())
    if paid_by_member_id:
        count_statement = count_statement.where(
            Expense.paid_by_member_id == paid_by_member_id)

    total = session.exec(count_statement).one()

    # Apply pagination
    statement = statement.offset((page - 1) * page_size).limit(page_size)

    expenses = session.exec(statement).all()

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
    session: Session = Depends(get_session),
) -> ExpenseResponse:
    """
    Get a specific expense.
    User must be a member of the trip.
    """
    # Check access
    check_trip_access(trip_id, current_user, session)

    # Get expense
    expense = session.get(Expense, expense_id)
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
    session: Session = Depends(get_session),
) -> ExpenseResponse:
    """
    Update an expense.
    Only the creator can update an expense.
    Note: This does not update splits. Delete and recreate if splits need to change.
    """
    # Check access
    check_trip_access(trip_id, current_user, session)

    # Get expense
    expense = session.get(Expense, expense_id)
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
        trip = session.get(Trip, trip_id)
        exchange_rate = await get_exchange_rate(update_data["currency"], trip.base_currency)
        expense.exchange_rate_to_base = exchange_rate

    for field, value in update_data.items():
        setattr(expense, field, value)

    expense.updated_at = datetime.utcnow()

    session.add(expense)
    session.commit()
    session.refresh(expense)

    return await get_expense_response(expense, session)


@router.delete("/trips/{trip_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    trip_id: int,
    expense_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """
    Delete an expense and all its splits.
    Only the creator can delete an expense.
    """
    # Check access
    check_trip_access(trip_id, current_user, session)

    # Get expense
    expense = session.get(Expense, expense_id)
    if not expense or expense.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    # Check if user is the creator
    if expense.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the expense creator can delete it",
        )

    # Delete all splits first
    splits_statement = select(Split).where(Split.expense_id == expense.id)
    splits = session.exec(splits_statement).all()
    for split in splits:
        session.delete(split)

    # Delete expense
    session.delete(expense)
    session.commit()
