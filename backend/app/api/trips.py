"""
Trip API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.api.members import build_members_response
from app.core.auth import get_current_user
from app.core.database import get_session
from app.core.datetime_utils import utcnow, to_utc_isoformat
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.schemas.trip import (
    TripCreate,
    TripUpdate,
    TripResponse,
    TripListResponse,
    TripMemberResponse,
)

router = APIRouter()


@router.post("/", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    trip_data: TripCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Trip:
    """
    Create a new trip.
    The current user becomes the creator and first admin member.
    """
    # Create trip
    now = utcnow()
    
    trip = Trip(
        name=trip_data.name,
        description=trip_data.description,
        base_currency=trip_data.base_currency,
        start_date=trip_data.start_date,
        end_date=trip_data.end_date,
        simplify_debts=trip_data.simplify_debts,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )

    session.add(trip)
    await session.commit()
    await session.refresh(trip)

    # Add creator as first member (admin)
    member = TripMember(
        trip_id=trip.id,
        user_id=current_user.id,
        nickname=current_user.display_name or current_user.email.split("@")[0],
        is_fictional=False,
        is_admin=True,
    )
    member.joined_at = utcnow()

    session.add(member)
    await session.commit()

    # Return trip with member count
    response = TripResponse.model_validate(trip)
    response.member_count = 1

    # Get all members
    members_statement = select(TripMember).where(TripMember.trip_id == response.id)
    result = await session.execute(members_statement)
    members = result.scalars().all()

    response.members = await build_members_response(members, session)

    return response


@router.get("/", response_model=TripListResponse)
async def list_trips(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
) -> TripListResponse:
    """
    List all trips the current user is a member of.
    Returns trips ordered by most recently updated first.
    """
    # Get trip IDs where user is a member
    member_statement = select(TripMember.trip_id).where(
        TripMember.user_id == current_user.id
    )
    result = await session.execute(member_statement)
    trip_ids = result.scalars().all()

    if not trip_ids:
        return TripListResponse(trips=[], total=0, page=page, page_size=page_size)

    # Get trips with pagination
    statement = (
        select(Trip)
        .where(Trip.id.in_(trip_ids))
        .where(Trip.is_deleted == False)
        .order_by(Trip.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await session.execute(statement)
    trips = result.scalars().all()

    # Get total count
    count_statement = (
        select(func.count(Trip.id))
        .where(Trip.id.in_(trip_ids))
        .where(Trip.is_deleted == False)
    )
    result = await session.execute(count_statement)
    total = result.scalar_one()

    # Enhance trips with member counts and member details
    trip_responses = []
    for trip in trips:
        # Get all members for this trip
        members_statement = select(TripMember).where(TripMember.trip_id == trip.id)
        result = await session.execute(members_statement)
        members = result.scalars().all()

        trip_response = TripResponse.model_validate(trip)
        trip_response.member_count = len(members)
        trip_response.members = await build_members_response(members, session)
        trip_responses.append(trip_response)

    return TripListResponse(
        trips=trip_responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TripResponse:
    """
    Get details of a specific trip, including all members.
    User must be a member of the trip.
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
        TripMember.user_id == current_user.id,
    )
    result = await session.execute(member_statement)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this trip",
        )

    # Get all members
    members_statement = select(TripMember).where(TripMember.trip_id == trip_id)
    result = await session.execute(members_statement)
    members = result.scalars().all()

    # Build response with member details
    trip_response = TripResponse.model_validate(trip)
    trip_response.members = await build_members_response(members, session)
    trip_response.member_count = len(members)

    return trip_response


@router.put("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: int,
    trip_data: TripUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TripResponse:
    """
    Update trip details.
    Only trip admins can update trips.
    """
    # Get trip
    trip = await session.get(Trip, trip_id)
    if not trip or trip.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Check if user is an admin member
    member_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
        TripMember.is_admin == True,
    )
    result = await session.execute(member_statement)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trip admins can update trip details",
        )

    # Update fields
    update_data = trip_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trip, field, value)

    # Validate dates after update
    if trip.start_date and trip.end_date:
        if trip.end_date < trip.start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date cannot be before start date",
            )

    trip.updated_at = utcnow()

    session.add(trip)
    await session.commit()
    await session.refresh(trip)

    # Get member count
    member_count_statement = select(func.count(TripMember.id)).where(
        TripMember.trip_id == trip_id
    )
    result = await session.execute(member_count_statement)
    member_count = result.scalar_one()

    trip_response = TripResponse.model_validate(trip)
    trip_response.member_count = member_count

    return trip_response


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Soft delete a trip.
    Only trip admins can delete trips.
    """
    # Get trip
    trip = await session.get(Trip, trip_id)
    if not trip or trip.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Check if user is an admin member
    member_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
        TripMember.is_admin == True,
    )
    result = await session.execute(member_statement)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trip admins can delete trips",
        )

    # Soft delete
    trip.is_deleted = True
    trip.deleted_at = utcnow()

    session.add(trip)
    await session.commit()


@router.post("/{trip_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Leave a trip (remove yourself as a member).
    Any member can leave, but cannot leave if you're the last admin.
    This is a convenience endpoint that mirrors the one in members.py
    """
    # Check if trip exists
    trip = await session.get(Trip, trip_id)
    if not trip or trip.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Find current user's membership
    member_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    )
    result = await session.execute(member_statement)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of this trip",
        )

    # Check if this is the last admin
    if member.is_admin:
        admin_count_statement = select(TripMember).where(
            TripMember.trip_id == trip_id,
            TripMember.is_admin == True,
        )
        result = await session.execute(admin_count_statement)
        admin_count = len(result.scalars().all())

        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot leave as the last admin. Promote another member first.",
            )

    # Delete member
    await session.delete(member)
    await session.commit()
