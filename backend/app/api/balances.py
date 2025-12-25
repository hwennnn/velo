"""
Balance and Settlement API endpoints with debt tracking
"""

from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.auth import get_current_user
from app.core.database import get_session
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.services.debt import (
    get_member_balances,
    get_settlements_plan,
    record_settlement,
    merge_debt_currency,
)
from app.services.exchange_rate import get_exchange_rate, fetch_exchange_rates

router = APIRouter()


class SettlementCreate(BaseModel):
    """Schema for recording a settlement"""

    from_member_id: int = Field(..., description="Member who is paying")
    to_member_id: int = Field(..., description="Member who is receiving")
    amount: Decimal = Field(..., gt=0, description="Settlement amount")
    currency: str = Field(
        ..., min_length=3, max_length=3, description="Currency of payment"
    )
    settlement_date: date = Field(..., description="Date of settlement")
    notes: str = Field(default="", description="Optional notes")

    # Optional: for currency conversion
    convert_to_currency: Optional[str] = Field(
        None, description="Convert payment to this currency"
    )
    conversion_rate: Optional[Decimal] = Field(
        None, description="Conversion rate if converting"
    )


class DebtMergeRequest(BaseModel):
    """Schema for merging debt from one currency to another"""

    from_member_id: int = Field(..., description="Member who owes (debtor)")
    to_member_id: int = Field(..., description="Member who is owed (creditor)")
    amount: Decimal = Field(..., gt=0, description="Amount to merge")
    from_currency: str = Field(
        ..., min_length=3, max_length=3, description="Original currency"
    )
    to_currency: str = Field(
        ..., min_length=3, max_length=3, description="Target currency"
    )
    conversion_rate: Optional[Decimal] = Field(
        None, gt=0, description="Conversion rate (1 from_currency = X to_currency)"
    )


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


@router.get("/trips/{trip_id}/balances")
async def get_trip_balances(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get balance summary for all members in a trip.
    Uses the member_debts table for efficient queries.
    Shows currency-specific balances and totals.
    """
    # Check access
    await check_trip_access(trip_id, current_user, session)

    # Get balances from debt records
    balances = await get_member_balances(trip_id, session)

    return {
        "trip_id": trip_id,
        "balances": balances,
    }


@router.get("/trips/{trip_id}/settlements")
async def get_trip_settlements(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get settlement plan from debt records.
    Returns direct debts between members in each currency.
    Much more efficient than calculating from expenses.
    """
    # Check access
    trip, _ = await check_trip_access(trip_id, current_user, session)

    # Get settlements from debt records
    settlements = await get_settlements_plan(trip_id, session)

    return {
        "trip_id": trip_id,
        "base_currency": trip.base_currency,
        "settlements": settlements,
    }


@router.post("/trips/{trip_id}/settlements", status_code=status.HTTP_201_CREATED)
async def record_settlement_payment(
    trip_id: int,
    settlement_data: SettlementCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Record a settlement between two members.
    Directly updates the member_debts table to reduce debt.
    Supports currency conversion if specified.
    """
    # Check access
    trip, _ = await check_trip_access(trip_id, current_user, session)

    # Verify both members exist and belong to this trip
    from_member = await session.get(TripMember, settlement_data.from_member_id)
    to_member = await session.get(TripMember, settlement_data.to_member_id)

    if not from_member or from_member.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid from_member_id",
        )

    if not to_member or to_member.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid to_member_id",
        )

    if settlement_data.from_member_id == settlement_data.to_member_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot settle with yourself",
        )

    # Handle currency conversion if specified
    conversion_rate = None
    target_currency = None

    if settlement_data.convert_to_currency:
        target_currency = settlement_data.convert_to_currency
        if settlement_data.conversion_rate:
            conversion_rate = settlement_data.conversion_rate
        else:
            # Fetch conversion rate
            conversion_rate = await get_exchange_rate(
                settlement_data.currency, target_currency
            )

    # Record the settlement in the debt system (creates a settlement expense)
    result = await record_settlement(
        trip_id=trip_id,
        debtor_member_id=settlement_data.from_member_id,
        creditor_member_id=settlement_data.to_member_id,
        amount=settlement_data.amount,
        currency=settlement_data.currency,
        session=session,
        user_id=current_user.id,
        settlement_date=settlement_data.settlement_date,
        notes=settlement_data.notes,
        conversion_rate=conversion_rate,
        target_currency=target_currency,
    )

    await session.commit()

    return {
        "message": "Settlement recorded successfully",
        "settlement": {
            "from_member": from_member.nickname,
            "to_member": to_member.nickname,
            "amount": float(settlement_data.amount),
            "currency": settlement_data.currency,
            "settlement_date": settlement_data.settlement_date.isoformat(),
            **result,
        },
    }


@router.get("/exchange-rates/{base_currency}")
async def get_exchange_rates(
    base_currency: str,
):
    """
    Get current exchange rates for a base currency.
    Results are cached for 30 minutes to minimize API calls.

    Args:
        base_currency: Base currency code (e.g., 'USD', 'SGD')

    Returns:
        Dictionary of currency codes to exchange rates
    """
    try:
        rates = await fetch_exchange_rates(base_currency.upper())
        return {
            "base_currency": base_currency.upper(),
            "rates": {currency: float(rate) for currency, rate in rates.items()},
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch exchange rates: {str(e)}",
        )


@router.post("/trips/{trip_id}/debts/merge", status_code=status.HTTP_200_OK)
async def merge_debt_currencies(
    trip_id: int,
    merge_data: DebtMergeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Merge a debt from one currency to another without paying it.
    This consolidates debts in fewer currencies for easier settlement.

    Example: Bob owes Alice 25 USD and 50 SGD
    -> Merge 25 USD to SGD (converts to ~33.75 SGD)
    -> Result: Bob owes Alice 83.75 SGD
    """
    # Check access
    await check_trip_access(trip_id, current_user, session)

    # Verify both members exist and belong to this trip
    from_member = await session.get(TripMember, merge_data.from_member_id)
    to_member = await session.get(TripMember, merge_data.to_member_id)

    if not from_member or from_member.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid from_member_id",
        )

    if not to_member or to_member.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid to_member_id",
        )

    if merge_data.from_member_id == merge_data.to_member_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot merge debt with yourself",
        )

    if merge_data.from_currency == merge_data.to_currency:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot merge to the same currency",
        )

    # Get conversion rate if not provided
    conversion_rate = merge_data.conversion_rate
    if not conversion_rate:
        conversion_rate = await get_exchange_rate(
            merge_data.from_currency, merge_data.to_currency
        )

    # Merge the debt
    result = await merge_debt_currency(
        trip_id=trip_id,
        debtor_member_id=merge_data.from_member_id,
        creditor_member_id=merge_data.to_member_id,
        amount=merge_data.amount,
        from_currency=merge_data.from_currency,
        to_currency=merge_data.to_currency,
        conversion_rate=conversion_rate,
        session=session,
    )

    await session.commit()

    return {
        "message": "Debt merged successfully",
        "merge": {
            "from_member": from_member.nickname,
            "to_member": to_member.nickname,
            "original_amount": float(merge_data.amount),
            "original_currency": merge_data.from_currency,
            "converted_amount": float(merge_data.amount * conversion_rate),
            "target_currency": merge_data.to_currency,
            "conversion_rate": float(conversion_rate),
            **result,
        },
    }
