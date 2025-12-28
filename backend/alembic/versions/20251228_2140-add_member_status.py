"""add_member_status_and_invitation_fields

Revision ID: add_member_status
Revises: 626b451135c0
Create Date: 2025-12-28 21:40:00

Adds status field (active/pending/placeholder) to trip_members,
replacing is_fictional. Also adds invited_email and invited_at fields.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_member_status"
down_revision = "626b451135c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns
    op.add_column(
        "trip_members",
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="active",
        ),
    )
    op.add_column(
        "trip_members",
        sa.Column("invited_email", sa.String(255), nullable=True),
    )
    op.add_column(
        "trip_members",
        sa.Column("invited_at", sa.DateTime(), nullable=True),
    )

    # Migrate existing data: is_fictional=True -> status='placeholder'
    op.execute("""
        UPDATE trip_members 
        SET status = 'placeholder' 
        WHERE is_fictional = true
    """)

    # Migrate existing data: is_fictional=False -> status='active'
    op.execute("""
        UPDATE trip_members 
        SET status = 'active' 
        WHERE is_fictional = false
    """)

    # Drop the old is_fictional column
    op.drop_column("trip_members", "is_fictional")

    # Add index on status for efficient queries
    op.create_index("idx_trip_members_status", "trip_members", ["status"])


def downgrade() -> None:
    # Drop index
    op.drop_index("idx_trip_members_status", "trip_members")

    # Re-add is_fictional column
    op.add_column(
        "trip_members",
        sa.Column("is_fictional", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Migrate data back
    op.execute("""
        UPDATE trip_members 
        SET is_fictional = true 
        WHERE status = 'placeholder'
    """)
    op.execute("""
        UPDATE trip_members 
        SET is_fictional = false 
        WHERE status IN ('active', 'pending')
    """)

    # Drop new columns
    op.drop_column("trip_members", "invited_at")
    op.drop_column("trip_members", "invited_email")
    op.drop_column("trip_members", "status")
