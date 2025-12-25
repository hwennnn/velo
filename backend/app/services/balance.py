"""
Balance calculation service for trip settlements.
Calculates member balances and optimal settlements.
"""

from decimal import Decimal
from typing import Dict, List, Tuple
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

    def to_dict(self):
        return {
            "member_id": self.member_id,
            "member_nickname": self.member_nickname,
            "total_paid": float(self.total_paid),
            "total_owed": float(self.total_owed),
            "net_balance": float(self.net_balance),
        }


class Settlement:
    """Represents a payment that needs to be made"""

    def __init__(
        self,
        from_member_id: int,
        to_member_id: int,
        amount: Decimal,
        from_nickname: str = "",
        to_nickname: str = "",
    ):
        self.from_member_id = from_member_id
        self.to_member_id = to_member_id
        self.amount = amount
        self.from_nickname = from_nickname
        self.to_nickname = to_nickname

    def to_dict(self):
        return {
            "from_member_id": self.from_member_id,
            "to_member_id": self.to_member_id,
            "amount": float(self.amount),
            "from_nickname": self.from_nickname,
            "to_nickname": self.to_nickname,
        }


async def calculate_balances(trip_id: int, session: AsyncSession) -> List[Balance]:
    """
    Calculate balances for all members in a trip.

    Returns a list of Balance objects showing:
    - How much each member paid
    - How much each member owes
    - Net balance (positive = owed money, negative = owes money)
    """
    # Get all members
    members_statement = select(TripMember).where(TripMember.trip_id == trip_id)
    result = await session.execute(members_statement)
    members = result.scalars().all()

    # Initialize balances
    balances: Dict[int, Balance] = {}
    for member in members:
        balances[member.id] = Balance(member.id, member.nickname)

    # Get all expenses for this trip
    expenses_statement = select(Expense).where(Expense.trip_id == trip_id)
    result = await session.execute(expenses_statement)
    expenses = result.scalars().all()

    for expense in expenses:
        # Calculate amount in base currency
        amount_in_base = expense.amount * expense.exchange_rate_to_base

        # Add to total paid by the payer
        if expense.paid_by_member_id in balances:
            balances[expense.paid_by_member_id].total_paid += amount_in_base

        # Get splits for this expense
        splits_statement = select(Split).where(Split.expense_id == expense.id)
        result = await session.execute(splits_statement)
        splits = result.scalars().all()

        for split in splits:
            # Add to total owed by each member
            if split.member_id in balances:
                balances[split.member_id].total_owed += split.amount

    # Calculate net balances
    for balance in balances.values():
        balance.net_balance = balance.total_paid - balance.total_owed

    return list(balances.values())


async def calculate_settlements(
    trip_id: int, session: AsyncSession
) -> List[Settlement]:
    """
    Calculate optimal settlements to minimize number of transactions.

    Uses a greedy algorithm to match debtors with creditors.
    Returns a list of Settlement objects.
    """
    # Get balances
    balances = await calculate_balances(trip_id, session)

    # Separate into creditors (owed money) and debtors (owe money)
    creditors = []  # People who are owed money (positive balance)
    debtors = []  # People who owe money (negative balance)

    for balance in balances:
        if balance.net_balance > Decimal("0.01"):  # Ignore tiny amounts
            creditors.append(
                {
                    "member_id": balance.member_id,
                    "nickname": balance.member_nickname,
                    "amount": balance.net_balance,
                }
            )
        elif balance.net_balance < Decimal("-0.01"):  # Ignore tiny amounts
            debtors.append(
                {
                    "member_id": balance.member_id,
                    "nickname": balance.member_nickname,
                    "amount": -balance.net_balance,  # Make positive
                }
            )

    # Sort by amount (largest first) for better optimization
    creditors.sort(key=lambda x: x["amount"], reverse=True)
    debtors.sort(key=lambda x: x["amount"], reverse=True)

    settlements = []

    # Greedy algorithm: match largest debtor with largest creditor
    i = 0  # creditor index
    j = 0  # debtor index

    while i < len(creditors) and j < len(debtors):
        creditor = creditors[i]
        debtor = debtors[j]

        # Determine payment amount
        payment_amount = min(creditor["amount"], debtor["amount"])

        # Create settlement
        settlement = Settlement(
            from_member_id=debtor["member_id"],
            to_member_id=creditor["member_id"],
            amount=payment_amount,
            from_nickname=debtor["nickname"],
            to_nickname=creditor["nickname"],
        )
        settlements.append(settlement)

        # Update amounts
        creditor["amount"] -= payment_amount
        debtor["amount"] -= payment_amount

        # Move to next if fully settled
        if creditor["amount"] < Decimal("0.01"):
            i += 1
        if debtor["amount"] < Decimal("0.01"):
            j += 1

    return settlements


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
