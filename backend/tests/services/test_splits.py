"""
Unit tests for app/services/splits.py

Tests the split calculation functions independently of the HTTP layer.
"""

import os
import pytest
from decimal import Decimal
from types import SimpleNamespace

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from app.services.splits import (
    calculate_equal_splits,
    calculate_percentage_splits,
    calculate_custom_splits,
    calculate_splits,
)


def make_split_data(member_id, amount=None, percentage=None):
    """Helper to create a simple namespace mimicking SplitCreate."""
    return SimpleNamespace(member_id=member_id, amount=amount, percentage=percentage)


# ──────────────────────────────────────────────
# EQUAL SPLIT TESTS
# ──────────────────────────────────────────────


class TestEqualSplits:
    def test_equal_two_members(self):
        splits = calculate_equal_splits(Decimal("100"), [1, 2], expense_id=1)
        assert len(splits) == 2
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01")
        for s in splits:
            assert abs(s.amount - Decimal("50")) < Decimal("0.01")

    def test_equal_three_members_rounding(self):
        """$100 / 3 — splits must sum exactly to $100."""
        splits = calculate_equal_splits(Decimal("100"), [1, 2, 3], expense_id=1)
        assert len(splits) == 3
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01")
        # Each should be either 33.33 or 33.34
        for s in splits:
            assert Decimal("33.33") <= s.amount <= Decimal("33.34")

    def test_equal_ten_dollars_three_members(self):
        """$10 / 3 = $3.33, $3.33, $3.34 — sums exactly."""
        splits = calculate_equal_splits(Decimal("10"), [1, 2, 3], expense_id=42)
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("10")) < Decimal("0.01")

    def test_equal_two_members_odd_amount(self):
        """$101 / 2 — one gets 50.50, one gets 50.50 — but wait, let's check."""
        splits = calculate_equal_splits(Decimal("101"), [1, 2], expense_id=1)
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("101")) < Decimal("0.01")

    def test_equal_single_member(self):
        splits = calculate_equal_splits(Decimal("50"), [7], expense_id=1)
        assert len(splits) == 1
        assert abs(splits[0].amount - Decimal("50")) < Decimal("0.01")

    def test_equal_empty_member_list(self):
        splits = calculate_equal_splits(Decimal("100"), [], expense_id=1)
        assert splits == []

    def test_equal_splits_expense_id_assigned(self):
        splits = calculate_equal_splits(Decimal("100"), [1, 2], expense_id=99)
        for s in splits:
            assert s.expense_id == 99

    def test_equal_splits_member_ids_assigned(self):
        splits = calculate_equal_splits(Decimal("100"), [10, 20, 30], expense_id=1)
        member_ids = {s.member_id for s in splits}
        assert member_ids == {10, 20, 30}

    def test_equal_percentage_field_set(self):
        splits = calculate_equal_splits(Decimal("100"), [1, 2], expense_id=1)
        for s in splits:
            assert s.percentage is not None
            # For 2 members, each gets 50%
            assert abs(s.percentage - Decimal("50")) < Decimal("0.01")

    def test_equal_five_members(self):
        splits = calculate_equal_splits(Decimal("100"), [1, 2, 3, 4, 5], expense_id=1)
        assert len(splits) == 5
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01")
        for s in splits:
            assert abs(s.amount - Decimal("20")) < Decimal("0.01")


# ──────────────────────────────────────────────
# PERCENTAGE SPLIT TESTS
# ──────────────────────────────────────────────


