"""add_mapa_url_to_negocios

Revision ID: 5bda21a9fc16
Revises: 0bad9fc05dd3
Create Date: 2026-05-29 02:04:39.300445

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5bda21a9fc16'
down_revision: Union[str, None] = '0bad9fc05dd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('negocios', sa.Column('mapa_url', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column('negocios', 'mapa_url')
