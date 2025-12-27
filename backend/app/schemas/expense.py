"""Pydantic schemas for Expense API endpoints"""

from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from ..core.currencies import is_supported_currency


class SplitCreate(BaseModel):
    """Schema for creating a split"""

    member_id: int = Field(..., description="Trip member ID")
    amount: Optional[Decimal] = Field(
        None, ge=0, description="Amount owed (for custom split)"
    )
    percentage: Optional[Decimal] = Field(
        None, ge=0, le=100, description="Percentage (for percentage split)"
    )

    @model_validator(mode="after")
    def validate_split(self):
        """Validate that either amount or percentage is provided, not both"""
        if self.amount is not None and self.percentage is not None:
            raise ValueError("Provide either amount or percentage, not both")
        return self


class ExpenseCreate(BaseModel):
    """Schema for creating an expense"""

    description: str = Field(
        ..., min_length=1, max_length=200, description="Expense description"
    )
    amount: Decimal = Field(..., gt=0, description="Expense amount")
    currency: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
        description="Currency code (ISO 4217)",
    )
    paid_by_member_id: int = Field(..., description="Member who paid")
    category: Optional[str] = Field(
        None,
        max_length=50,
        description="Category (food, transport, accommodation, etc.)",
    )
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")
    receipt_url: Optional[str] = Field(
        None, max_length=500, description="Receipt image URL"
    )

    # Split information
    split_type: str = Field(
        default="equal", description="Split type: equal, percentage, custom"
    )
    splits: Optional[list[SplitCreate]] = Field(
        None, description="Custom/percentage splits"
    )

    # Expense type
    expense_type: str = Field(
        default="expense", description="Type: expense or settlement"
    )

    @model_validator(mode="after")
    def validate_expense_data(self):
        """Validate expense data"""
        # Clean and validate description
        if self.description:
            self.description = self.description.strip()
            if not self.description:
                raise ValueError("Description cannot be empty or just whitespace")

        # Validate and uppercase currency
        if self.currency:
            self.currency = self.currency.upper().strip()
            if len(self.currency) != 3:
                raise ValueError(
                    "Currency code must be exactly 3 characters (ISO 4217)"
                )
            if not self.currency.isalpha():
                raise ValueError("Currency code must contain only letters")
            if not is_supported_currency(self.currency):
                raise ValueError(f"Currency {self.currency} is not supported")

        # Clean category
        if self.category:
            self.category = self.category.strip().lower()
            if not self.category:
                self.category = None

        # Clean notes
        if self.notes:
            self.notes = self.notes.strip()
            if not self.notes:
                self.notes = None

        # Validate split type
        if self.split_type not in ["equal", "percentage", "custom"]:
            raise ValueError("Split type must be equal, percentage, or custom")

        # Validate expense type
        if self.expense_type not in ["expense", "settlement"]:
            raise ValueError("Expense type must be expense or settlement")

        # For custom and percentage splits, splits list is required
        if self.split_type in ["percentage", "custom"]:
            if not self.splits or len(self.splits) == 0:
                raise ValueError(
                    f"Splits list is required for {self.split_type} split type"
                )

        # Validate percentage splits sum to 100
        if self.split_type == "percentage" and self.splits:
            total_percentage = sum(split.percentage or 0 for split in self.splits)
            if abs(total_percentage - 100) > 0.01:  # Allow small floating point errors
                raise ValueError(
                    f"Percentage splits must sum to 100, got {total_percentage}"
                )

        # Validate custom splits sum to expense amount
        if self.split_type == "custom" and self.splits:
            total_amount = sum(split.amount or 0 for split in self.splits)
            if (
                abs(total_amount - self.amount) > 0.01
            ):  # Allow small floating point errors
                raise ValueError(
                    f"Custom split amounts must sum to expense amount {self.amount}, got {total_amount}"
                )

        return self

    class Config:
        json_schema_extra = {
            "example": {
                "description": "Dinner at sushi restaurant",
                "amount": "85.50",
                "currency": "SGD",
                "paid_by_member_id": 1,
                "category": "food",
                "split_type": "equal",
            }
        }


class ExpenseUpdate(BaseModel):
    """Schema for updating an expense"""

    description: Optional[str] = Field(None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(None, gt=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    paid_by_member_id: Optional[int] = None
    category: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)
    receipt_url: Optional[str] = Field(None, max_length=500)

    # Split information (optional - only if changing splits)
    split_type: Optional[str] = Field(
        None, description="Split type: equal, percentage, custom"
    )
    splits: Optional[list[SplitCreate]] = Field(
        None, description="Custom/percentage splits"
    )

    @model_validator(mode="after")
    def validate_expense_data(self):
        """Validate expense update data"""
        # Clean description
        if self.description is not None:
            self.description = self.description.strip()
            if not self.description:
                raise ValueError("Description cannot be empty or just whitespace")

        # Validate and uppercase currency
        if self.currency is not None:
            self.currency = self.currency.upper().strip()
            if len(self.currency) != 3:
                raise ValueError(
                    "Currency code must be exactly 3 characters (ISO 4217)"
                )
            if not self.currency.isalpha():
                raise ValueError("Currency code must contain only letters")
            if not is_supported_currency(self.currency):
                raise ValueError(f"Currency {self.currency} is not supported")

        # Clean category
        if self.category is not None:
            self.category = self.category.strip().lower()
            if not self.category:
                self.category = None

        # Clean notes
        if self.notes is not None:
            self.notes = self.notes.strip()
            if not self.notes:
                self.notes = None

        # Validate split type if provided
        if self.split_type is not None:
            if self.split_type not in ["equal", "percentage", "custom"]:
                raise ValueError("Split type must be equal, percentage, or custom")

            # For custom and percentage splits, splits list is required
            if self.split_type in ["percentage", "custom"]:
                if not self.splits or len(self.splits) == 0:
                    raise ValueError(
                        f"Splits list is required for {self.split_type} split type"
                    )

        # Validate percentage splits sum to 100
        if self.split_type == "percentage" and self.splits:
            total_percentage = sum(split.percentage or 0 for split in self.splits)
            if abs(total_percentage - 100) > 0.01:
                raise ValueError(
                    f"Percentage splits must sum to 100, got {total_percentage}"
                )

        # Validate custom splits sum to expense amount (if amount is provided)
        if self.split_type == "custom" and self.splits and self.amount:
            total_amount = sum(split.amount or 0 for split in self.splits)
            if abs(total_amount - self.amount) > 0.01:
                raise ValueError(
                    f"Custom split amounts must sum to expense amount {self.amount}, got {total_amount}"
                )

        return self


class SplitResponse(BaseModel):
    """Schema for split in responses"""

    id: int
    member_id: int
    member_nickname: str
    amount: Decimal
    percentage: Optional[Decimal] = None

    class Config:
        from_attributes = True


class ExpenseResponse(BaseModel):
    """Schema for expense in responses"""

    id: int
    trip_id: int
    description: str
    amount: Decimal
    currency: str
    exchange_rate_to_base: Decimal
    amount_in_base_currency: Decimal
    paid_by_member_id: int
    paid_by_nickname: str
    category: Optional[str] = None
    notes: Optional[str] = None
    receipt_url: Optional[str] = None
    expense_type: str = "expense"  # Default to 'expense' for backward compatibility
    splits: list[SplitResponse]
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExpenseListResponse(BaseModel):
    """Schema for expense list response"""

    expenses: list[ExpenseResponse]
    total: int
    page: int = 1
    page_size: int = 20
