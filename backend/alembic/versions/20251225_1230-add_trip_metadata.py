"""add trip metadata

Revision ID: 3a4b5c6d7e8f
Revises: 45435a9d7d71
Create Date: 2025-12-25 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Numeric


# revision identifiers, used by Alembic.
revision: str = '3a4b5c6d7e8f'
down_revision: Union[str, None] = '45435a9d7d71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add total_spent column (default 0.0)
    op.add_column('trips', sa.Column('total_spent', Numeric(
        12, 2), nullable=False, server_default='0.0'))

    # Add expense_count column (default 0)
    op.add_column('trips', sa.Column('expense_count',
                  sa.Integer(), nullable=False, server_default='0'))

    # Update existing trips with actual values
    op.execute("""
        UPDATE trips t
        SET 
            total_spent = COALESCE((
                SELECT SUM(e.amount * e.exchange_rate_to_base)
                FROM expenses e
                WHERE e.trip_id = t.id
            ), 0.0),
            expense_count = COALESCE((
                SELECT COUNT(*)
                FROM expenses e
                WHERE e.trip_id = t.id
            ), 0)
    """)


def downgrade() -> None:
    # Remove the columns
    op.drop_column('trips', 'expense_count')
    op.drop_column('trips', 'total_spent')
