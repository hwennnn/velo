"""
Balance calculation service for trip settlements.
Calculates member balances and optimal settlements with multi-currency support.
"""

from decimal import Decimal
from typing import Dict, List, Tuple
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.models.expense import Expense
from app.models.split import Split
from app.models.trip_member import TripMember


class Balance:
    """Represents a member's balance"""

    def __init__(self, member_id: int, member_nickname: str):
        self.member_id = member_id
        self.member_nickname = member_nickname
        self.total_paid = Decimal("0.0")
        self.total_owed = Decimal("0.0")
        self.net_balance = Decimal("0.0")
        # Multi-currency tracking
        self.currency_balances: Dict[str, Decimal] = defaultdict(lambda: Decimal("0.0"))

    def to_dict(self):
        return {
            "member_id": self.member_id,
            "member_nickname": self.member_nickname,
            "total_paid": float(self.total_paid),
            "total_owed": float(self.total_owed),
            "net_balance": float(self.net_balance),
            "currency_balances": {
                currency: float(amount)
                for currency, amount in self.currency_balances.items()
                if abs(amount) > 0.01  # Only include non-zero balances
            },
        }


class Settlement:
    """Represents a payment that needs to be made"""

    def __init__(
        self,
        from_member_id: int,
        to_member_id: int,
        amount: Decimal,
        currency: str = "",
        from_nickname: str = "",
        to_nickname: str = "",
    ):
        self.from_member_id = from_member_id
        self.to_member_id = to_member_id
        self.amount = amount
        self.currency = currency
        self.from_nickname = from_nickname
        self.to_nickname = to_nickname

    def to_dict(self):
        return {
            "from_member_id": self.from_member_id,
            "to_member_id": self.to_member_id,
            "amount": float(self.amount),
            "currency": self.currency,
            "from_nickname": self.from_nickname,
            "to_nickname": self.to_nickname,
        }


async def get_member_balance_details(
    trip_id: int, member_id: int, session: AsyncSession
) -> Dict:
    """
    Get detailed balance information for a specific member.
    Shows all expenses they paid and all expenses they owe.
    """
    # Get member
    member = await session.get(TripMember, member_id)
    if not member or member.trip_id != trip_id:
        return {}

    # Get expenses paid by this member
    paid_statement = (
        select(Expense)
        .where(Expense.trip_id == trip_id)
        .where(Expense.paid_by_member_id == member_id)
    )
    result = await session.execute(paid_statement)
    paid_expenses = result.scalars().all()

    total_paid = sum(
        expense.amount * expense.exchange_rate_to_base for expense in paid_expenses
    )

    # Get splits for this member
    splits_statement = (
        select(Split, Expense)
        .join(Expense, Split.expense_id == Expense.id)
        .where(Split.member_id == member_id)
        .where(Expense.trip_id == trip_id)
    )
    result = await session.execute(splits_statement)
    splits_with_expenses = result.all()

    total_owed = sum(split.amount for split, _ in splits_with_expenses)

    return {
        "member_id": member_id,
        "member_nickname": member.nickname,
        "total_paid": float(total_paid),
        "total_owed": float(total_owed),
        "net_balance": float(total_paid - total_owed),
        "expenses_paid": [
            {
                "id": expense.id,
                "description": expense.description,
                "amount": float(expense.amount * expense.exchange_rate_to_base),
            }
            for expense in paid_expenses
        ],
        "expenses_owed": [
            {
                "id": expense.id,
                "description": expense.description,
                "amount": float(split.amount),
            }
            for split, expense in splits_with_expenses
        ],
    }
