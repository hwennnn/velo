"""
Pydantic schemas for Trip API endpoints
"""

from datetime import date, datetime
from typing import Optional
from decimal import Decimal
from datetime import date, datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator, field_serializer
from ..core.currencies import is_supported_currency, DEFAULT_CURRENCY
from ..core.datetime_utils import to_utc_isoformat


class TripCreate(BaseModel):
    """Schema for creating a new trip"""

    name: str = Field(..., min_length=1, max_length=200, description="Trip name")
    description: Optional[str] = Field(
        None, max_length=1000, description="Trip description"
    )
    base_currency: str = Field(
        default=DEFAULT_CURRENCY,
        min_length=3,
        max_length=3,
        description="ISO 4217 currency code",
    )
    start_date: Optional[date] = Field(None, description="Trip start date")
    end_date: Optional[date] = Field(None, description="Trip end date")
    simplify_debts: bool = Field(
        default=False,
        description="If true, balances endpoint returns simplified debts to minimize transactions",
    )

    @model_validator(mode="after")
    def validate_trip_data(self):
        """Validate trip data"""
        # Validate dates
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("End date cannot be before start date")

        # Validate and clean name
        if self.name:
            self.name = self.name.strip()
            if not self.name:
                raise ValueError("Trip name cannot be empty or just whitespace")

        # Validate and uppercase currency
        if self.base_currency:
            self.base_currency = self.base_currency.upper().strip()
            if len(self.base_currency) != 3:
                raise ValueError(
                    "Currency code must be exactly 3 characters (ISO 4217)"
                )
            if not self.base_currency.isalpha():
                raise ValueError("Currency code must contain only letters")
            if not is_supported_currency(self.base_currency):
                raise ValueError(f"Currency {self.base_currency} is not supported")

        # Clean description
        if self.description:
            self.description = self.description.strip()
            if not self.description:
                self.description = None

        return self

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Tokyo Adventure 2024",
                "description": "Spring vacation in Japan",
                "base_currency": "USD",
                "start_date": "2024-03-15",
                "end_date": "2024-03-25",
            }
        }


class TripUpdate(BaseModel):
    """Schema for updating a trip"""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    base_currency: Optional[str] = Field(None, min_length=3, max_length=3)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    simplify_debts: Optional[bool] = None

    @model_validator(mode="after")
    def validate_trip_data(self):
        """Validate trip update data"""
        # Validate and clean name
        if self.name is not None:
            self.name = self.name.strip()
            if not self.name:
                raise ValueError("Trip name cannot be empty or just whitespace")

        # Validate and uppercase currency
        if self.base_currency is not None:
            self.base_currency = self.base_currency.upper().strip()
            if len(self.base_currency) != 3:
                raise ValueError(
                    "Currency code must be exactly 3 characters (ISO 4217)"
                )
            if not self.base_currency.isalpha():
                raise ValueError("Currency code must contain only letters")
            if not is_supported_currency(self.base_currency):
                raise ValueError(f"Currency {self.base_currency} is not supported")

        # Clean description
        if self.description is not None:
            self.description = self.description.strip()
            if not self.description:
                self.description = None

        # Note: For updates, we can't validate dates here since we might only have one
        # The API route will need to handle date validation with existing data

        return self


class TripMemberResponse(BaseModel):
    """Schema for trip member in responses"""

    id: int
    nickname: str
    status: str  # 'active', 'pending', 'placeholder'
    is_admin: bool
    user_id: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    invited_email: Optional[str] = None
    invited_at: Optional[str] = None
    created_at: Optional[str] = None
    joined_at: Optional[str] = None


class TripResponse(BaseModel):
    """Schema for trip in responses"""

    id: int
    name: str
    description: Optional[str]
    base_currency: str
    simplify_debts: bool = False
    start_date: Optional[date]
    end_date: Optional[date]
    created_by: str
    created_at: datetime
    updated_at: datetime

    # Cached metadata
    total_spent: Decimal = Field(
        default=Decimal("0.0"), description="Total spent in base currency"
    )
    expense_count: int = Field(default=0, description="Number of expenses")

    # Optional: include member count or members list
    member_count: Optional[int] = None
    members: Optional[list[TripMemberResponse]] = None

    class Config:
        from_attributes = True

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: datetime, _info):
        return to_utc_isoformat(dt)


class TripListResponse(BaseModel):
    """Schema for trip list response"""

    trips: list[TripResponse]
    total: int
    page: int = 1
    page_size: int = 20