class TestPercentageSplits:
    def test_50_50_percentage_split(self):
        data = [
            make_split_data(1, percentage=Decimal("50")),
            make_split_data(2, percentage=Decimal("50")),
        ]
        splits = calculate_percentage_splits(Decimal("200"), data, expense_id=1)
        assert len(splits) == 2
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("200")) < Decimal("0.01")
        for s in splits:
            assert abs(s.amount - Decimal("100")) < Decimal("0.01")

    def test_percentage_rounding_three_members(self):
        """33.33% * 3 = 99.99%, splits must still sum to $100."""
        data = [
            make_split_data(1, percentage=Decimal("33.33")),
            make_split_data(2, percentage=Decimal("33.33")),
            make_split_data(3, percentage=Decimal("33.34")),
        ]
        splits = calculate_percentage_splits(Decimal("100"), data, expense_id=1)
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01")

    def test_percentage_splits_expense_id(self):
        data = [
            make_split_data(1, percentage=Decimal("70")),
            make_split_data(2, percentage=Decimal("30")),
        ]
        splits = calculate_percentage_splits(Decimal("100"), data, expense_id=55)
        for s in splits:
            assert s.expense_id == 55

    def test_percentage_splits_member_ids(self):
        data = [
            make_split_data(10, percentage=Decimal("60")),
            make_split_data(20, percentage=Decimal("40")),
        ]
        splits = calculate_percentage_splits(Decimal("100"), data, expense_id=1)
        member_ids = {s.member_id for s in splits}
        assert member_ids == {10, 20}

    def test_percentage_splits_amounts_correct(self):
        """70/30 split of $300 → $210, $90."""
        data = [
            make_split_data(1, percentage=Decimal("70")),
            make_split_data(2, percentage=Decimal("30")),
        ]
        splits = calculate_percentage_splits(Decimal("300"), data, expense_id=1)
        amounts = sorted(s.amount for s in splits)
        assert abs(amounts[0] - Decimal("90")) < Decimal("0.01")
        assert abs(amounts[1] - Decimal("210")) < Decimal("0.01")

    def test_percentage_remainder_assigned_to_lucky_member(self):
        """When splits don't sum exactly, remainder is assigned: line 105 executed."""
        data = [
            make_split_data(1, percentage=Decimal("50")),
            make_split_data(2, percentage=Decimal("50")),
        ]
        # 10.01 * 50% = 5.005 → ROUND_HALF_EVEN → 5.00; remainder=0.01 → line 105 hit
        splits = calculate_percentage_splits(Decimal("10.01"), data, expense_id=1)
        total = sum(s.amount for s in splits)
        assert total == Decimal("10.01")

    def test_percentage_empty_list(self):
        splits = calculate_percentage_splits(Decimal("100"), [], expense_id=1)
        assert splits == []

    def test_percentage_single_member(self):
        data = [make_split_data(1, percentage=Decimal("100"))]
        splits = calculate_percentage_splits(Decimal("50"), data, expense_id=1)
        assert len(splits) == 1
        assert abs(splits[0].amount - Decimal("50")) < Decimal("0.01")


# ──────────────────────────────────────────────
# CUSTOM SPLIT TESTS
# ──────────────────────────────────────────────


