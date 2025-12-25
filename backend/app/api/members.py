"""
Member API endpoints for trip member management
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.auth import get_current_user
from app.core.database import get_session
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.models.expense import Expense
from app.models.split import Split
from app.schemas.member import (
    MemberAdd,
    MemberUpdate,
    MemberResponse,
    InviteLinkResponse,
    MemberClaimRequest,
)
from app.services.avatar import get_avatar_for_member

router = APIRouter()


async def build_member_response(
    member: TripMember, session: AsyncSession
) -> MemberResponse:
    """
    Build a MemberResponse with user details if the member has a user_id.
    """
    response = MemberResponse(
        id=member.id,
        trip_id=member.trip_id,
        nickname=member.nickname,
        is_fictional=member.is_fictional,
        is_admin=member.is_admin,
        user_id=member.user_id,
        created_at=member.created_at.isoformat() if member.created_at else None,
        joined_at=member.joined_at.isoformat() if member.joined_at else None,
    )

    # Add user details if real member
    user_avatar_url = None
    if member.user_id:
        user = await session.get(User, member.user_id)
        if user:
            response.email = user.email
            response.display_name = user.display_name
            user_avatar_url = user.avatar_url

    # Get avatar (user's profile picture or generated)
    avatar_info = get_avatar_for_member(
        member_id=member.id, nickname=member.nickname, user_avatar_url=user_avatar_url
    )
    response.avatar_url = avatar_info["avatar_url"]

    return response


async def check_trip_access(
    trip_id: int, user: User, session: AsyncSession, require_admin: bool = False
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

    # Check admin requirement
    if require_admin and not member.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trip admins can perform this action",
        )

    return trip, member


@router.post(
    "/trips/{trip_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    trip_id: int,
    member_data: MemberAdd,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberResponse:
    """
    Add a member to a trip.
    Can add either a real user (by email) or a fictional member.
    Only trip admins can add members.
    """
    # Check admin access
    trip, _ = await check_trip_access(
        trip_id, current_user, session, require_admin=True
    )

    # If adding a real user, find them by email
    user_id = None
    if not member_data.is_fictional:
        user_statement = select(User).where(User.email == member_data.user_email)
        result = await session.execute(user_statement)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with email {member_data.user_email} not found",
            )

        user_id = user.id

        # Check if user is already a member
        existing_member_statement = select(TripMember).where(
            TripMember.trip_id == trip_id,
            TripMember.user_id == user_id,
        )
        result = await session.execute(existing_member_statement)
        existing_member = result.scalar_one_or_none()

        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this trip",
            )

    # Create member
    member = TripMember(
        trip_id=trip_id,
        user_id=user_id,
        nickname=member_data.nickname,
        is_fictional=member_data.is_fictional,
        is_admin=member_data.is_admin,
    )

    if not member_data.is_fictional:
        member.joined_at = datetime.utcnow()

    session.add(member)
    await session.commit()
    await session.refresh(member)

    # Build response
    return await build_member_response(member, session)


@router.get("/trips/{trip_id}/members", response_model=list[MemberResponse])
async def list_members(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[MemberResponse]:
    """
    List all members of a trip.
    User must be a member of the trip.
    """
    # Check access
    await check_trip_access(trip_id, current_user, session)

    # Get all members
    members_statement = select(TripMember).where(TripMember.trip_id == trip_id)
    result = await session.execute(members_statement)
    members = result.scalars().all()

    # Build responses
    responses = [await build_member_response(member, session) for member in members]
    return responses


@router.put("/trips/{trip_id}/members/{member_id}", response_model=MemberResponse)
async def update_member(
    trip_id: int,
    member_id: int,
    member_data: MemberUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberResponse:
    """
    Update a trip member.
    Only trip admins can update members.
    """
    # Check admin access
    await check_trip_access(trip_id, current_user, session, require_admin=True)

    # Get member
    member = await session.get(TripMember, member_id)
    if not member or member.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    # Update fields
    update_data = member_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    session.add(member)
    await session.commit()
    await session.refresh(member)

    # Build response
    return await build_member_response(member, session)


@router.delete(
    "/trips/{trip_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_member(
    trip_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Remove a member from a trip.
    Only trip admins can remove members.
    Cannot remove the last admin.
    """
    # Check admin access
    await check_trip_access(trip_id, current_user, session, require_admin=True)

    # Get member
    member = await session.get(TripMember, member_id)
    if not member or member.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
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
                detail="Cannot remove the last admin. Promote another member first.",
            )

    # Delete member
    await session.delete(member)
    await session.commit()


