"""
Member API endpoints for trip member management
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_
from sqlmodel import select

from app.core.auth import get_current_user
from app.core.database import get_session
from app.core.datetime_utils import utcnow, to_utc_isoformat
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_member import TripMember
from app.models.trip_invite import TripInvite
from app.models.expense import Expense
from app.models.split import Split
from app.models.member_debt import MemberDebt
from app.schemas.member import (
    MemberAdd,
    MemberUpdate,
    MemberResponse,
    InviteLinkResponse,
    InviteInfoResponse,
)
from app.core.config import settings

router = APIRouter()


async def build_members_response(
    members: list[TripMember], session: AsyncSession
) -> list[MemberResponse]:
    return [await build_member_response(m, session) for m in members]


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
        status=member.status,
        is_admin=member.is_admin,
        user_id=member.user_id,
        invited_email=member.invited_email,
        invited_at=to_utc_isoformat(member.invited_at),
        created_at=to_utc_isoformat(member.created_at),
        joined_at=to_utc_isoformat(member.joined_at),
        is_deleted=member.is_deleted,
    )

    # Add user details if active member with user_id
    if member.user_id:
        user = await session.get(User, member.user_id)
        if user:
            response.email = user.email
            response.display_name = user.display_name
            response.avatar_url = user.avatar_url

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
        TripMember.is_deleted == False,
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

    Status is auto-determined:
    - No email -> 'placeholder'
    - Email provided + user exists -> 'active'
    - Email provided + user doesn't exist -> 'pending'

    Only trip admins can add members.
    """
    # Check admin access
    trip, _ = await check_trip_access(
        trip_id, current_user, session, require_admin=True
    )

    user_id = None
    invited_email = None
    invited_at = None

    if member_data.email:
        # Check for soft-deleted member with same email - restore if found
        deleted_member_statement = select(TripMember).where(
            TripMember.trip_id == trip_id,
            TripMember.invited_email == member_data.email,
            TripMember.is_deleted == True,
        )
        result = await session.execute(deleted_member_statement)
        deleted_member = result.scalar_one_or_none()

        if deleted_member:
            # Restore the deleted member
            deleted_member.is_deleted = False
            deleted_member.deleted_at = None
            deleted_member.nickname = member_data.nickname
            deleted_member.is_admin = member_data.is_admin
            deleted_member.status = "pending"
            deleted_member.invited_at = utcnow()
            session.add(deleted_member)
            await session.commit()
            await session.refresh(deleted_member)
            return await build_member_response(deleted_member, session)

        # Check for duplicate email in this trip (non-deleted members)
        existing_email_statement = select(TripMember).where(
            TripMember.trip_id == trip_id,
            TripMember.is_deleted == False,
            or_(
                TripMember.invited_email == member_data.email,
                # Also check active members by user email
            ),
        )
        result = await session.execute(existing_email_statement)
        existing_with_email = result.scalar_one_or_none()

        if existing_with_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A member with this email already exists in this trip",
            )

        # Try to find existing user by email
        user_statement = select(User).where(User.email == member_data.email)
        result = await session.execute(user_statement)
        user = result.scalar_one_or_none()

        if user:
            # User exists - add them directly as active
            user_id = user.id
            member_status = "active"

            # Check if user is already a member
            existing_member_statement = select(TripMember).where(
                TripMember.trip_id == trip_id,
                TripMember.user_id == user_id,
                TripMember.is_deleted == False,
            )
            result = await session.execute(existing_member_statement)
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is already a member of this trip",
                )
        else:
            # User doesn't exist - create pending invitation
            member_status = "pending"
            invited_email = member_data.email
            invited_at = utcnow()
    else:
        # No email - placeholder
        member_status = "placeholder"

    # Create member
    member = TripMember(
        trip_id=trip_id,
        user_id=user_id,
        nickname=member_data.nickname,
        status=member_status,
        invited_email=invited_email,
        invited_at=invited_at,
        is_admin=member_data.is_admin,
    )

    if member_status == "active":
        member.joined_at = utcnow()

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

    # Get all non-deleted members
    members_statement = select(TripMember).where(
        TripMember.trip_id == trip_id, TripMember.is_deleted == False
    )
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

    Email can only be changed for pending/placeholder members.
    Changing email:
    - Updates invited_email and sets invited_at
    - Changes status from placeholder to pending
    - Removing email (empty string) changes pending to placeholder
    """
    # Check admin access
    await check_trip_access(trip_id, current_user, session, require_admin=True)

    # Get member
    member = await session.get(TripMember, member_id)
    if not member or member.trip_id != trip_id or member.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    # Handle email change (only for pending/placeholder members)
    if member_data.email is not None:
        if member.status == "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change email for active members",
            )

        if member_data.email:  # Non-empty email
            # Check for duplicate email in this trip
            existing_email_statement = select(TripMember).where(
                TripMember.trip_id == trip_id,
                TripMember.id != member_id,  # Exclude current member
                TripMember.invited_email == member_data.email,
            )
            result = await session.execute(existing_email_statement)
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A member with this email already exists in this trip",
                )

            # Update email and status
            member.invited_email = member_data.email
            member.status = "pending"
            if not member.invited_at:
                member.invited_at = utcnow()
        else:  # Empty email - remove it
            member.invited_email = None
            member.status = "placeholder"

    # Update other fields
    update_data = member_data.model_dump(exclude_unset=True, exclude={"email"})
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
    Remove a member from a trip (soft-delete).
    Only trip admins can remove members.
    Cannot remove the last admin.

    Soft-delete preserves the member record and nickname for historical expense data.
    """
    # Check admin access
    await check_trip_access(trip_id, current_user, session, require_admin=True)

    # Get member
    member = await session.get(TripMember, member_id)
    if not member or member.trip_id != trip_id or member.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    # Check if this is the last admin (only among non-deleted members)
    if member.is_admin:
        admin_count_statement = select(TripMember).where(
            TripMember.trip_id == trip_id,
            TripMember.is_admin == True,
            TripMember.is_deleted == False,
        )
        result = await session.execute(admin_count_statement)
        admin_count = len(result.scalars().all())

        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last admin. Promote another member first.",
            )

    # Check for unsettled debts (using balance calculation to net out debts)
    from app.services.debt import get_member_balances

    balances_data = await get_member_balances(trip_id, session, simplify=True)

    # Find this member's balance
    member_balance = next(
        (b for b in balances_data["member_balances"] if b["member_id"] == member_id),
        None,
    )

    if member_balance:
        # Check if they have any net balance (either owed or owing)
        net_balance = abs(member_balance["net_balance"])
        if net_balance > 0.01:  # Allow small floating point errors
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove member with unsettled debts. Settle all debts first.",
            )

    # Soft-delete member (preserve nickname for historical expenses)
    member.is_deleted = True
    member.deleted_at = utcnow()
    member.user_id = None  # Unlink from user account
    member.is_admin = False  # Remove admin privileges
    session.add(member)
    await session.commit()


