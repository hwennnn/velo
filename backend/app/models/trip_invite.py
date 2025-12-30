"""
TripInvite model for storing trip invitation codes
"""

from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
from ..core.datetime_utils import utcnow


class TripInvite(SQLModel, table=True):
    """
    TripInvite stores invite codes for trips.

    Each invite code is a unique 16-character hex string that maps
    to a specific trip, allowing users to join without exposing the trip ID.
    """

    __tablename__ = "trip_invites"

    id: Optional[int] = Field(default=None, primary_key=True)
    trip_id: int = Field(
        foreign_key="trips.id", description="Trip this invite is for", index=True
    )
    code: str = Field(
        unique=True,
        index=True,
        min_length=16,
        max_length=16,
        description="Unique 16-char hex invite code",
    )
    created_by: str = Field(
        foreign_key="users.id", description="User who created this invite"
    )
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: Optional[datetime] = Field(
        default=None, description="Optional expiration timestamp"
    )
    allow_claim: bool = Field(
        default=True,
        description="If True, joiners can claim existing placeholder/pending members. If False, must join as new member.",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "trip_id": 1,
                "code": "a1b2c3d4e5f6g7h8",
                "created_by": "550e8400-e29b-41d4-a716-446655440000",
            }
        }
