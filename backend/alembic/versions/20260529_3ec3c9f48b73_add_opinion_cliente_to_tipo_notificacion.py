"""add_opinion_cliente_to_tipo_notificacion

Revision ID: 3ec3c9f48b73
Revises: 5bda21a9fc16
Create Date: 2026-05-29 02:30:48.139425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ec3c9f48b73'
down_revision: Union[str, None] = '5bda21a9fc16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Agregar valor 'opinion_cliente' al tipo enum 'tiponotificacion' en Postgres.
    # Usamos commit asíncrono o controlamos la transacción porque ALTER TYPE ADD VALUE no puede ejecutarse dentro de un bloque de transacción.
    op.execute("COMMIT")
    op.execute("ALTER TYPE tiponotificacion ADD VALUE 'opinion_cliente'")


def downgrade() -> None:
    pass
