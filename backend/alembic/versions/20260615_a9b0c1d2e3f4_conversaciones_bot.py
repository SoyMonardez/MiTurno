"""Conversaciones del bot (agendamiento por WhatsApp).

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
Create Date: 2026-06-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "f8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conversaciones_bot",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("negocio_id", sa.Integer(), sa.ForeignKey("negocios.id"), nullable=False),
        sa.Column("telefono", sa.String(40), nullable=False),
        sa.Column("estado", sa.String(30), nullable=False),
        sa.Column("datos", sa.Text(), nullable=True),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("negocio_id", "telefono", name="uq_conversacion_negocio_tel"),
    )
    op.create_index("ix_conversaciones_bot_negocio_id", "conversaciones_bot", ["negocio_id"])
    op.create_index("ix_conversaciones_bot_telefono", "conversaciones_bot", ["telefono"])

    # RLS: solo el backend (bypass) opera estas filas; igual la forzamos.
    op.execute("ALTER TABLE conversaciones_bot ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE conversaciones_bot FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY conversaciones_bot_all ON conversaciones_bot FOR ALL USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS conversaciones_bot_all ON conversaciones_bot;")
    op.drop_table("conversaciones_bot")