@router.post("/trips/{trip_id}/invite", response_model=InviteLinkResponse)
async def generate_invite_link(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InviteLinkResponse:
    """
    Generate or retrieve an invite link for a trip.
    Only trip admins can generate invite links.

    - If an invite already exists for this trip, reuse it and extend expiration.
    - If no invite exists, create a new one.
    - Expiration is always set/extended to 7 days from now.
    """
    from datetime import timedelta
    import secrets

    # Check admin access
    trip, _ = await check_trip_access(
        trip_id, current_user, session, require_admin=True
    )

    # Check for existing invite for this trip
    existing_invite_statement = select(TripInvite).where(TripInvite.trip_id == trip_id)
    result = await session.execute(existing_invite_statement)
    invite = result.scalar_one_or_none()

    # Calculate new expiration: 7 days from now
    new_expiration = utcnow() + timedelta(days=7)

    if invite:
        # Reuse existing invite - just extend expiration
        invite.expires_at = new_expiration
        session.add(invite)
        await session.commit()
        await session.refresh(invite)
    else:
        # Create new invite
        invite_code = secrets.token_hex(8)  # 16 chars hex
        invite = TripInvite(
            trip_id=trip_id,
            code=invite_code,
            created_by=current_user.id,
            expires_at=new_expiration,
        )
        session.add(invite)
        await session.commit()
        await session.refresh(invite)

    # Return URL with just the code (no trip_id exposed)
    frontend_url = settings.frontend_url
    invite_url = f"{frontend_url}/join/{invite.code}"

    return InviteLinkResponse(
        invite_code=invite.code,
        invite_url=invite_url,
        expires_at=to_utc_isoformat(invite.expires_at) if invite.expires_at else None,
    )


@router.get("/invites/{code}", response_model=InviteInfoResponse)
async def decode_invite_link(
    code: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InviteInfoResponse:
    """
    Decode an invite link and return trip information.
    Returns trip details so the user can see what they're joining.
    """
    # Validate code format
    if len(code) != 16 or not all(c in "0123456789abcdef" for c in code.lower()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invite code format",
        )

    # Look up invite in database
    invite_statement = select(TripInvite).where(TripInvite.code == code)
    result = await session.execute(invite_statement)
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite code not found or has expired",
        )

    # Check if expired (if expires_at is set)
    if invite.expires_at and invite.expires_at < utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite link has expired",
        )

    # Get trip details
    trip = await session.get(Trip, invite.trip_id)
    if not trip or trip.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found or has been deleted",
        )

    # Get member count
    members_statement = select(TripMember).where(
        TripMember.trip_id == trip.id, TripMember.is_deleted == False
    )
    result = await session.execute(members_statement)
    members = result.scalars().all()
    member_count = len(members)

    # Check if current user is already a member
    is_already_member = any(m.user_id == current_user.id for m in members)

    return InviteInfoResponse(
        code=code,
        trip_id=trip.id,
        trip_name=trip.name,
        trip_description=trip.description,
        base_currency=trip.base_currency,
        start_date=to_utc_isoformat(trip.start_date) if trip.start_date else None,
        end_date=to_utc_isoformat(trip.end_date) if trip.end_date else None,
        member_count=member_count,
        is_already_member=is_already_member,
    )


