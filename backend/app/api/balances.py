"""
Balance and Settlement API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.auth import get_current_user
from app.core.database import get_session
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.services.balance import (
    calculate_balances,
    calculate_settlements,
    get_member_balance_details,
)

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


@router.get("/trips/{trip_id}/balances")
async def get_trip_balances(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get balance summary for all members in a trip.
    Shows how much each member paid, owes, and their net balance.
    """
    # Check access
    await check_trip_access(trip_id, current_user, session)

    # Calculate balances
    balances = await calculate_balances(trip_id, session)

    return {
        "trip_id": trip_id,
        "balances": [balance.to_dict() for balance in balances],
    }


@router.get("/trips/{trip_id}/settlements")
async def get_trip_settlements(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get optimal settlement plan for a trip.
    Returns a list of payments that need to be made to settle all debts.
    """
    # Check access
    trip, _ = await check_trip_access(trip_id, current_user, session)

    # Calculate settlements
    settlements = await calculate_settlements(trip_id, session)

    return {
        "trip_id": trip_id,
        "base_currency": trip.base_currency,
        "settlements": [settlement.to_dict() for settlement in settlements],
    }


@router.get("/trips/{trip_id}/members/{member_id}/balance")
async def get_member_balance(
    trip_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get detailed balance information for a specific member.
    Shows all expenses they paid and all expenses they owe.
    """
    # Check access
    await check_trip_access(trip_id, current_user, session)

    # Get member balance details
    balance_details = await get_member_balance_details(trip_id, member_id, session)

    if not balance_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    return balance_details
