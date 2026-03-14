"""
Tests for schema validation edge cases.

Covers:
- ExpenseCreate: splits not summing to amount, percentages not summing to 100,
  invalid currency codes, invalid split types, expense_type values
- TripCreate: date validation, currency validation, empty name
- SplitCreate: both amount and percentage provided
"""

import os
import pytest

os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from pydantic import ValidationError
from decimal import Decimal
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, SplitCreate
from app.schemas.trip import TripCreate, TripUpdate


# ──────────────────────────────────────────────
# SplitCreate TESTS
# ──────────────────────────────────────────────


class TestSplitCreateValidation:
    def test_valid_split_with_amount(self):
        s = SplitCreate(member_id=1, amount=Decimal("50"))
        assert s.amount == Decimal("50")

    def test_valid_split_with_percentage(self):
        s = SplitCreate(member_id=1, percentage=Decimal("50"))
        assert s.percentage == Decimal("50")

    def test_valid_split_no_amount_no_percentage(self):
        """For equal splits, no amount or percentage needed."""
        s = SplitCreate(member_id=1)
        assert s.amount is None
        assert s.percentage is None

    def test_both_amount_and_percentage_raises(self):
        """Providing both amount and percentage should raise ValidationError."""
        with pytest.raises(ValidationError, match="either amount or percentage"):
            SplitCreate(member_id=1, amount=Decimal("50"), percentage=Decimal("50"))

    def test_negative_amount_rejected(self):
        with pytest.raises(ValidationError):
            SplitCreate(member_id=1, amount=Decimal("-10"))

    def test_percentage_over_100_rejected(self):
        with pytest.raises(ValidationError):
            SplitCreate(member_id=1, percentage=Decimal("101"))

    def test_negative_percentage_rejected(self):
        with pytest.raises(ValidationError):
            SplitCreate(member_id=1, percentage=Decimal("-5"))


# ──────────────────────────────────────────────
# ExpenseCreate TESTS
# ──────────────────────────────────────────────


class TestExpenseCreateValidation:
    def _make_expense(self, **kwargs):
        defaults = {
            "description": "Test",
            "amount": Decimal("100"),
            "currency": "USD",
            "paid_by_member_id": 1,
            "split_type": "equal",
        }
        defaults.update(kwargs)
        return defaults

    def test_valid_equal_split(self):
        data = ExpenseCreate(**self._make_expense())
        assert data.split_type == "equal"

    def test_zero_amount_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(**self._make_expense(amount=Decimal("0")))

    def test_negative_amount_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(**self._make_expense(amount=Decimal("-10")))

    def test_invalid_currency_rejected(self):
        with pytest.raises(ValidationError, match="not supported"):
            ExpenseCreate(**self._make_expense(currency="XYZ"))

    def test_short_currency_code_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(**self._make_expense(currency="US"))

    def test_long_currency_code_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(**self._make_expense(currency="USDX"))

    def test_invalid_split_type_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(**self._make_expense(split_type="random"))

    def test_percentage_splits_without_list_rejected(self):
        """percentage split type requires splits list."""
        with pytest.raises(ValidationError, match="required"):
            ExpenseCreate(**self._make_expense(split_type="percentage"))

    def test_custom_splits_without_list_rejected(self):
        """custom split type requires splits list."""
        with pytest.raises(ValidationError, match="required"):
            ExpenseCreate(**self._make_expense(split_type="custom"))

    def test_percentage_not_summing_to_100_rejected(self):
        """percentage splits that don't sum to 100 are rejected."""
        splits = [
            SplitCreate(member_id=1, percentage=Decimal("40")),
            SplitCreate(member_id=2, percentage=Decimal("40")),  # total = 80, not 100
        ]
        with pytest.raises(ValidationError, match="100"):
            ExpenseCreate(**self._make_expense(split_type="percentage", splits=splits))

    def test_percentage_summing_to_100_accepted(self):
        splits = [
            SplitCreate(member_id=1, percentage=Decimal("60")),
            SplitCreate(member_id=2, percentage=Decimal("40")),
        ]
        data = ExpenseCreate(**self._make_expense(split_type="percentage", splits=splits))
        assert len(data.splits) == 2

    def test_custom_splits_not_summing_to_amount_rejected(self):
        """Custom splits where amounts don't sum to expense amount are rejected."""
        splits = [
            SplitCreate(member_id=1, amount=Decimal("30")),
            SplitCreate(member_id=2, amount=Decimal("30")),  # total = 60, not 100
        ]
        with pytest.raises(ValidationError, match="sum"):
            ExpenseCreate(**self._make_expense(split_type="custom", splits=splits))

    def test_custom_splits_summing_correctly_accepted(self):
        splits = [
            SplitCreate(member_id=1, amount=Decimal("70")),
            SplitCreate(member_id=2, amount=Decimal("30")),
        ]
        data = ExpenseCreate(**self._make_expense(split_type="custom", splits=splits))
        assert len(data.splits) == 2

    def test_description_trimmed(self):
        """Whitespace in description is trimmed."""
        data = ExpenseCreate(**self._make_expense(description="  Dinner  "))
        assert data.description == "Dinner"

    def test_empty_description_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(**self._make_expense(description="   "))

    def test_currency_normalized_to_uppercase(self):
        data = ExpenseCreate(**self._make_expense(currency="usd"))
        assert data.currency == "USD"

    def test_category_normalized_to_lowercase(self):
        data = ExpenseCreate(**self._make_expense(category="FOOD"))
        assert data.category == "food"

    def test_invalid_expense_type_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(**self._make_expense(expense_type="gift"))

    def test_valid_expense_type_settlement(self):
        data = ExpenseCreate(**self._make_expense(expense_type="settlement"))
        assert data.expense_type == "settlement"


