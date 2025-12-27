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


def simplify_debts(debts: List[Dict], base_currency: str) -> List[Dict]:
    """
    Simplify debts to minimize the number of transactions.
    Uses a greedy algorithm to reduce complexity.

    Algorithm:
    1. Convert all debts to base currency
    2. Calculate net balance for each member
    3. Match debtors with creditors to minimize transactions

    Args:
        debts: List of debt dictionaries with amount_in_base
        base_currency: Base currency for simplified debts

    Returns:
        Simplified list of debts in base currency
    """
    if not debts:
        return []

    # Calculate net balance for each member in base currency
    net_balances = defaultdict(lambda: Decimal("0.0"))
    member_names = {}

    for debt in debts:
        debtor_id = debt["from_member_id"]
        creditor_id = debt["to_member_id"]
        amount_in_base = Decimal(str(debt["amount_in_base"]))

        # Track names
        member_names[debtor_id] = debt["from_nickname"]
        member_names[creditor_id] = debt["to_nickname"]

        # Debtor has negative balance, creditor has positive
        net_balances[debtor_id] -= amount_in_base
        net_balances[creditor_id] += amount_in_base

    # Separate members into debtors (negative) and creditors (positive)
    debtors = []  # (member_id, amount_owed)
    creditors = []  # (member_id, amount_owed_to)

    for member_id, balance in net_balances.items():
        if balance < Decimal("-0.01"):
            debtors.append([member_id, -balance])  # Make positive
        elif balance > Decimal("0.01"):
            creditors.append([member_id, balance])

    # Greedy matching: match largest debtor with largest creditor
    simplified = []
    debtors.sort(key=lambda x: x[1], reverse=True)
    creditors.sort(key=lambda x: x[1], reverse=True)

    debtor_idx = 0
    creditor_idx = 0

    while debtor_idx < len(debtors) and creditor_idx < len(creditors):
        debtor_id, debt_amount = debtors[debtor_idx]
        creditor_id, credit_amount = creditors[creditor_idx]

        # Transfer amount is the minimum of what debtor owes and creditor is owed
        transfer = min(debt_amount, credit_amount)

        if transfer > Decimal("0.01"):
            simplified.append(
                {
                    "from_member_id": debtor_id,
                    "to_member_id": creditor_id,
                    "from_nickname": member_names[debtor_id],
                    "to_nickname": member_names[creditor_id],
                    "amount": float(transfer),
                    "currency": base_currency,
                    "amount_in_base": float(transfer),
                }
            )

        # Update remaining amounts
        debtors[debtor_idx][1] -= transfer
        creditors[creditor_idx][1] -= transfer

        # Move to next if settled
        if debtors[debtor_idx][1] < Decimal("0.01"):
            debtor_idx += 1
        if creditors[creditor_idx][1] < Decimal("0.01"):
            creditor_idx += 1

    return simplified


