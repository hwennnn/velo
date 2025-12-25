"""create member_debts table

Revision ID: 5c6d7e8f9a0b
Revises: 3484846916ab
Create Date: 2025-12-25 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Numeric


# revision identifiers, used by Alembic.
revision: str = '5c6d7e8f9a0b'
down_revision: Union[str, None] = '3484846916ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create member_debts table
    op.create_table(
        'member_debts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('trip_id', sa.Integer(), nullable=False),
        sa.Column('debtor_member_id', sa.Integer(), nullable=False),
        sa.Column('creditor_member_id', sa.Integer(), nullable=False),
        sa.Column('amount', Numeric(12, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('source_expense_id', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ),
        sa.ForeignKeyConstraint(['debtor_member_id'], ['trip_members.id'], ),
        sa.ForeignKeyConstraint(['creditor_member_id'], ['trip_members.id'], ),
        sa.ForeignKeyConstraint(['source_expense_id'], ['expenses.id'], ),
    )
    
    # Create indexes for efficient queries
    op.create_index('idx_member_debts_trip', 'member_debts', ['trip_id'])
    op.create_index('idx_member_debts_debtor', 'member_debts', ['debtor_member_id'])
    op.create_index('idx_member_debts_creditor', 'member_debts', ['creditor_member_id'])
    op.create_index('idx_member_debts_trip_currency', 'member_debts', ['trip_id', 'currency'])
    
    # Populate member_debts from existing expenses
    # This calculates all current debts from the expenses table
    op.execute("""
        INSERT INTO member_debts (trip_id, debtor_member_id, creditor_member_id, amount, currency, source_expense_id)
        SELECT 
            e.trip_id,
            s.member_id as debtor_member_id,
            e.paid_by_member_id as creditor_member_id,
            (s.amount / e.exchange_rate_to_base) as amount,
            e.currency,
            e.id as source_expense_id
        FROM expenses e
        JOIN splits s ON s.expense_id = e.id
        WHERE 
            e.expense_type = 'expense'
            AND s.member_id != e.paid_by_member_id
            AND s.amount > 0.01
        ON CONFLICT DO NOTHING
    """)
    
    # Consolidate debts (sum up multiple debts between same pair in same currency)
    op.execute("""
        WITH consolidated AS (
            SELECT 
                trip_id,
                debtor_member_id,
                creditor_member_id,
                currency,
                SUM(amount) as total_amount,
                MIN(id) as keep_id,
                MIN(created_at) as created_at,
                MAX(updated_at) as updated_at
            FROM member_debts
            GROUP BY trip_id, debtor_member_id, creditor_member_id, currency
            HAVING COUNT(*) > 1
        )
        UPDATE member_debts md
        SET amount = c.total_amount,
            updated_at = c.updated_at
        FROM consolidated c
        WHERE md.id = c.keep_id
    """)
    
    # Delete duplicate records (keep only the consolidated ones)
    op.execute("""
        DELETE FROM member_debts
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM member_debts
            GROUP BY trip_id, debtor_member_id, creditor_member_id, currency
        )
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_member_debts_trip_currency', 'member_debts')
    op.drop_index('idx_member_debts_creditor', 'member_debts')
    op.drop_index('idx_member_debts_debtor', 'member_debts')
    op.drop_index('idx_member_debts_trip', 'member_debts')
    
    # Drop table
    op.drop_table('member_debts')

