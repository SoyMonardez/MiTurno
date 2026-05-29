"""add recordatorio_turno enums (turno_proximo / recordatorio_turno)

Revision ID: a1b2c3d4e5f6
Revises: 3ec3c9f48b73
Create Date: 2026-05-29

Agrega los valores de enum usados por el recordatorio automático 24 h antes del turno.
Idempotente: si ya existen (se agregaron en runtime), no falla.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "3ec3c9f48b73"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE tiporecordatorio ADD VALUE IF NOT EXISTS 'turno_proximo'")
    op.execute("ALTER TYPE tiponotificacion ADD VALUE IF NOT EXISTS 'recordatorio_turno'")


def downgrade() -> None:
    # Postgres no permite quitar valores de un enum de forma simple; no-op.
    pass
