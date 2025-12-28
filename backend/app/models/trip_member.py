"""
TripMember model for trip participants (real users or placeholders)
"""

from datetime import datetime
from typing import Optional, Literal
from decimal import Decimal
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Numeric
from ..core.datetime_utils import utcnow


# Member status types
MemberStatus = Literal["active", "pending", "placeholder"]


class TripMember(SQLModel, table=True):
    """
    TripMember represents a participant in a trip.
    
    Status types:
    - 'active': Real user who has joined the trip
    - 'pending': Invited by email, waiting for user to join/sign up
    - 'placeholder': Nickname-only member (no email, no user account)
    """

    __tablename__ = "trip_members"

    id: Optional[int] = Field(default=None, primary_key=True)
    trip_id: int = Field(
        foreign_key="trips.id", description="Trip this member belongs to"
    )

    # Nullable for placeholder and pending members
    user_id: Optional[str] = Field(
        default=None,
        foreign_key="users.id",
        description="Linked user (None for placeholder/pending members)",
    )

    nickname: str = Field(
        description="Display name for this trip (can differ from user.display_name)"
    )
    
    # Member status: active, pending, or placeholder
    status: str = Field(
        default="active",
        description="Member status: 'active', 'pending', or 'placeholder'"
    )
    
    # For pending invitations
    invited_email: Optional[str] = Field(
        default=None,
        description="Email address for pending invitation"
    )
    invited_at: Optional[datetime] = Field(
        default=None,
        description="When the invitation was sent"
    )

    # Member role
    is_admin: bool = Field(default=False, description="Can manage trip settings")

    # Cached balance information (in base currency)
    total_owed_base: Decimal = Field(
        default=Decimal("0.0"),
        sa_column=Column(Numeric(12, 2)),
        description="Total amount owed by this member in base currency (cached)",
    )
    total_owed_to_base: Decimal = Field(
        default=Decimal("0.0"),
        sa_column=Column(Numeric(12, 2)),
        description="Total amount owed to this member in base currency (cached)",
    )

    created_at: datetime = Field(default_factory=utcnow)
    joined_at: Optional[datetime] = Field(
        default=None, description="When user joined the trip (for pending->active)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "trip_id": 1,
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "nickname": "John",
                "status": "active",
                "is_admin": True,
            }
        }
