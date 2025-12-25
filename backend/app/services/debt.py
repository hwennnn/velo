"""
Debt management service for tracking and settling member debts.
Provides efficient balance calculations using the member_debts table.
"""

from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, delete, and_

from datetime import datetime
from app.models.expense import Expense
from app.models.split import Split
from app.models.member_debt import MemberDebt
from app.models.trip_member import TripMember
from app.models.trip import Trip
from app.services.exchange_rate import get_exchange_rate


async def update_debts_for_expense(
    expense: Expense, splits: List[Split], session: AsyncSession
) -> None:
    """
    Update member debts when an expense is created or modified.

    Logic (Greedy Approach):
    1. For each split, if the member is not the payer, they owe the payer
    2. Calculate the amount in the original currency
    3. Check for reverse debt (payer owes the split member) in the same currency
    4. If reverse debt exists, reduce it first (greedy settlement)
    5. Only create/update forward debt if there's remaining amount
    """
    payer_id = expense.paid_by_member_id

    for split in splits:
        if split.member_id == payer_id:
            # Payer doesn't owe themselves
            continue

        # Calculate amount in original currency
        # split.amount is now in expense currency (no conversion needed)
        amount_in_original = split.amount
        remaining_amount = amount_in_original

        # GREEDY: First check if there's a reverse debt (payer owes split member)
        reverse_debt_statement = select(MemberDebt).where(
            and_(
                MemberDebt.trip_id == expense.trip_id,
                MemberDebt.debtor_member_id == payer_id,
                MemberDebt.creditor_member_id == split.member_id,
                MemberDebt.currency == expense.currency,
            )
        )
        result = await session.execute(reverse_debt_statement)
        reverse_debt = result.scalar_one_or_none()

        if reverse_debt:
            # Greedy settlement: reduce the reverse debt first
            if reverse_debt.amount >= remaining_amount:
                # Reverse debt is larger or equal - just reduce it
                reverse_debt.amount -= remaining_amount
                reverse_debt.updated_at = expense.updated_at

                if reverse_debt.amount < Decimal("0.01"):
                    # Debt fully settled, remove it
                    await session.delete(reverse_debt)
                else:
                    session.add(reverse_debt)

                # No remaining amount to add as forward debt
                continue
            else:
                # Reverse debt is smaller - eliminate it and continue with remainder
                remaining_amount -= reverse_debt.amount
                await session.delete(reverse_debt)

        # Now handle the remaining amount (if any)
        # Find existing forward debt record
        debt_statement = select(MemberDebt).where(
            and_(
                MemberDebt.trip_id == expense.trip_id,
                MemberDebt.debtor_member_id == split.member_id,
                MemberDebt.creditor_member_id == payer_id,
                MemberDebt.currency == expense.currency,
            )
        )
        result = await session.execute(debt_statement)
        existing_debt = result.scalar_one_or_none()

        if existing_debt:
            # Update existing debt
            existing_debt.amount += remaining_amount
            existing_debt.updated_at = expense.updated_at
            session.add(existing_debt)
        else:
            # Create new debt record
            new_debt = MemberDebt(
                trip_id=expense.trip_id,
                debtor_member_id=split.member_id,
                creditor_member_id=payer_id,
                amount=remaining_amount,
                currency=expense.currency,
                source_expense_id=expense.id,
            )
            session.add(new_debt)