class TestCustomSplits:
    def test_custom_exact_amounts(self):
        data = [
            make_split_data(1, amount=Decimal("70")),
            make_split_data(2, amount=Decimal("30")),
        ]
        splits = calculate_custom_splits(Decimal("100"), data, expense_id=1)
        assert len(splits) == 2
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01")

    def test_custom_three_way_split(self):
        data = [
            make_split_data(1, amount=Decimal("50")),
            make_split_data(2, amount=Decimal("30")),
            make_split_data(3, amount=Decimal("20")),
        ]
        splits = calculate_custom_splits(Decimal("100"), data, expense_id=1)
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01")
        amounts = {s.member_id: s.amount for s in splits}
        assert abs(amounts[1] - Decimal("50")) < Decimal("0.01")
        assert abs(amounts[2] - Decimal("30")) < Decimal("0.01")
        assert abs(amounts[3] - Decimal("20")) < Decimal("0.01")

    def test_custom_percentage_field_calculated(self):
        data = [
            make_split_data(1, amount=Decimal("25")),
            make_split_data(2, amount=Decimal("75")),
        ]
        splits = calculate_custom_splits(Decimal("100"), data, expense_id=1)
        pct_map = {s.member_id: s.percentage for s in splits}
        assert abs(pct_map[1] - Decimal("25")) < Decimal("0.01")
        assert abs(pct_map[2] - Decimal("75")) < Decimal("0.01")

    def test_custom_expense_id_assigned(self):
        data = [make_split_data(1, amount=Decimal("100"))]
        splits = calculate_custom_splits(Decimal("100"), data, expense_id=77)
        assert splits[0].expense_id == 77

    def test_custom_remainder_assigned_to_lucky_member(self):
        """When quantized amounts don't sum exactly, remainder is assigned: line 161 executed."""
        data = [
            make_split_data(1, amount=Decimal("5.005")),
            make_split_data(2, amount=Decimal("5.005")),
        ]
        # 5.005 → ROUND_HALF_EVEN → 5.00; remainder=0.01 → line 161 hit
        splits = calculate_custom_splits(Decimal("10.01"), data, expense_id=1)
        total = sum(s.amount for s in splits)
        assert total == Decimal("10.01")

    def test_custom_empty_list(self):
        splits = calculate_custom_splits(Decimal("100"), [], expense_id=1)
        assert splits == []

    def test_custom_single_member(self):
        data = [make_split_data(5, amount=Decimal("200"))]
        splits = calculate_custom_splits(Decimal("200"), data, expense_id=1)
        assert len(splits) == 1
        assert abs(splits[0].amount - Decimal("200")) < Decimal("0.01")


# ──────────────────────────────────────────────
# DISPATCH FUNCTION TESTS
# ──────────────────────────────────────────────


class TestCalculateSplitsDispatch:
    def test_dispatch_equal(self):
        splits = calculate_splits("equal", Decimal("100"), [], [1, 2], expense_id=1)
        assert len(splits) == 2
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01")

    def test_dispatch_percentage(self):
        data = [
            make_split_data(1, percentage=Decimal("60")),
            make_split_data(2, percentage=Decimal("40")),
        ]
        splits = calculate_splits("percentage", Decimal("100"), data, [], expense_id=1)
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01")

    def test_dispatch_custom(self):
        data = [
            make_split_data(1, amount=Decimal("40")),
            make_split_data(2, amount=Decimal("60")),
        ]
        splits = calculate_splits("custom", Decimal("100"), data, [], expense_id=1)
        total = sum(s.amount for s in splits)
        assert abs(total - Decimal("100")) < Decimal("0.01")

    def test_dispatch_unknown_raises(self):
        with pytest.raises(ValueError, match="Unknown split type"):
            calculate_splits("invalid", Decimal("100"), [], [1, 2], expense_id=1)

    def test_splits_always_sum_to_amount(self):
        """Property: all split types must sum to original amount."""
        amount = Decimal("137.77")

        # equal
        splits_equal = calculate_splits("equal", amount, [], [1, 2, 3], expense_id=1)
        assert abs(sum(s.amount for s in splits_equal) - amount) < Decimal("0.01")

        # percentage
        pdata = [
            make_split_data(1, percentage=Decimal("33.33")),
            make_split_data(2, percentage=Decimal("33.33")),
            make_split_data(3, percentage=Decimal("33.34")),
        ]
        splits_pct = calculate_splits("percentage", amount, pdata, [], expense_id=1)
        assert abs(sum(s.amount for s in splits_pct) - amount) < Decimal("0.01")

        # custom (approximately — we use rough amounts here to avoid validation complexity)
        cdata = [
            make_split_data(1, amount=Decimal("50")),
            make_split_data(2, amount=Decimal("87.77")),
        ]
        splits_custom = calculate_splits("custom", Decimal("137.77"), cdata, [], expense_id=1)
        assert abs(sum(s.amount for s in splits_custom) - Decimal("137.77")) < Decimal("0.01")
