"""
Trip model for managing travel expense groups
"""

from datetime import datetime, date
from typing import Optional
from decimal import Decimal
from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import Numeric
from pydantic import model_validator
from ..core.currencies import DEFAULT_CURRENCY
from ..core.datetime_utils import utcnow


class Trip(SQLModel, table=True):
    """
    Trip represents a travel expense group.
    All expenses are converted to base_currency for settlement calculations.
    """

    __tablename__ = "trips"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(description="Trip name or destination")
    description: Optional[str] = Field(default=None, description="Trip description")
    base_currency: str = Field(
        default=DEFAULT_CURRENCY, description="Base currency code (ISO 4217)"
    )

    # Balance calculation preferences
    simplify_debts: bool = Field(
        default=False,
        description="If true, balances endpoint returns simplified debts to minimize transactions",
    )

    start_date: Optional[date] = Field(default=None, description="Trip start date")
    end_date: Optional[date] = Field(default=None, description="Trip end date")

    # Cached metadata for performance
    total_spent: Decimal = Field(
        default=Decimal("0.0"),
        sa_column=Column(Numeric(12, 2)),
        description="Total amount spent in base currency (cached)",
    )
    expense_count: int = Field(
        default=0, description="Number of expenses in this trip (cached)"
    )

    created_by: str = Field(
        foreign_key="users.id", description="User who created the trip"
    )
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    is_deleted: bool = Field(default=False, description="Soft delete flag")
    deleted_at: Optional[datetime] = Field(
        default=None, description="Soft delete timestamp"
    )

    @model_validator(mode="after")
    def validate_trip(self):
        """Validate trip data"""
        # Validate dates
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("End date cannot be before start date")

        # Validate name is not just whitespace
        if self.name and not self.name.strip():
            raise ValueError("Trip name cannot be empty or just whitespace")

        # Validate currency is uppercase
        if self.base_currency:
            self.base_currency = self.base_currency.upper()

        return self

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Tokyo Adventure 2024",
                "description": "Spring vacation in Japan",
                "base_currency": "SGD",
                "start_date": "2024-03-15",
                "end_date": "2024-03-25",
            }
        }