async def record_settlement(
    trip_id: int,
    debtor_member_id: int,
    creditor_member_id: int,
    amount: Decimal,
    currency: str,
    session: AsyncSession,
    user_id: str,
    settlement_date: datetime,
    notes: Optional[str] = None,
    conversion_rate: Optional[Decimal] = None,
    target_currency: Optional[str] = None,
) -> Dict:
    """
    Record a settlement between two members as a settlement expense.

    Creates an expense with expense_type='settlement' that:
    - Shows in the expense list
    - Reduces the debt between members
    - Provides audit trail

    Args:
        trip_id: Trip ID
        debtor_member_id: Member who is paying
        creditor_member_id: Member who is receiving
        amount: Amount being paid
        currency: Currency of payment
        session: Database session
        user_id: User recording the settlement
        settlement_date: Date of settlement
        notes: Optional notes
        conversion_rate: Optional conversion rate if settling in different currency
        target_currency: Optional target currency if converting

    Returns:
        Dict with settlement details and expense ID
    """
    # Get member names for description
    debtor = await session.get(TripMember, debtor_member_id)
    creditor = await session.get(TripMember, creditor_member_id)

    if not debtor or not creditor:
        raise ValueError("Invalid member IDs")

    # Get trip for base currency
    trip = await session.get(Trip, trip_id)
    if not trip:
        raise ValueError("Invalid trip ID")

    # Calculate settle amount and currency
    settle_currency = currency
    settle_amount = amount

    if target_currency and conversion_rate:
        # User is paying in 'currency' but settling debt in 'target_currency'
        settle_amount = amount * conversion_rate
        settle_currency = target_currency
        if not notes:
            notes = f"Paid {amount} {currency} (= {settle_amount} {settle_currency})"

    # Get exchange rate to base currency
    exchange_rate_to_base = await get_exchange_rate(currency, trip.base_currency)

    # Create settlement as an expense
    settlement_expense = Expense(
        trip_id=trip_id,
        description=f"Settlement: {debtor.nickname} → {creditor.nickname}",
        amount=amount,
        currency=currency,
        exchange_rate_to_base=exchange_rate_to_base,
        paid_by_member_id=debtor_member_id,
        expense_date=settlement_date,
        expense_type="settlement",
        notes=notes or "Settlement payment",
        created_by=user_id,
    )

    session.add(settlement_expense)
    await session.flush()  # Get the expense ID

    # Create a split for the creditor (who "receives" the payment)
    # This represents the debt being settled (amount in expense currency)
    split = Split(
        expense_id=settlement_expense.id,
        member_id=creditor_member_id,
        amount=amount,  # Now stored in expense currency
    )

    session.add(split)
    await session.flush()

    # Now reduce the actual debt
    # Find the debt record
    debt_statement = select(MemberDebt).where(
        and_(
            MemberDebt.trip_id == trip_id,
            MemberDebt.debtor_member_id == debtor_member_id,
            MemberDebt.creditor_member_id == creditor_member_id,
            MemberDebt.currency == settle_currency,
        )
    )
    result = await session.execute(debt_statement)
    debt = result.scalar_one_or_none()

    if not debt:
        # No debt exists in this currency
        # Check if there's a reverse debt (creditor owes debtor)
        reverse_statement = select(MemberDebt).where(
            and_(
                MemberDebt.trip_id == trip_id,
                MemberDebt.debtor_member_id == creditor_member_id,
                MemberDebt.creditor_member_id == debtor_member_id,
                MemberDebt.currency == settle_currency,
            )
        )
        result = await session.execute(reverse_statement)
        reverse_debt = result.scalar_one_or_none()

        if reverse_debt:
            # Increase the reverse debt (they paid more than they owed)
            reverse_debt.amount += settle_amount
            session.add(reverse_debt)
            return {
                "status": "overpaid",
                "message": f"Payment recorded. {creditor.nickname} now owes {debtor.nickname}",
                "remaining_debt": float(reverse_debt.amount),
                "expense_id": settlement_expense.id,
            }
        else:
            # Create new reverse debt
            new_debt = MemberDebt(
                trip_id=trip_id,
                debtor_member_id=creditor_member_id,
                creditor_member_id=debtor_member_id,
                amount=settle_amount,
                currency=settle_currency,
            )
            session.add(new_debt)
            return {
                "status": "overpaid",
                "message": f"Payment recorded. {creditor.nickname} now owes {debtor.nickname}",
                "remaining_debt": float(settle_amount),
                "expense_id": settlement_expense.id,
            }

    # Reduce the debt
    if debt.amount <= settle_amount:
        # Fully settled (or overpaid)
        overpayment = settle_amount - debt.amount
        await session.delete(debt)

        if overpayment > Decimal("0.01"):
            # Create reverse debt for overpayment
            new_debt = MemberDebt(
                trip_id=trip_id,
                debtor_member_id=creditor_member_id,
                creditor_member_id=debtor_member_id,
                amount=overpayment,
                currency=settle_currency,
            )
            session.add(new_debt)
            return {
                "status": "overpaid",
                "message": "Debt fully settled with overpayment",
                "overpayment": float(overpayment),
                "expense_id": settlement_expense.id,
            }
        else:
            return {
                "status": "settled",
                "message": "Debt fully settled",
                "expense_id": settlement_expense.id,
            }
    else:
        # Partially settled
        debt.amount -= settle_amount
        session.add(debt)
        return {
            "status": "partial",
            "message": "Partial payment recorded",
            "remaining_debt": float(debt.amount),
            "expense_id": settlement_expense.id,
        }