@router.post("/invites/{code}/join", response_model=MemberResponse)
async def join_trip_via_invite(
    code: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberResponse:
    """
    Join a trip via invite code.

    If there's a pending invitation for this user's email, claims it.
    Otherwise, adds the user as a new member.
    """
    # Validate code format
    if len(code) != 16 or not all(c in "0123456789abcdef" for c in code.lower()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invite code format",
        )

    # Look up invite in database
    invite_statement = select(TripInvite).where(TripInvite.code == code)
    result = await session.execute(invite_statement)
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite code not found",
        )

    # Check if expired
    if invite.expires_at and invite.expires_at < utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite link has expired",
        )

    trip_id = invite.trip_id

    # Check if trip exists
    trip = await session.get(Trip, trip_id)
    if not trip or trip.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Check if user is already an active non-deleted member
    existing_member_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
        TripMember.status == "active",
        TripMember.is_deleted == False,
    )
    result = await session.execute(existing_member_statement)
    existing_member = result.scalar_one_or_none()

    if existing_member:
        # User is already a member - return their membership
        return await build_member_response(existing_member, session)

    # Check for soft-deleted member with same user_id - restore if found
    deleted_by_user_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
        TripMember.is_deleted == True,
    )
    result = await session.execute(deleted_by_user_statement)
    deleted_member = result.scalar_one_or_none()

    if deleted_member:
        # Restore the deleted member
        deleted_member.is_deleted = False
        deleted_member.deleted_at = None
        deleted_member.user_id = current_user.id
        deleted_member.status = "active"
        deleted_member.joined_at = utcnow()
        session.add(deleted_member)
        await session.commit()
        await session.refresh(deleted_member)
        return await build_member_response(deleted_member, session)

    # Check for pending or placeholder invitation with user's email (non-deleted)
    # This allows both pending invites AND placeholders with email to be claimed
    invitation_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.invited_email == current_user.email,
        TripMember.status.in_(["pending", "placeholder"]),
        TripMember.is_deleted == False,
    )
    result = await session.execute(invitation_statement)
    invited_member = result.scalar_one_or_none()

    if invited_member:
        # Claim the invitation/placeholder
        invited_member.user_id = current_user.id
        invited_member.status = "active"
        invited_member.joined_at = utcnow()
        session.add(invited_member)
        await session.commit()
        await session.refresh(invited_member)
        return await build_member_response(invited_member, session)

    # Check for soft-deleted member with same email - restore if found
    deleted_by_email_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.invited_email == current_user.email,
        TripMember.is_deleted == True,
    )
    result = await session.execute(deleted_by_email_statement)
    deleted_member = result.scalar_one_or_none()

    if deleted_member:
        # Restore the deleted member
        deleted_member.is_deleted = False
        deleted_member.deleted_at = None
        deleted_member.user_id = current_user.id
        deleted_member.status = "active"
        deleted_member.joined_at = utcnow()
        session.add(deleted_member)
        await session.commit()
        await session.refresh(deleted_member)
        return await build_member_response(deleted_member, session)

    # No pending invitation - add user as a new member
    member = TripMember(
        trip_id=trip_id,
        user_id=current_user.id,
        nickname=current_user.display_name or current_user.email.split("@")[0],
        status="active",
        is_admin=False,
    )
    member.joined_at = utcnow()

    session.add(member)
    await session.commit()
    await session.refresh(member)

    # Build response
    return await build_member_response(member, session)
