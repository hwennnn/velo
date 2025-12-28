"""add_trip_invites_table

Revision ID: add_trip_invites
Revises: add_member_status
Create Date: 2025-12-28 23:20:00

Adds trip_invites table for storing invite codes linked to trips.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_trip_invites"
down_revision = "add_member_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trip_invites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(16), nullable=False, unique=True),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
    )
    
    # Create indexes
    op.create_index("idx_trip_invites_code", "trip_invites", ["code"])
    op.create_index("idx_trip_invites_trip_id", "trip_invites", ["trip_id"])


def downgrade() -> None:
    op.drop_index("idx_trip_invites_trip_id", "trip_invites")
    op.drop_index("idx_trip_invites_code", "trip_invites")
    op.drop_table("trip_invites")