async def get_member_balances(trip_id: int, session: AsyncSession) -> List[Dict]:
    """
    Get balances for all members in a trip.
    Much more efficient than calculating from expenses.

    Returns list of member balances with currency breakdown.
    total_owed and total_owed_to are in BASE CURRENCY for comparison.
    """
    # Get trip to know base currency
    trip = await session.get(Trip, trip_id)
    if not trip:
        return []

    base_currency = trip.base_currency

    # Get all members
    members_statement = select(TripMember).where(TripMember.trip_id == trip_id)
    result = await session.execute(members_statement)
    members = result.scalars().all()

    # Initialize balance structure
    balances = {}
    for member in members:
        balances[member.id] = {
            "member_id": member.id,
            "member_nickname": member.nickname,
            "currency_balances": defaultdict(lambda: Decimal("0.0")),
            "total_owed_base": Decimal("0.0"),  # What they owe (in base currency)
            "total_owed_to_base": Decimal(
                "0.0"
            ),  # What they're owed (in base currency)
        }

    # Get all debts for this trip
    debts_statement = select(MemberDebt).where(MemberDebt.trip_id == trip_id)
    result = await session.execute(debts_statement)
    debts = result.scalars().all()

    # Process debts
    for debt in debts:
        if debt.amount < Decimal("0.01"):
            continue  # Skip negligible amounts

        # Get exchange rate to base currency
        exchange_rate = await get_exchange_rate(debt.currency, base_currency)
        amount_in_base = debt.amount * exchange_rate

        # Debtor owes money (negative balance in this currency)
        if debt.debtor_member_id in balances:
            balances[debt.debtor_member_id]["currency_balances"][
                debt.currency
            ] -= debt.amount
            balances[debt.debtor_member_id]["total_owed_base"] += amount_in_base

        # Creditor is owed money (positive balance in this currency)
        if debt.creditor_member_id in balances:
            balances[debt.creditor_member_id]["currency_balances"][
                debt.currency
            ] += debt.amount
            balances[debt.creditor_member_id]["total_owed_to_base"] += amount_in_base

    # Convert to list and clean up
    result_list = []
    for balance in balances.values():
        # Convert defaultdict to regular dict, filter out zero balances
        balance["currency_balances"] = {
            currency: float(amount)
            for currency, amount in balance["currency_balances"].items()
            if abs(amount) > 0.01
        }
        balance["total_owed"] = float(balance["total_owed_base"])
        balance["total_owed_to"] = float(balance["total_owed_to_base"])
        balance["net_balance"] = float(
            balance["total_owed_to_base"] - balance["total_owed_base"]
        )
        result_list.append(balance)

    return result_list


async def get_settlements_plan(trip_id: int, session: AsyncSession) -> List[Dict]:
    """
    Get optimal settlement plan from debt records.
    Groups by currency and suggests minimal transactions.
    """
    # Get all debts
    debts_statement = select(MemberDebt).where(
        and_(MemberDebt.trip_id == trip_id, MemberDebt.amount > Decimal("0.01"))
    )
    result = await session.execute(debts_statement)
    debts = result.scalars().all()

    # Get member info for nicknames
    members_statement = select(TripMember).where(TripMember.trip_id == trip_id)
    result = await session.execute(members_statement)
    members = {m.id: m.nickname for m in result.scalars().all()}

    # Convert debts to settlement suggestions
    settlements = []
    for debt in debts:
        settlements.append(
            {
                "from_member_id": debt.debtor_member_id,
                "to_member_id": debt.creditor_member_id,
                "from_nickname": members.get(debt.debtor_member_id, "Unknown"),
                "to_nickname": members.get(debt.creditor_member_id, "Unknown"),
                "amount": float(debt.amount),
                "currency": debt.currency,
            }
        )

    return settlements


