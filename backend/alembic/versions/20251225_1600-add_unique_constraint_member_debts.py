"""add unique constraint to member debts

Revision ID: a1b2c3d4e5f6
Revises: 5c6d7e8f9a0b
Create Date: 2025-12-25 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '5c6d7e8f9a0b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add unique constraint to prevent duplicate debt records.
    
    Before adding the constraint, we need to consolidate any existing duplicates.
    """
    # First, consolidate duplicate debts by summing amounts
    # This SQL will merge duplicates into single records
    op.execute("""
        -- Create a temporary table with consolidated debts
        CREATE TEMPORARY TABLE temp_consolidated_debts AS
        SELECT 
            MIN(id) as id,
            trip_id,
            debtor_member_id,
            creditor_member_id,
            currency,
            SUM(amount) as amount,
            MAX(created_at) as created_at,
            MAX(updated_at) as updated_at,
            MAX(source_expense_id) as source_expense_id
        FROM member_debts
        GROUP BY trip_id, debtor_member_id, creditor_member_id, currency;
        
        -- Delete all existing debts
        DELETE FROM member_debts;
        
        -- Insert consolidated debts back
        INSERT INTO member_debts (id, trip_id, debtor_member_id, creditor_member_id, currency, amount, created_at, updated_at, source_expense_id)
        SELECT id, trip_id, debtor_member_id, creditor_member_id, currency, amount, created_at, updated_at, source_expense_id
        FROM temp_consolidated_debts
        WHERE amount >= 0.01;  -- Only keep non-zero debts
        
        -- Drop temporary table
        DROP TABLE temp_consolidated_debts;
    """)
    
    # Now add the unique constraint
    op.create_unique_constraint(
        'uq_member_debts_trip_debtor_creditor_currency',
        'member_debts',
        ['trip_id', 'debtor_member_id', 'creditor_member_id', 'currency']
    )


def downgrade() -> None:
    """Remove the unique constraint."""
    op.drop_constraint(
        'uq_member_debts_trip_debtor_creditor_currency',
        'member_debts',
        type_='unique'
    )

