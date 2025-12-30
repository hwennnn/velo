"""
Member API endpoints for trip member management
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
    ClaimableMember,
    JoinTripRequest,
    GenerateInviteRequest,
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
        # Check for duplicate email in this trip (active, pending, or placeholder with email)
        existing_email_statement = select(TripMember).where(
            TripMember.trip_id == trip_id,
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
    if not member or member.trip_id != trip_id:
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
    Remove a member from a trip.
    Only trip admins can remove members.
    Cannot remove the last admin.
    Cannot remove a member with unsettled debts.
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
            TripMember.status == "active",
        )
        result = await session.execute(admin_count_statement)
        admin_count = len(result.scalars().all())

        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last admin. Promote another member first.",
            )

    # Check for debts
    debt_statement = select(MemberDebt).where(
        or_(
            MemberDebt.debtor_member_id == member_id,
            MemberDebt.creditor_member_id == member_id,
        ),
    )
    result = await session.execute(debt_statement)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove member with any debts. This member owes or is owed money.",
        )

    # Delete member
    await session.delete(member)
    await session.commit()


@router.post("/trips/{trip_id}/invite", response_model=InviteLinkResponse)
async def generate_invite_link(
    trip_id: int,
    request: Optional[GenerateInviteRequest] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InviteLinkResponse:
    """
    Generate or retrieve an invite link for a trip.
    Only trip admins can generate invite links.

    - If an invite already exists for this trip, reuse it and extend expiration.
    - If no invite exists, create a new one.
    - Expiration is always set/extended to 7 days from now.
    - allow_claim controls whether joiners can claim existing members.
    """
    from datetime import timedelta
    import secrets

    # Get allow_claim from request, default to True
    allow_claim = request.allow_claim if request else True

    # Check admin access
    trip, _ = await check_trip_access(
        trip_id, current_user, session, require_admin=True
    )

    # Check for existing invite for this trip with matching allow_claim
    existing_invite_statement = select(TripInvite).where(
        TripInvite.trip_id == trip_id,
        TripInvite.allow_claim == allow_claim,
    )
    result = await session.execute(existing_invite_statement)
    invite = result.scalar_one_or_none()

    # Calculate new expiration: 7 days from now
    new_expiration = utcnow() + timedelta(days=7)

    if invite:
        # Reuse existing invite with matching allow_claim - just extend expiration
        invite.expires_at = new_expiration
        session.add(invite)
        await session.commit()
        await session.refresh(invite)
    else:
        # Create new invite (no existing invite OR allow_claim differs)
        invite_code = secrets.token_hex(8)  # 16 chars hex
        invite = TripInvite(
            trip_id=trip_id,
            code=invite_code,
            created_by=current_user.id,
            expires_at=new_expiration,
            allow_claim=allow_claim,
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
        allow_claim=invite.allow_claim,
    )


@router.get("/invites/{code}", response_model=InviteInfoResponse)
async def decode_invite_link(
    code: str,
    claim: Optional[int] = Query(
        None, description="Member ID to pre-select for claiming"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InviteInfoResponse:
    """
    Decode an invite link and return trip information.
    Returns trip details so the user can see what they're joining.

    If ?claim=<member_id> is provided, validates and returns that member
    as the pre-selected claim target (for personalized invite links).
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

    # Get all members
    members_statement = select(TripMember).where(TripMember.trip_id == trip.id)
    result = await session.execute(members_statement)
    members = result.scalars().all()
    member_count = len(members)

    # Check if current user is already a member
    is_already_member = any(m.user_id == current_user.id for m in members)

    # Build list of claimable members (only if allow_claim is True for this invite)
    claimable_members = []
    if invite.allow_claim:
        claimable_members = [
            ClaimableMember(
                id=m.id,
                nickname=m.nickname,
                status=m.status,
                invited_email=m.invited_email,
            )
            for m in members
            if m.status in ["pending", "placeholder"] and m.user_id is None
        ]

    # Validate claim parameter if provided (only valid if allow_claim is True)
    validated_claim_id = None
    if claim is not None and invite.allow_claim:
        # Check if the claim ID is valid (exists in claimable members)
        if any(cm.id == claim for cm in claimable_members):
            validated_claim_id = claim
        # If invalid claim ID, just ignore it (don't error)

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
        allow_claim=invite.allow_claim,
        claimable_members=claimable_members,
        claim_member_id=validated_claim_id,
    )


