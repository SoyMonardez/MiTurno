"""add_plan_to_negocios

Revision ID: a3b4c5d6e7f8
Revises: 7248dd072082
Create Date: 2026-06-04 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "7248dd072082"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "negocios",
        sa.Column("plan", sa.String(20), nullable=False, server_default="pro"),
    )


def downgrade() -> None:
    op.drop_column("negocios", "plan")