async def update_debts_for_expense(
    expense: Expense, splits: List[Split], session: AsyncSession
) -> None:
    """
    Create or update member debts when an expense is created or modified.

    Simple Logic:
    1. For each split, if the member is not the payer, they owe the payer
    2. Find or create a debt record for (debtor -> creditor) in the expense currency
    3. Add the split amount to the existing debt

    No greedy settlement - just track who owes who what.
    """
    payer_id = expense.paid_by_member_id

    for split in splits:
        if split.member_id == payer_id:
            # Payer doesn't owe themselves
            continue

        # Amount this member owes (in expense currency)
        amount = split.amount

        # Find existing debt record
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
            # Update existing debt by adding the amount
            existing_debt.amount += amount
            existing_debt.updated_at = expense.updated_at
            session.add(existing_debt)
        else:
            # Create new debt record
            new_debt = MemberDebt(
                trip_id=expense.trip_id,
                debtor_member_id=split.member_id,
                creditor_member_id=payer_id,
                amount=amount,
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

    New Simple Logic:
    - Create a settlement expense (debtor pays creditor)
    - Create a split showing creditor receives the amount
    - This creates a debt: creditor owes debtor
    - This debt will cancel out with existing debts in balances calculation

    Args:
        trip_id: Trip ID
        debtor_member_id: Member who is paying (the payer)
        creditor_member_id: Member who is receiving (the receiver)
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

    # Handle currency conversion notes
    if target_currency and conversion_rate:
        settle_amount = amount * conversion_rate
        if not notes:
            notes = f"Paid {amount} {currency} (= {settle_amount} {target_currency})"

    # Get exchange rate to base currency
    exchange_rate_to_base = await get_exchange_rate(currency, trip.base_currency)

    # Create settlement as an expense
    # The debtor (payer) is the one who "paid" this expense
    settlement_expense = Expense(
        trip_id=trip_id,
        description=f"{debtor.nickname} paid {creditor.nickname}",
        amount=amount,
        currency=currency,
        exchange_rate_to_base=exchange_rate_to_base,
        paid_by_member_id=debtor_member_id,
        expense_type="settlement",
        notes=notes or "Settlement payment",
        created_by=user_id,
        created_at=settlement_date,
        updated_at=settlement_date,
    )

    session.add(settlement_expense)
    await session.flush()  # Get the expense ID

    # Create a split for the creditor (who "receives" the payment)
    # This creates a reverse debt: creditor now owes debtor
    split = Split(
        expense_id=settlement_expense.id,
        member_id=creditor_member_id,
        amount=amount,
    )

    session.add(split)
    await session.flush()

    # Update debts using the standard logic
    # This will create: creditor owes debtor the amount
    # Which cancels out with the existing: debtor owes creditor
    await update_debts_for_expense(settlement_expense, [split], session)

    return {
        "status": "recorded",
        "message": "Settlement recorded successfully",
        "expense_id": settlement_expense.id,
    }


async def get_member_balances(
    trip_id: int, session: AsyncSession, simplify: bool = False
) -> Dict:
    """
    Get balances for all members in a trip.
    Much more efficient than calculating from expenses.

    Returns:
    - member_balances: List of member balances with currency breakdown
    - debts: List of who owes who how much (can be simplified)

    Args:
        trip_id: Trip ID
        session: Database session
        simplify: If True, minimize the number of transactions using greedy algorithm
    """
    # Get trip to know base currency
    trip = await session.get(Trip, trip_id)
    if not trip:
        return {"member_balances": [], "debts": []}

    base_currency = trip.base_currency

    # Get all members
    members_statement = select(TripMember).where(TripMember.trip_id == trip_id)
    result = await session.execute(members_statement)
    members = result.scalars().all()
    member_map = {m.id: m.nickname for m in members}

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
    all_debts = result.scalars().all()

    # First net out reverse debts per pair/currency to avoid showing A owes B and B owes A.
    net_map: Dict[tuple[int, int, str], Decimal] = {}
    for debt in all_debts:
        if debt.amount < Decimal("0.01"):
            continue  # Skip negligible amounts
        if debt.debtor_member_id == debt.creditor_member_id:
            continue

        a = debt.debtor_member_id
        b = debt.creditor_member_id
        lo, hi = (a, b) if a < b else (b, a)
        sign = Decimal("1") if a == lo else Decimal("-1")
        key = (lo, hi, debt.currency)
        net_map[key] = net_map.get(key, Decimal("0.0")) + sign * debt.amount

    # Build normalized debt list and update balances
    debt_list = []
    for (lo, hi, curr), net_amount in net_map.items():
        if abs(net_amount) < Decimal("0.01"):
            continue  # cancels out fully

        if net_amount > 0:
            from_id, to_id, amount = lo, hi, net_amount
        else:
            from_id, to_id, amount = hi, lo, -net_amount

        # Get exchange rate to base currency
        exchange_rate = await get_exchange_rate(curr, base_currency)
        amount_in_base = amount * exchange_rate

        debt_list.append(
            {
                "from_member_id": from_id,
                "to_member_id": to_id,
                "from_nickname": member_map.get(from_id, "Unknown"),
                "to_nickname": member_map.get(to_id, "Unknown"),
                "amount": float(amount),
                "currency": curr,
                "amount_in_base": float(amount_in_base),
            }
        )

        # Debtor owes money (negative balance in this currency)
        if from_id in balances:
            balances[from_id]["currency_balances"][curr] -= amount
            balances[from_id]["total_owed_base"] += amount_in_base

        # Creditor is owed money (positive balance in this currency)
        if to_id in balances:
            balances[to_id]["currency_balances"][curr] += amount
            balances[to_id]["total_owed_to_base"] += amount_in_base

    # Simplify debts if requested (minimize transactions)
    if simplify:
        debt_list = simplify_debts(debt_list, base_currency)

    # Convert balances to list and clean up
    result_list = []
    for balance in balances.values():
        # Convert defaultdict to regular dict, filter out zero balances
        currency_balances = {
            currency: float(amount)
            for currency, amount in balance["currency_balances"].items()
            if abs(amount) > 0.01
        }

        result_list.append(
            {
                "member_id": balance["member_id"],
                "member_nickname": balance["member_nickname"],
                "currency_balances": currency_balances,
                "total_owed": float(balance["total_owed_base"]),
                "total_owed_to": float(balance["total_owed_to_base"]),
                "net_balance": float(
                    balance["total_owed_to_base"] - balance["total_owed_base"]
                ),
            }
        )

    return {
        "member_balances": result_list,
        "debts": debt_list,
    }


async def delete_debts_for_expense(expense_id: int, session: AsyncSession) -> int:
    """
    Delete all debt records created by a specific expense.
    Called when an expense is deleted or updated.

    Returns number of debt records deleted.
    """
    delete_statement = delete(MemberDebt).where(
        MemberDebt.source_expense_id == expense_id
    )
    result = await session.execute(delete_statement)
    return result.rowcount


async def update_debts_for_expense_modification(
    expense: Expense, splits: List[Split], session: AsyncSession
) -> None:
    """
    Update debts when an expense is modified.
    This ensures idempotent updates by:
    1. Deleting all old debts created by this expense
    2. Recreating debts based on current splits

    Args:
        expense: The modified expense
        splits: Current splits for the expense
        session: Database session
    """
    # Delete old debts for this expense
    await delete_debts_for_expense(expense.id, session)

    # Recreate debts based on current splits
    await update_debts_for_expense(expense, splits, session)


async def convert_all_debts_to_currency(
    trip_id: int,
    target_currency: str,
    session: AsyncSession,
    custom_rates: Optional[Dict[str, Decimal]] = None,
) -> Dict:
    """
    Convert all debts in a trip to a single target currency.
    This consolidates multi-currency debts for easier settlement.

    Process:
    1. Get all debts in the trip
    2. For each unique (debtor, creditor, currency) debt:
       - If already in target currency, keep as is
       - Otherwise, convert to target currency and merge
    3. Result: All debts are in target currency

    Args:
        trip_id: Trip ID
        target_currency: Target currency to convert to
        session: Database session
        custom_rates: Optional custom exchange rates {currency: rate_to_target}

    Returns:
        Dict with conversion summary
    """
    # Get all debts
    debts_statement = select(MemberDebt).where(
        and_(MemberDebt.trip_id == trip_id, MemberDebt.amount > Decimal("0.01"))
    )
    result = await session.execute(debts_statement)
    all_debts = result.scalars().all()

    conversions = []
    total_converted = 0

    for debt in all_debts:
        # Skip if already in target currency
        if debt.currency == target_currency:
            continue

        # Get conversion rate
        if custom_rates and debt.currency in custom_rates:
            conversion_rate = custom_rates[debt.currency]
        else:
            conversion_rate = await get_exchange_rate(debt.currency, target_currency)

        # Convert amount
        original_amount = debt.amount
        converted_amount = original_amount * conversion_rate

        # Find or create debt in target currency
        target_debt_statement = select(MemberDebt).where(
            and_(
                MemberDebt.trip_id == trip_id,
                MemberDebt.debtor_member_id == debt.debtor_member_id,
                MemberDebt.creditor_member_id == debt.creditor_member_id,
                MemberDebt.currency == target_currency,
            )
        )
        result = await session.execute(target_debt_statement)
        target_debt = result.scalar_one_or_none()

        if target_debt:
            # Add to existing debt
            target_debt.amount += converted_amount
            target_debt.updated_at = datetime.utcnow()
            session.add(target_debt)
        else:
            # Create new debt in target currency
            new_debt = MemberDebt(
                trip_id=trip_id,
                debtor_member_id=debt.debtor_member_id,
                creditor_member_id=debt.creditor_member_id,
                amount=converted_amount,
                currency=target_currency,
            )
            session.add(new_debt)

        # Delete old debt
        await session.delete(debt)

        conversions.append(
            {
                "debtor_id": debt.debtor_member_id,
                "creditor_id": debt.creditor_member_id,
                "original_amount": float(original_amount),
                "original_currency": debt.currency,
                "converted_amount": float(converted_amount),
                "conversion_rate": float(conversion_rate),
            }
        )

        total_converted += 1

    return {
        "status": "success",
        "target_currency": target_currency,
        "total_debts_converted": total_converted,
        "conversions": conversions,
    }

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


async def update_trip_member_balances_for_debt(
    debtor_member_id: int,
    creditor_member_id: int,
    amount_in_base: Decimal,
    session: AsyncSession,
    operation: str = "add",  # "add" or "subtract"
) -> None:
    """
    Update cached balance fields on TripMember records when debt amounts change.

    Args:
        debtor_member_id: Member who owes money
        creditor_member_id: Member who is owed money
        amount_in_base: Amount in base currency
        session: Database session
        operation: "add" to increase debt, "subtract" to decrease debt
    """
    multiplier = 1 if operation == "add" else -1

    # Update debtor's total_owed_base
    debtor = await session.get(TripMember, debtor_member_id)
    if debtor:
        debtor.total_owed_base += amount_in_base * multiplier
        session.add(debtor)

    # Update creditor's total_owed_to_base
    creditor = await session.get(TripMember, creditor_member_id)
    if creditor:
        creditor.total_owed_to_base += amount_in_base * multiplier
        session.add(creditor)


async def update_trip_member_balances_for_expense_deletion(
    expense_id: int, session: AsyncSession
) -> None:
    """
    Update TripMember balance fields when an expense (and its debts) is deleted.

    This subtracts the debt amounts from the cached balance fields.
    """
    # Get all debts for this expense
    debts_statement = select(MemberDebt).where(
        MemberDebt.source_expense_id == expense_id
    )
    result = await session.execute(debts_statement)
    debts = result.scalars().all()

    # Get trip base currency
    if debts:
        trip = await session.get(Trip, debts[0].trip_id)
        base_currency = trip.base_currency
    else:
        return  # No debts to update

    # Update balances for each debt (subtract since we're deleting)
    for debt in debts:
        if debt.amount < Decimal("0.01"):
            continue  # Skip negligible amounts

        # Get exchange rate
        exchange_rate = await get_exchange_rate(debt.currency, base_currency)
        amount_in_base = debt.amount * exchange_rate

        await update_trip_member_balances_for_debt(
            debt.debtor_member_id,
            debt.creditor_member_id,
            amount_in_base,
            session,
            operation="subtract",
        )
