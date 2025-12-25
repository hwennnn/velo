"""add trip member balance fields

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2025-12-25 17:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Numeric

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add total_owed_base column (default 0.0)
    op.add_column(
        "trip_members",
        sa.Column(
            "total_owed_base", Numeric(12, 2), nullable=False, server_default="0.0"
        ),
    )

    # Add total_owed_to_base column (default 0.0)
    op.add_column(
        "trip_members",
        sa.Column(
            "total_owed_to_base", Numeric(12, 2), nullable=False, server_default="0.0"
        ),
    )

    # Note: Balance fields are initialized to 0.0
    # Actual balance calculation will be done by the application
    # when debts are created/updated/deleted


def downgrade() -> None:
    # Remove the columns
    op.drop_column("trip_members", "total_owed_to_base")
    op.drop_column("trip_members", "total_owed_base")
