"""
Split calculation service for expense distribution.
Extracts split logic from api/expenses.py for reuse and testability.
"""

import random
from decimal import Decimal
from typing import List

from app.models.split import Split


def calculate_equal_splits(
    amount: Decimal,
    member_ids: List[int],
    expense_id: int,
) -> List[Split]:
    """
    Calculate equal splits for an expense.

    Divides the amount equally among all members.
    Any rounding remainder (due to decimal truncation) is assigned to a
    randomly chosen member so splits always sum to exactly the original amount.

    Args:
        amount: Total expense amount
        member_ids: List of member IDs to split among
        expense_id: ID of the expense

    Returns:
        List of Split objects ready to be added to the session
    """
    num_members = len(member_ids)
    if num_members == 0:
        return []

    split_amount = (amount / num_members).quantize(Decimal("0.01"))
    split_percentage = (Decimal("100.0") / num_members).quantize(Decimal("0.01"))

    total_split = split_amount * num_members
    remainder = amount - total_split

    lucky_index = random.randint(0, num_members - 1) if remainder != 0 else -1

    splits = []
    for idx, member_id in enumerate(member_ids):
        member_amount = split_amount
        if idx == lucky_index:
            member_amount += remainder
        splits.append(
            Split(
                expense_id=expense_id,
                member_id=member_id,
                amount=member_amount,
                percentage=split_percentage,
            )
        )
    return splits


def calculate_percentage_splits(
    amount: Decimal,
    splits_data: list,
    expense_id: int,
) -> List[Split]:
    """
    Calculate percentage-based splits for an expense.

    Each split_data item is expected to have .member_id and .percentage.
    Any rounding remainder is assigned to a randomly chosen member so splits
    always sum to exactly the original amount.

    Args:
        amount: Total expense amount
        splits_data: List of split data objects with .member_id and .percentage
        expense_id: ID of the expense

    Returns:
        List of Split objects ready to be added to the session
    """
    if not splits_data:
        return []

    lucky_index = random.randint(0, len(splits_data) - 1)
    total_assigned = Decimal("0")
    intermediate = []

    for idx, split_data in enumerate(splits_data):
        split_amount = (amount * (split_data.percentage / 100)).quantize(
            Decimal("0.01")
        )
        total_assigned += split_amount
        intermediate.append(
            {
                "member_id": split_data.member_id,
                "amount": split_amount,
                "percentage": split_data.percentage,
                "index": idx,
            }
        )

    # Apply rounding remainder to lucky member
    remainder = amount - total_assigned
    if remainder != 0:
        intermediate[lucky_index]["amount"] += remainder

    return [
        Split(
            expense_id=expense_id,
            member_id=item["member_id"],
            amount=item["amount"],
            percentage=item["percentage"],
        )
        for item in intermediate
    ]


def calculate_custom_splits(
    amount: Decimal,
    splits_data: list,
    expense_id: int,
) -> List[Split]:
    """
    Calculate custom (fixed-amount) splits for an expense.

    Each split_data item is expected to have .member_id and .amount.
    Any rounding remainder (from quantization) is assigned to a randomly
    chosen member so splits always sum to exactly the original amount.

    Args:
        amount: Total expense amount
        splits_data: List of split data objects with .member_id and .amount
        expense_id: ID of the expense

    Returns:
        List of Split objects ready to be added to the session
    """
    if not splits_data:
        return []

    lucky_index = random.randint(0, len(splits_data) - 1)
    total_assigned = Decimal("0")
    intermediate = []

    for idx, split_data in enumerate(splits_data):
        split_amount = split_data.amount.quantize(Decimal("0.01"))
        split_percentage = ((split_amount / amount) * 100).quantize(Decimal("0.01"))
        total_assigned += split_amount
        intermediate.append(
            {
                "member_id": split_data.member_id,
                "amount": split_amount,
                "percentage": split_percentage,
                "index": idx,
            }
        )

    # Apply rounding remainder to lucky member
    remainder = amount - total_assigned
    if remainder != 0:
        intermediate[lucky_index]["amount"] += remainder

    return [
        Split(
            expense_id=expense_id,
            member_id=item["member_id"],
            amount=item["amount"],
            percentage=item["percentage"],
        )
        for item in intermediate
    ]


def calculate_splits(
    split_type: str,
    amount: Decimal,
    splits_data: list,
    member_ids: List[int],
    expense_id: int,
) -> List[Split]:
    """
    Dispatch to the correct split calculator based on split_type.

    Args:
        split_type: One of "equal", "percentage", "custom"
        amount: Total expense amount
        splits_data: Raw split data (used for percentage/custom)
        member_ids: Member ID list (used for equal splits)
        expense_id: ID of the expense

    Returns:
        List of Split objects ready to be added to the session
    """
    if split_type == "equal":
        return calculate_equal_splits(amount, member_ids, expense_id)
    elif split_type == "percentage":
        return calculate_percentage_splits(amount, splits_data, expense_id)
    elif split_type == "custom":
        return calculate_custom_splits(amount, splits_data, expense_id)
    else:
        raise ValueError(f"Unknown split type: {split_type}")
