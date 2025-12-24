"""
Member API endpoints for trip member management
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

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

router = APIRouter()


def check_trip_access(
    trip_id: int,
    user: User,
    session: Session,
    require_admin: bool = False
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

    # Check admin requirement
    if require_admin and not member.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trip admins can perform this action",
        )

    return trip, member


@router.post("/trips/{trip_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    trip_id: int,
    member_data: MemberAdd,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MemberResponse:
    """
    Add a member to a trip.
    Can add either a real user (by email) or a fictional member.
    Only trip admins can add members.
    """
    # Check admin access
    trip, _ = check_trip_access(
        trip_id, current_user, session, require_admin=True)

    # If adding a real user, find them by email
    user_id = None
    if not member_data.is_fictional:
        user_statement = select(User).where(
            User.email == member_data.user_email)
        user = session.exec(user_statement).first()

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
        existing_member = session.exec(existing_member_statement).first()

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
    session.commit()
    session.refresh(member)

    # Build response
    response = MemberResponse(
        id=member.id,
        trip_id=member.trip_id,
        nickname=member.nickname,
        is_fictional=member.is_fictional,
        is_admin=member.is_admin,
        user_id=member.user_id,
    )

    # Add user details if real member
    if member.user_id:
        user = session.get(User, member.user_id)
        if user:
            response.email = user.email
            response.avatar_url = user.avatar_url

    return response


@router.get("/trips/{trip_id}/members", response_model=list[MemberResponse])
async def list_members(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[MemberResponse]:
    """
    List all members of a trip.
    User must be a member of the trip.
    """
    # Check access
    check_trip_access(trip_id, current_user, session)

    # Get all members
    members_statement = select(TripMember).where(TripMember.trip_id == trip_id)
    members = session.exec(members_statement).all()

    # Build responses
    responses = []
    for member in members:
        response = MemberResponse(
            id=member.id,
            trip_id=member.trip_id,
            nickname=member.nickname,
            is_fictional=member.is_fictional,
            is_admin=member.is_admin,
            user_id=member.user_id,
        )

        # Add user details if real member
        if member.user_id:
            user = session.get(User, member.user_id)
            if user:
                response.email = user.email
                response.avatar_url = user.avatar_url

        responses.append(response)

    return responses


@router.put("/trips/{trip_id}/members/{member_id}", response_model=MemberResponse)
async def update_member(
    trip_id: int,
    member_id: int,
    member_data: MemberUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MemberResponse:
    """
    Update a trip member.
    Only trip admins can update members.
    """
    # Check admin access
    check_trip_access(trip_id, current_user, session, require_admin=True)

    # Get member
    member = session.get(TripMember, member_id)
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
    session.commit()
    session.refresh(member)

    # Build response
    response = MemberResponse(
        id=member.id,
        trip_id=member.trip_id,
        nickname=member.nickname,
        is_fictional=member.is_fictional,
        is_admin=member.is_admin,
        user_id=member.user_id,
    )

    # Add user details if real member
    if member.user_id:
        user = session.get(User, member.user_id)
        if user:
            response.email = user.email
            response.avatar_url = user.avatar_url

    return response


@router.delete("/trips/{trip_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    trip_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """
    Remove a member from a trip.
    Only trip admins can remove members.
    Cannot remove the last admin.
    """
    # Check admin access
    check_trip_access(trip_id, current_user, session, require_admin=True)

    # Get member
    member = session.get(TripMember, member_id)
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
        admin_count = len(session.exec(admin_count_statement).all())

        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last admin. Promote another member first.",
            )

    # Delete member
    session.delete(member)
    session.commit()


@router.post("/trips/{trip_id}/members/{member_id}/claim", response_model=MemberResponse)
async def claim_member(
    trip_id: int,
    member_id: int,
    claim_data: MemberClaimRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MemberResponse:
    """
    Claim a fictional member.
    Current user takes over the fictional member account.

    If the user already has a membership in this trip, their expenses and splits
    will be transferred to the claimed member, and their old membership will be deleted.
    """
    # Check if trip exists
    trip = session.get(Trip, trip_id)
    if not trip or trip.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Get fictional member to claim
    fictional_member = session.get(TripMember, member_id)
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
    existing_member = session.exec(existing_member_statement).first()

    if existing_member:
        # User already has a membership - merge it into the fictional member

        # Transfer all expenses paid by existing member to fictional member
        expenses_statement = select(Expense).where(
            Expense.trip_id == trip_id,
            Expense.paid_by_member_id == existing_member.id,
        )
        expenses = session.exec(expenses_statement).all()
        for expense in expenses:
            expense.paid_by_member_id = fictional_member.id
            session.add(expense)

        # Transfer all splits for existing member to fictional member
        splits_statement = select(Split).where(
            Split.member_id == existing_member.id,
        )
        splits = session.exec(splits_statement).all()
        for split in splits:
            split.member_id = fictional_member.id
            session.add(split)

        # Preserve admin status if existing member was admin
        if existing_member.is_admin:
            fictional_member.is_admin = True

        # Delete the existing member
        session.delete(existing_member)

    # Claim the fictional member
    fictional_member.user_id = current_user.id
    fictional_member.is_fictional = False
    fictional_member.joined_at = datetime.utcnow()

    session.add(fictional_member)
    session.commit()
    session.refresh(fictional_member)

    # Build response
    response = MemberResponse(
        id=fictional_member.id,
        trip_id=fictional_member.trip_id,
        nickname=fictional_member.nickname,
        is_fictional=fictional_member.is_fictional,
        is_admin=fictional_member.is_admin,
        user_id=fictional_member.user_id,
        email=current_user.email,
        avatar_url=current_user.avatar_url,
    )

    return response


@router.post("/trips/{trip_id}/invite", response_model=InviteLinkResponse)
async def generate_invite_link(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> InviteLinkResponse:
    """
    Generate an invite link for a trip.
    Only trip admins can generate invite links.
    """
    # Check admin access
    trip, _ = check_trip_access(
        trip_id, current_user, session, require_admin=True)

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


@router.post("/trips/{trip_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """
    Leave a trip (remove yourself as a member).
    Any member can leave, but cannot leave if you're the last admin.
    """
    # Check if trip exists
    trip = session.get(Trip, trip_id)
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
    member = session.exec(member_statement).first()

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
        admin_count = len(session.exec(admin_count_statement).all())

        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot leave as the last admin. Promote another member first.",
            )

    # Delete member
    session.delete(member)
    session.commit()


@router.post("/trips/{trip_id}/join", response_model=MemberResponse)
async def join_trip_via_invite(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MemberResponse:
    """
    Join a trip via invite link.
    Adds the current user as a member if they're not already in the trip.
    """
    # Check if trip exists
    trip = session.get(Trip, trip_id)
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
    existing_member = session.exec(existing_member_statement).first()

    if existing_member:
        # User is already a member - return their membership
        response = MemberResponse(
            id=existing_member.id,
            trip_id=existing_member.trip_id,
            nickname=existing_member.nickname,
            is_fictional=existing_member.is_fictional,
            is_admin=existing_member.is_admin,
            user_id=existing_member.user_id,
            email=current_user.email,
            avatar_url=current_user.avatar_url,
        )
        return response

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
    session.commit()
    session.refresh(member)

    # Build response
    response = MemberResponse(
        id=member.id,
        trip_id=member.trip_id,
        nickname=member.nickname,
        is_fictional=member.is_fictional,
        is_admin=member.is_admin,
        user_id=member.user_id,
        email=current_user.email,
        avatar_url=current_user.avatar_url,
    )

    return response
