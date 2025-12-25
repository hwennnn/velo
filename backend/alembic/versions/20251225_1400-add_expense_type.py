"""add expense_type field

Revision ID: 4b5c6d7e8f9a
Revises: 3a4b5c6d7e8f
Create Date: 2025-12-25 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b5c6d7e8f9a'
down_revision: Union[str, None] = '3a4b5c6d7e8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add expense_type column (default 'expense')
    # expense_type can be 'expense' or 'settlement'
    op.add_column('expenses', sa.Column('expense_type', sa.String(20), nullable=False, server_default='expense'))


def downgrade() -> None:
    # Remove the column
    op.drop_column('expenses', 'expense_type')

