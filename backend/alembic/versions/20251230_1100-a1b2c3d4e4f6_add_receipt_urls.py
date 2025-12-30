"""add receipt_urls

Revision ID: a1b2c3d4e5f6
Revises: 357420a9a2c4
Create Date: 2025-12-30 11:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e4f6"
down_revision: Union[str, None] = "357420a9a2c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new receipt_urls column as JSON array
    op.add_column(
        "expenses",
        sa.Column("receipt_urls", sa.JSON(), nullable=True),
    )

    # Migrate existing receipt_url data to receipt_urls array
    # Using raw SQL for the data migration
    op.execute(
        """
        UPDATE expenses
        SET receipt_urls = json_build_array(receipt_url)
        WHERE receipt_url IS NOT NULL
        """
    )

    # Drop old receipt_url column
    op.drop_column("expenses", "receipt_url")


def downgrade() -> None:
    # Add back receipt_url column
    op.add_column(
        "expenses",
        sa.Column("receipt_url", sa.String(length=500), nullable=True),
    )

    # Migrate receipt_urls back to receipt_url (take first URL)
    op.execute(
        """
        UPDATE expenses
        SET receipt_url = receipt_urls->>0
        WHERE receipt_urls IS NOT NULL AND json_array_length(receipt_urls) > 0
        """
    )

    # Drop receipt_urls column
    op.drop_column("expenses", "receipt_urls")