# ──────────────────────────────────────────────
# TripCreate TESTS
# ──────────────────────────────────────────────


class TestTripCreateValidation:
    def test_valid_minimal_trip(self):
        t = TripCreate(name="My Trip", base_currency="USD")
        assert t.name == "My Trip"
        assert t.base_currency == "USD"

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            TripCreate(name="", base_currency="USD")

    def test_whitespace_name_rejected(self):
        with pytest.raises(ValidationError):
            TripCreate(name="   ", base_currency="USD")

    def test_name_trimmed(self):
        t = TripCreate(name="  Tokyo Trip  ", base_currency="USD")
        assert t.name == "Tokyo Trip"

    def test_invalid_currency_rejected(self):
        with pytest.raises(ValidationError, match="not supported"):
            TripCreate(name="Trip", base_currency="XYZ")

    def test_currency_normalized_to_uppercase(self):
        t = TripCreate(name="Trip", base_currency="usd")
        assert t.base_currency == "USD"

    def test_end_before_start_rejected(self):
        with pytest.raises(ValidationError, match="before start"):
            TripCreate(
                name="Trip",
                base_currency="USD",
                start_date="2025-06-10",
                end_date="2025-06-01",
            )

    def test_valid_dates_accepted(self):
        t = TripCreate(
            name="Trip",
            base_currency="USD",
            start_date="2025-06-01",
            end_date="2025-06-10",
        )
        assert t.start_date is not None
        assert t.end_date is not None

    def test_same_start_end_date_accepted(self):
        """Same start and end date is valid."""
        t = TripCreate(
            name="Day Trip",
            base_currency="USD",
            start_date="2025-06-01",
            end_date="2025-06-01",
        )
        assert t.start_date == t.end_date

    def test_no_dates_accepted(self):
        """Trip without dates is valid."""
        t = TripCreate(name="Undated Trip", base_currency="USD")
        assert t.start_date is None
        assert t.end_date is None


# ──────────────────────────────────────────────
# TripUpdate TESTS
# ──────────────────────────────────────────────


