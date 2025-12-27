"""Remove expense_date column from expenses

Revision ID: c2d5a1b4d9f0
Revises: 8c26542e6988
Create Date: 2025-12-27 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c2d5a1b4d9f0"
down_revision: Union[str, None] = "c3d4e5f6g7h8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("expenses", "expense_date")


def downgrade() -> None:
    op.add_column("expenses", sa.Column("expense_date", sa.Date(), nullable=True))
    op.execute(
        "UPDATE expenses SET expense_date = DATE(created_at) WHERE expense_date IS NULL"
    )
    op.alter_column("expenses", "expense_date", nullable=False)
