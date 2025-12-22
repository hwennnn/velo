"""
Expense model for tracking trip expenses
"""
from datetime import datetime, date
from typing import Optional
from decimal import Decimal
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Numeric


class Expense(SQLModel, table=True):
    """
    Expense represents a single expense entry in a trip.
    Stores original currency and exchange rate for accurate conversion.
    """
    __tablename__ = "expenses"

    id: Optional[int] = Field(default=None, primary_key=True)
    trip_id: int = Field(foreign_key="trips.id",
                         description="Trip this expense belongs to")

    description: str = Field(description="Expense description")
    amount: Decimal = Field(
        sa_column=Column(Numeric(12, 2)),
        description="Expense amount in original currency"
    )
    currency: str = Field(
        default="USD", description="Currency code (ISO 4217)")

    # Exchange rate at time of entry
    exchange_rate_to_base: Decimal = Field(
        default=Decimal("1.0"),
        sa_column=Column(Numeric(12, 6)),
        description="Exchange rate to trip base currency"
    )

    # Who paid
    paid_by_member_id: int = Field(
        foreign_key="trip_members.id",
        description="Trip member who paid this expense"
    )

    expense_date: date = Field(description="Date the expense occurred")

    # Metadata
    category: Optional[str] = Field(
        default=None, description="Expense category (food, transport, etc)")
    notes: Optional[str] = Field(default=None, description="Additional notes")
    receipt_url: Optional[str] = Field(
        default=None, description="Receipt image URL")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    created_by: str = Field(foreign_key="users.id",
                            description="User who created this expense")

    class Config:
        json_schema_extra = {
            "example": {
                "trip_id": 1,
                "description": "Dinner at sushi restaurant",
                "amount": "85.50",
                "currency": "USD",
                "exchange_rate_to_base": "1.0",
                "paid_by_member_id": 1,
                "expense_date": "2024-03-16",
                "category": "food",
            }
        }
