"""Base de conocimiento del bot (anti-alucinación) + feedback/quejas de clientes.

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, None] = "a9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("negocios", sa.Column("bot_conocimiento", sa.String(6000), nullable=True))

    op.create_table(
        "feedback_cliente",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("negocio_id", sa.Integer(), sa.ForeignKey("negocios.id"), nullable=False),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes.id"), nullable=True),
        sa.Column("telefono", sa.String(40), nullable=True),
        sa.Column("nombre", sa.String(120), nullable=True),
        sa.Column("mensaje", sa.Text(), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False, server_default="queja"),
        sa.Column("atendido", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_feedback_cliente_negocio_id", "feedback_cliente", ["negocio_id"])

    op.execute("ALTER TABLE feedback_cliente ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE feedback_cliente FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY feedback_cliente_all ON feedback_cliente FOR ALL USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS feedback_cliente_all ON feedback_cliente;")
    op.drop_table("feedback_cliente")
    op.drop_column("negocios", "bot_conocimiento")