@router.post("/invites/{code}/join", response_model=MemberResponse)
async def join_trip_via_invite(
    code: str,
    request: Optional[JoinTripRequest] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MemberResponse:
    """
    Join a trip via invite code.

    If claim_member_id is provided, claims that specific placeholder/pending member.
    Else if there's a pending invitation for this user's email, claims it.
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

    # Check if user is already an active member
    existing_member_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == current_user.id,
        TripMember.status == "active",
    )
    result = await session.execute(existing_member_statement)
    existing_member = result.scalar_one_or_none()

    if existing_member:
        # User is already a member - return their membership
        return await build_member_response(existing_member, session)

    # If claim_member_id is provided, try to claim that specific member
    # (Only allowed if invite.allow_claim is True)
    claim_member_id = request.claim_member_id if request else None
    if claim_member_id:
        if not invite.allow_claim:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invite link does not allow claiming existing members. Please join as a new member.",
            )
        claim_member = await session.get(TripMember, claim_member_id)
        if (
            claim_member
            and claim_member.trip_id == trip_id
            and claim_member.status in ["pending", "placeholder"]
            and claim_member.user_id is None
        ):
            # Claim this specific member
            claim_member.user_id = current_user.id
            claim_member.status = "active"
            claim_member.joined_at = utcnow()
            session.add(claim_member)
            await session.commit()
            await session.refresh(claim_member)
            return await build_member_response(claim_member, session)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot claim this member. They may already be claimed or don't exist.",
            )

    # Check for pending or placeholder invitation with user's email
    # This allows both pending invites AND placeholders with email to be claimed
    invitation_statement = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.invited_email == current_user.email,
        TripMember.status.in_(["pending", "placeholder"]),
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


@router.post(
    "/trips/{trip_id}/members/{member_id}/invite", response_model=InviteLinkResponse
)
async def generate_member_invite_link(
    trip_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InviteLinkResponse:
    """
    Generate a personalized invite link for a specific placeholder/pending member.
    When clicked, the link will auto-claim that member slot.
    Only trip admins can generate personalized invite links.
    """
    from datetime import timedelta
    import secrets

    # Check admin access
    trip, _ = await check_trip_access(
        trip_id, current_user, session, require_admin=True
    )

    # Verify the member exists and is claimable
    member = await session.get(TripMember, member_id)
    if not member or member.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    if member.status not in ["pending", "placeholder"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only generate invite links for pending or placeholder members",
        )

    if member.user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This member slot has already been claimed",
        )

    # Get or create trip invite
    existing_invite_statement = select(TripInvite).where(
        TripInvite.trip_id == trip_id, TripInvite.allow_claim == True
    )
    result = await session.execute(existing_invite_statement)
    invite = result.scalar_one_or_none()

    new_expiration = utcnow() + timedelta(days=7)

    if invite:
        invite.expires_at = new_expiration
        session.add(invite)
        await session.commit()
        await session.refresh(invite)
    else:
        invite_code = secrets.token_hex(8)
        invite = TripInvite(
            trip_id=trip_id,
            code=invite_code,
            created_by=current_user.id,
            expires_at=new_expiration,
        )
        session.add(invite)
        await session.commit()
        await session.refresh(invite)

    # Build personalized URL with claim parameter
    frontend_url = settings.frontend_url
    invite_url = f"{frontend_url}/join/{invite.code}?claim={member_id}"

    return InviteLinkResponse(
        invite_code=invite.code,
        invite_url=invite_url,
        expires_at=to_utc_isoformat(invite.expires_at) if invite.expires_at else None,
    )