@router.post(
    "/trips/{trip_id}/members/{member_id}/claim", response_model=MemberResponse
)
async def claim_member(
    trip_id: int,
    member_id: int,
    claim_data: MemberClaimRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberResponse:
    """
    Claim a fictional member.
    Current user takes over the fictional member account.

    If the user already has a membership in this trip, their expenses and splits
    will be transferred to the claimed member, and their old membership will be deleted.
    """
    # Check if trip exists
    trip = await session.get(Trip, trip_id)
    if not trip or trip.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Get fictional member to claim
    fictional_member = await session.get(TripMember, member_id)
    if not fictional_member or fictional_member.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    # Check if member is fictional
    if not fictional_member.is_fictional:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only fictional members can be claimed",
        )

    # Check if current user already has a member in this trip
    existing_member_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    )
    result = await session.execute(existing_member_statement)
    existing_member = result.scalar_one_or_none()

    if existing_member:
        # User already has a membership - merge it into the fictional member

        # Transfer all expenses paid by existing member to fictional member
        expenses_statement = select(Expense).where(
            Expense.trip_id == trip_id,
            Expense.paid_by_member_id == existing_member.id,
        )
        result = await session.execute(expenses_statement)
        expenses = result.scalars().all()
        for expense in expenses:
            expense.paid_by_member_id = fictional_member.id
            session.add(expense)

        # Transfer all splits for existing member to fictional member
        splits_statement = select(Split).where(
            Split.member_id == existing_member.id,
        )
        result = await session.execute(splits_statement)
        splits = result.scalars().all()
        for split in splits:
            split.member_id = fictional_member.id
            session.add(split)

        # Preserve admin status if existing member was admin
        if existing_member.is_admin:
            fictional_member.is_admin = True

        # Delete the existing member
        await session.delete(existing_member)

    # Claim the fictional member
    fictional_member.user_id = current_user.id
    fictional_member.is_fictional = False
    fictional_member.joined_at = datetime.utcnow()

    session.add(fictional_member)
    await session.commit()
    await session.refresh(fictional_member)

    # Build response
    return await build_member_response(fictional_member, session)


@router.post("/trips/{trip_id}/invite", response_model=InviteLinkResponse)
async def generate_invite_link(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InviteLinkResponse:
    """
    Generate an invite link for a trip.
    Only trip admins can generate invite links.
    """
    # Check admin access
    trip, _ = await check_trip_access(
        trip_id, current_user, session, require_admin=True
    )

    # Generate invite code (simple implementation - use trip_id)
    # In production, you'd want to use a more secure token
    import hashlib
    import time

    invite_data = f"{trip_id}-{time.time()}"
    invite_code = hashlib.sha256(invite_data.encode()).hexdigest()[:16]

    # In a real app, you'd store this in a database with expiration
    # For now, we'll just return a simple response
    # The frontend URL should be configured
    frontend_url = "http://localhost:5173"  # Should come from config
    invite_url = f"{frontend_url}/join?trip={trip_id}&code={invite_code}"

    return InviteLinkResponse(
        invite_code=invite_code,
        invite_url=invite_url,
    )


@router.post("/trips/{trip_id}/join", response_model=MemberResponse)
async def join_trip_via_invite(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberResponse:
    """
    Join a trip via invite link.
    Adds the current user as a member if they're not already in the trip.
    """
    # Check if trip exists
    trip = await session.get(Trip, trip_id)
    if not trip or trip.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Check if user is already a member
    existing_member_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
    )
    result = await session.execute(existing_member_statement)
    existing_member = result.scalar_one_or_none()

    if existing_member:
        # User is already a member - return their membership
        return await build_member_response(existing_member, session)

    # Add user as a new member
    member = TripMember(
        trip_id=trip_id,
        user_id=current_user.id,
        nickname=current_user.display_name or current_user.email.split("@")[0],
        is_fictional=False,
        is_admin=False,
    )
    member.joined_at = datetime.utcnow()

    session.add(member)
    await session.commit()
    await session.refresh(member)

    # Build response
    return await build_member_response(member, session)
