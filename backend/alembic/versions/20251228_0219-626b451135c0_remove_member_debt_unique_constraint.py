"""remove_member_debt_unique_constraint

Revision ID: 626b451135c0
Revises: c2d5a1b4d9f0
Create Date: 2025-12-28 02:19:38.986288

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '626b451135c0'
down_revision: Union[str, None] = 'c2d5a1b4d9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the unique constraint
    op.drop_constraint('uq_member_debts_trip_debtor_creditor_currency', 'member_debts', type_='unique')


def downgrade() -> None:
    # Add back the unique constraint
    op.create_unique_constraint('uq_member_debts_trip_debtor_creditor_currency', 'member_debts', ['trip_id', 'debtor_member_id', 'creditor_member_id', 'currency'])

