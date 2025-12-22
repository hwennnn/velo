"""
Split model for expense distribution among trip members
"""
from typing import Optional
from decimal import Decimal
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Numeric


class Split(SQLModel, table=True):
    """
    Split represents how an expense is divided among trip members.
    Each split record indicates what portion a member owes.
    """
    __tablename__ = "splits"

    id: Optional[int] = Field(default=None, primary_key=True)
    expense_id: int = Field(foreign_key="expenses.id",
                            description="Expense this split belongs to")
    member_id: int = Field(foreign_key="trip_members.id",
                           description="Member who owes this split")

    # Amount owed in base currency
    amount: Decimal = Field(
        sa_column=Column(Numeric(12, 2)),
        description="Amount owed by this member (in trip base currency)"
    )

    # Optional: for percentage or custom splits
    percentage: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(5, 2), nullable=True),
        description="Percentage of expense (0-100)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "expense_id": 1,
                "member_id": 2,
                "amount": "28.50",
                "percentage": "33.33",
            }
        }
