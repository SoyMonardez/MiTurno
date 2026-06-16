"""Canal de recordatorios automáticos por negocio (email / whatsapp / ambos).

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-06-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "negocios",
        sa.Column("recordatorios_canal", sa.String(20), nullable=False, server_default="email"),
    )


def downgrade() -> None:
    op.drop_column("negocios", "recordatorios_canal")