async def delete_debts_for_expense(expense_id: int, session: AsyncSession) -> int:
    """
    Delete all debt records created by a specific expense.
    Called when an expense is deleted.

    Returns number of debt records deleted.
    """
    delete_statement = delete(MemberDebt).where(
        MemberDebt.source_expense_id == expense_id
    )
    result = await session.execute(delete_statement)
    return result.rowcount


async def cleanup_zero_debts(trip_id: int, session: AsyncSession) -> int:
    """
    Remove debt records with zero or negligible amounts.
    Returns number of records deleted.
    """
    delete_statement = delete(MemberDebt).where(
        and_(MemberDebt.trip_id == trip_id, MemberDebt.amount < Decimal("0.01"))
    )
    result = await session.execute(delete_statement)
    return result.rowcount


async def merge_debt_currency(
    trip_id: int,
    debtor_member_id: int,
    creditor_member_id: int,
    amount: Decimal,
    from_currency: str,
    to_currency: str,
    conversion_rate: Decimal,
    session: AsyncSession,
) -> Dict:
    """
    Merge a debt from one currency to another without paying it.
    This consolidates debts in fewer currencies for easier settlement.

    Process:
    1. Find the debt in from_currency
    2. Reduce or delete it by the specified amount
    3. Convert the amount to to_currency
    4. Add to existing debt in to_currency or create new one

    Args:
        trip_id: Trip ID
        debtor_member_id: Member who owes
        creditor_member_id: Member who is owed
        amount: Amount to merge (in from_currency)
        from_currency: Original currency
        to_currency: Target currency
        conversion_rate: Conversion rate (1 from_currency = X to_currency)
        session: Database session

    Returns:
        Dict with merge details
    """
    # Find the source debt
    source_debt_statement = select(MemberDebt).where(
        and_(
            MemberDebt.trip_id == trip_id,
            MemberDebt.debtor_member_id == debtor_member_id,
            MemberDebt.creditor_member_id == creditor_member_id,
            MemberDebt.currency == from_currency,
        )
    )
    result = await session.execute(source_debt_statement)
    source_debt = result.scalar_one_or_none()

    if not source_debt:
        raise ValueError(
            f"No debt found from member {debtor_member_id} to {creditor_member_id} in {from_currency}"
        )

    if source_debt.amount < amount:
        raise ValueError(
            f"Cannot merge {amount} {from_currency}. Only {source_debt.amount} {from_currency} owed."
        )

    # Calculate converted amount
    converted_amount = amount * conversion_rate

    # Reduce or delete source debt
    if source_debt.amount - amount < Decimal("0.01"):
        # Delete if fully merged (or negligible remainder)
        await session.delete(source_debt)
        remaining_in_original = Decimal("0")
    else:
        # Partially merged
        source_debt.amount -= amount
        session.add(source_debt)
        remaining_in_original = source_debt.amount

    # Find or create target debt
    target_debt_statement = select(MemberDebt).where(
        and_(
            MemberDebt.trip_id == trip_id,
            MemberDebt.debtor_member_id == debtor_member_id,
            MemberDebt.creditor_member_id == creditor_member_id,
            MemberDebt.currency == to_currency,
        )
    )
    result = await session.execute(target_debt_statement)
    target_debt = result.scalar_one_or_none()

    if target_debt:
        # Add to existing debt
        old_amount = target_debt.amount
        target_debt.amount += converted_amount
        session.add(target_debt)
        new_amount = target_debt.amount
    else:
        # Create new debt in target currency
        target_debt = MemberDebt(
            trip_id=trip_id,
            debtor_member_id=debtor_member_id,
            creditor_member_id=creditor_member_id,
            amount=converted_amount,
            currency=to_currency,
        )
        session.add(target_debt)
        old_amount = Decimal("0")
        new_amount = converted_amount

    return {
        "status": "merged",
        "from_currency": from_currency,
        "to_currency": to_currency,
        "merged_amount": float(amount),
        "converted_amount": float(converted_amount),
        "conversion_rate": float(conversion_rate),
        "remaining_in_original_currency": float(remaining_in_original),
        "old_target_amount": float(old_amount),
        "new_target_amount": float(new_amount),
    }
