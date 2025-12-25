"""
Member Debt model for tracking pairwise debts between trip members.
This provides efficient balance queries and multi-currency support.
"""

from datetime import datetime
from typing import Optional
from decimal import Decimal
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Numeric, Index, UniqueConstraint


class MemberDebt(SQLModel, table=True):
    """
    Tracks debt between two members in a specific currency.

    Example: If Alice paid 100 JPY for dinner and Bob owes 50 JPY,
    there would be a record:
    - debtor_member_id: Bob's member_id
    - creditor_member_id: Alice's member_id
    - amount: 50.00
    - currency: JPY

    When Bob pays Alice back 50 JPY, this record is deleted or amount set to 0.
    
    Note: There can only be ONE debt record per (trip, debtor, creditor, currency) tuple.
    This ensures debts are properly consolidated.
    """

    __tablename__ = "member_debts"
    
    __table_args__ = (
        Index("idx_member_debts_trip", "trip_id"),
        Index("idx_member_debts_debtor", "debtor_member_id"),
        Index("idx_member_debts_creditor", "creditor_member_id"),
        Index("idx_member_debts_trip_currency", "trip_id", "currency"),
        UniqueConstraint(
            "trip_id",
            "debtor_member_id",
            "creditor_member_id",
            "currency",
            name="uq_member_debts_trip_debtor_creditor_currency",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)

    trip_id: int = Field(
        foreign_key="trips.id", description="Trip this debt belongs to"
    )

    debtor_member_id: int = Field(
        foreign_key="trip_members.id", description="Member who owes money"
    )

    creditor_member_id: int = Field(
        foreign_key="trip_members.id", description="Member who is owed money"
    )

    amount: Decimal = Field(
        sa_column=Column(Numeric(12, 2)),
        description="Amount owed in the specified currency",
    )

    currency: str = Field(description="Currency code (ISO 4217)")

    # For audit trail
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Optional: track what created this debt
    source_expense_id: Optional[int] = Field(
        default=None,
        foreign_key="expenses.id",
        description="Expense that created this debt (if applicable)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "trip_id": 1,
                "debtor_member_id": 2,
                "creditor_member_id": 1,
                "amount": "50.00",
                "currency": "JPY",
            }
        }