class TestTripUpdateValidation:
    def test_valid_name_update(self):
        u = TripUpdate(name="New Name")
        assert u.name == "New Name"

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            TripUpdate(name="")

    def test_invalid_currency_rejected(self):
        with pytest.raises(ValidationError):
            TripUpdate(base_currency="BAD")

    def test_currency_uppercase(self):
        u = TripUpdate(base_currency="eur")
        assert u.base_currency == "EUR"

    def test_all_none_valid(self):
        """TripUpdate with all None fields is valid (no-op update)."""
        u = TripUpdate()
        assert u.name is None


# ──────────────────────────────────────────────
# ExpenseUpdate TESTS
# ──────────────────────────────────────────────


class TestExpenseUpdateValidation:
    def test_valid_partial_update(self):
        u = ExpenseUpdate(description="New desc")
        assert u.description == "New desc"

    def test_zero_amount_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseUpdate(amount=Decimal("0"))

    def test_invalid_currency_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseUpdate(currency="XYZ")

    def test_invalid_split_type_rejected(self):
        with pytest.raises(ValidationError):
            ExpenseUpdate(split_type="random")

    def test_percentage_type_requires_splits(self):
        with pytest.raises(ValidationError):
            ExpenseUpdate(split_type="percentage")

    def test_custom_type_requires_splits(self):
        with pytest.raises(ValidationError):
            ExpenseUpdate(split_type="custom")

    def test_currency_non_alpha_rejected(self):
        """Currency with numbers raises ValidationError."""
        with pytest.raises(ValidationError):
            ExpenseUpdate(amount=Decimal("50"), currency="1US")

    def test_category_strips_to_empty_becomes_none(self):
        """Category with only whitespace is normalized to None."""
        e = ExpenseUpdate(category="   ")
        assert e.category is None

    def test_notes_strips_to_empty_becomes_none(self):
        """Notes with only whitespace is normalized to None."""
        e = ExpenseUpdate(notes="   ")
        assert e.notes is None

    def test_description_whitespace_rejected(self):
        """Description that is only whitespace raises ValidationError."""
        with pytest.raises(ValidationError):
            ExpenseUpdate(description="   ")

    def test_currency_too_short_rejected(self):
        """Currency code shorter than 3 chars raises ValidationError in update."""
        with pytest.raises(ValidationError):
            ExpenseUpdate(amount=Decimal("50"), currency="US")

    def test_percentage_splits_sum_validated_in_update(self):
        """Percentage splits not summing to 100 raise ValidationError on update."""
        with pytest.raises(ValidationError):
            ExpenseUpdate(
                split_type="percentage",
                splits=[
                    SplitCreate(percentage=40),
                    SplitCreate(percentage=40),
                ],
            )

    def test_custom_splits_sum_validated_in_update(self):
        """Custom splits not matching amount raise ValidationError on update."""
        with pytest.raises(ValidationError):
            ExpenseUpdate(
                amount=Decimal("100"),
                split_type="custom",
                splits=[
                    SplitCreate(amount=Decimal("40")),
                    SplitCreate(amount=Decimal("40")),
                ],
            )


# ──────────────────────────────────────────────
# ExpenseCreate additional edge cases
# ──────────────────────────────────────────────


class TestExpenseCreateAdditionalEdgeCases:
    def test_currency_non_alpha_rejected(self):
        """Currency code with non-alpha characters raises ValidationError."""
        with pytest.raises(ValidationError):
            ExpenseCreate(
                description="Test",
                amount=Decimal("100"),
                currency="1US",
                paid_by_member_id=1,
                split_type="equal",
            )

    def test_category_whitespace_becomes_none(self):
        """Category with only whitespace is set to None."""
        e = ExpenseCreate(
            description="Test",
            amount=Decimal("100"),
            currency="USD",
            paid_by_member_id=1,
            split_type="equal",
            category="   ",
        )
        assert e.category is None

    def test_notes_whitespace_becomes_none(self):
        """Notes with only whitespace is set to None."""
        e = ExpenseCreate(
            description="Test",
            amount=Decimal("100"),
            currency="USD",
            paid_by_member_id=1,
            split_type="equal",
            notes="   ",
        )
        assert e.notes is None
