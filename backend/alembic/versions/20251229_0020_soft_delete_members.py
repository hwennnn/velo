"""Add soft-delete fields to trip_members

Revision ID: soft_delete_members
Revises: 20251228_2320-add_trip_invites
Create Date: 2025-12-29

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'soft_delete_members'
down_revision = 'add_trip_invites'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_deleted and deleted_at columns to trip_members
    op.add_column('trip_members', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('trip_members', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    
    # Create index for faster lookup of non-deleted members
    op.create_index('ix_trip_members_is_deleted', 'trip_members', ['is_deleted'], unique=False)


def downgrade():
    op.drop_index('ix_trip_members_is_deleted', table_name='trip_members')
    op.drop_column('trip_members', 'deleted_at')
    op.drop_column('trip_members', 'is_deleted')
