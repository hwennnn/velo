"""
Balance and Settlement API endpoints with debt tracking
"""

from datetime import date
from decimal import Decimal
from typing import Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
    record_settlement,
    merge_debt_currency,
    convert_all_debts_to_currency,
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


class BulkConversionRequest(BaseModel):
    """Schema for bulk currency conversion of all debts"""

    target_currency: str = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Target currency to convert all debts to",
    )
    use_custom_rates: bool = Field(
        default=False, description="Use custom rates instead of Google rates"
    )
    custom_rates: Optional[Dict[str, Decimal]] = Field(
        None, description="Custom exchange rates {currency: rate_to_target}"
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
    minimize: bool = Query(
        default=False,
        description="Convert all debts to base currency and minimize transactions. Default false.",
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get balance summary for all members in a trip.
    Uses the member_debts table for efficient queries.
    Shows currency-specific balances and detailed debt relationships.

    Args:
        trip_id: Trip ID
        simplify: If True, net out reverse debts per pair/currency.
                  If omitted, uses trip.simplify_debts setting.
        minimize: If True, convert all debts to base currency and minimize transactions.
                  Default false.

    Returns:
        - member_balances: List of member balances with currency breakdown
        - debts: List of who owes who how much
    """
    # Check access
    trip, _ = await check_trip_access(trip_id, current_user, session)

    effective_simplify = bool(trip.simplify_debts)

    # Get balances and debts from debt records
    result = await get_member_balances(
        trip_id, session, simplify=effective_simplify, minimize=minimize
    )

    return {
        "trip_id": trip_id,
        "base_currency": trip.base_currency,
        "simplified": effective_simplify,
        "minimized": minimize,
        "member_balances": result["member_balances"],
        "debts": result["debts"],
    }


@router.get("/trips/{trip_id}/totals")
async def get_trip_totals(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get spending totals for all members in a trip.
    Shows how much each person paid vs their fair share.

    Returns:
        - total_spent: Trip total in base currency
        - member_totals: List with per-member data:
          - member_id, member_nickname
          - total_paid: Sum of expenses where this member is the payer
          - total_share: Sum of their splits across all expenses
          - difference: total_paid - total_share (positive = overpaid, negative = underpaid)
    """
    from app.models.expense import Expense
    from app.models.split import Split
    from sqlalchemy import func

    # Check access
    trip, _ = await check_trip_access(trip_id, current_user, session)

    # Get all members
    members_statement = select(TripMember).where(TripMember.trip_id == trip_id)
    result = await session.execute(members_statement)
    members = result.scalars().all()

    # Calculate total paid per member (sum of expenses they paid, in base currency)
    # Formula: amount * exchange_rate_to_base
    paid_statement = (
        select(
            Expense.paid_by_member_id,
            func.sum(Expense.amount * Expense.exchange_rate_to_base).label(
                "total_paid"
            ),
        )
        .where(Expense.trip_id == trip_id)
        .group_by(Expense.paid_by_member_id)
    )
    paid_result = await session.execute(paid_statement)
    paid_by_member = {
        row.paid_by_member_id: float(row.total_paid or 0) for row in paid_result
    }

    # Calculate total share per member (sum of their splits, converted to base currency)
    # Need to join with Expense to get exchange rate
    share_statement = (
        select(
            Split.member_id,
            func.sum(Split.amount * Expense.exchange_rate_to_base).label("total_share"),
        )
        .join(Expense, Split.expense_id == Expense.id)
        .where(Expense.trip_id == trip_id)
        .group_by(Split.member_id)
    )
    share_result = await session.execute(share_statement)
    share_by_member = {
        row.member_id: float(row.total_share or 0) for row in share_result
    }

    # Build response with all members
    member_totals = []
    for member in members:
        total_paid = paid_by_member.get(member.id, 0.0)
        total_share = share_by_member.get(member.id, 0.0)
        difference = total_paid - total_share

        member_totals.append(
            {
                "member_id": member.id,
                "member_nickname": member.nickname,
                "total_paid": round(total_paid, 2),
                "total_share": round(total_share, 2),
                "difference": round(difference, 2),
            }
        )

    # Sort by total_paid descending (highest spenders first)
    member_totals.sort(key=lambda x: x["total_paid"], reverse=True)

    return {
        "trip_id": trip_id,
        "base_currency": trip.base_currency,
        "total_spent": float(trip.total_spent or 0),
        "member_totals": member_totals,
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
        notes=settlement_data.notes,
        conversion_rate=conversion_rate,
        target_currency=target_currency,
    )

    await session.commit()

    # Fetch the complete expense object with splits
    from app.models.expense import Expense
    from app.api.expenses import get_expense_response

    expense_id = result["expense_id"]
    expense = await session.get(Expense, expense_id)

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve created settlement expense",
        )

    return await get_expense_response(expense, session)


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


@router.post("/trips/{trip_id}/debts/convert-all", status_code=status.HTTP_200_OK)
async def convert_all_debts(
    trip_id: int,
    conversion_data: BulkConversionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Convert all debts in a trip to a single target currency.
    This consolidates all multi-currency debts for easier settlement.

    Supports two modes:
    1. Google rates (default): Fetches current exchange rates automatically
    2. Custom rates: Use user-provided exchange rates

    Example:
    - Trip has debts in USD, EUR, JPY, SGD
    - Convert all to SGD
    - Result: All debts are now in SGD only
    """
    # Check access
    await check_trip_access(trip_id, current_user, session)

    # Validate target currency
    target_currency = conversion_data.target_currency.upper()

    # Prepare custom rates if provided
    custom_rates = None
    if conversion_data.use_custom_rates and conversion_data.custom_rates:
        custom_rates = {
            currency.upper(): rate
            for currency, rate in conversion_data.custom_rates.items()
        }

    # Convert all debts
    result = await convert_all_debts_to_currency(
        trip_id=trip_id,
        target_currency=target_currency,
        session=session,
        custom_rates=custom_rates,
    )

    await session.commit()

    return {
        "message": "All debts converted successfully",
        "conversion": result,
    }
