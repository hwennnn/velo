"""
TripMember model for trip participants (real users or fictional)
"""

from datetime import datetime
from typing import Optional
from decimal import Decimal
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Numeric


class TripMember(SQLModel, table=True):
    """
    TripMember represents a participant in a trip.
    Can be a registered user (user_id is set) or fictional (user_id is None).
    Fictional members can later be claimed by real users.
    """

    __tablename__ = "trip_members"

    id: Optional[int] = Field(default=None, primary_key=True)
    trip_id: int = Field(
        foreign_key="trips.id", description="Trip this member belongs to"
    )

    # Nullable for fictional members
    user_id: Optional[str] = Field(
        default=None,
        foreign_key="users.id",
        description="Linked user (None for fictional members)",
    )

    nickname: str = Field(
        description="Display name for this trip (can differ from user.display_name)"
    )
    is_fictional: bool = Field(
        default=False, description="True if not linked to a real user"
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

    created_at: datetime = Field(default_factory=datetime.utcnow)
    joined_at: Optional[datetime] = Field(
        default=None, description="When a fictional member was claimed by a user"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "trip_id": 1,
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "nickname": "John",
                "is_fictional": False,
                "is_admin": True,
            }
        }
