"""Respuestas personalizadas del bot de WhatsApp por negocio.

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-06-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("negocios", sa.Column("bot_respuestas", sa.String(4000), nullable=True))


def downgrade() -> None:
    op.drop_column("negocios", "bot_respuestas")
