"""Módulos Premium: roles de profesional, comisiones, ficha técnica,
lista de espera, método de pago y gateway de WhatsApp.

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-06-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Asimetría de Alembic con enums de PostgreSQL:
#  - op.add_column NO crea el tipo enum → hay que crearlo a mano antes.
#  - op.create_table SÍ crea el tipo enum de sus columnas automáticamente.
# Por eso tipocomision/metodopago (usados en add_column) se crean explícitamente,
# y bloquehorario/estadolistaespera (usados en create_table) los crea la tabla.
tipocomision = sa.Enum("porcentaje_corte", "fijo_local", name="tipocomision")
metodopago = sa.Enum("efectivo", "transferencia", "mercado_pago", name="metodopago")
bloquehorario = sa.Enum("manana", "tarde", name="bloquehorario")
estadolistaespera = sa.Enum(
    "pendiente", "notificado", "confirmado", "expirado", "cancelado",
    name="estadolistaespera",
)


def upgrade() -> None:
    # Nuevo rol para el login individual del profesional (no se usa en esta
    # misma transacción, así que el ADD VALUE es seguro).
    op.execute("ALTER TYPE rolusuario ADD VALUE IF NOT EXISTS 'profesional'")

    # add_column no crea el tipo enum: lo creamos antes (checkfirst evita choques).
    bind = op.get_bind()
    tipocomision.create(bind, checkfirst=True)
    metodopago.create(bind, checkfirst=True)

    # profesionales: cuenta de acceso + regla de comisión
    op.add_column(
        "profesionales",
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True),
    )
    op.add_column(
        "profesionales",
        sa.Column(
            "tipo_comision",
            tipocomision,
            nullable=False,
            server_default="porcentaje_corte",
        ),
    )
    op.add_column(
        "profesionales",
        sa.Column("valor_comision", sa.Numeric(5, 2), nullable=False, server_default="0"),
    )

    # reservas: método de pago y split financiero
    op.add_column("reservas", sa.Column("metodo_pago", metodopago, nullable=True))
    op.add_column("reservas", sa.Column("pago_profesional", sa.Numeric(10, 2), nullable=True))
    op.add_column("reservas", sa.Column("pago_local", sa.Numeric(10, 2), nullable=True))

    # negocios: instancia del gateway de WhatsApp (Evolution API)
    op.add_column(
        "negocios", sa.Column("whatsapp_instancia", sa.String(120), nullable=True)
    )
    op.create_unique_constraint(
        "uq_negocios_whatsapp_instancia", "negocios", ["whatsapp_instancia"]
    )

    # Ficha técnica e historial del cliente
    op.create_table(
        "clientes_historial",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("negocio_id", sa.Integer(), sa.ForeignKey("negocios.id"), nullable=False),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes.id"), nullable=False),
        sa.Column("profesional_id", sa.Integer(), sa.ForeignKey("profesionales.id"), nullable=True),
        sa.Column("notas_estilo", sa.Text(), nullable=False),
        sa.Column(
            "fecha_actualizacion",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_clientes_historial_negocio_id", "clientes_historial", ["negocio_id"])
    op.create_index("ix_clientes_historial_cliente_id", "clientes_historial", ["cliente_id"])

    # Lista de espera
    op.create_table(
        "lista_espera",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("negocio_id", sa.Integer(), sa.ForeignKey("negocios.id"), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("telefono", sa.String(40), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("bloque", bloquehorario, nullable=False),
        sa.Column("profesional_id", sa.Integer(), sa.ForeignKey("profesionales.id"), nullable=True),
        sa.Column(
            "estado", estadolistaespera, nullable=False, server_default="pendiente"
        ),
        sa.Column("oferta_inicio", sa.DateTime(timezone=True), nullable=True),
        sa.Column("oferta_profesional_id", sa.Integer(), sa.ForeignKey("profesionales.id"), nullable=True),
        sa.Column("notificado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_lista_espera_negocio_id", "lista_espera", ["negocio_id"])
    op.create_index("ix_lista_espera_telefono", "lista_espera", ["telefono"])
    op.create_index("ix_lista_espera_fecha", "lista_espera", ["fecha"])

    # ── RLS de las tablas nuevas ──────────────────────────────────────────
    for table in ["clientes_historial", "lista_espera"]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

    # Historial: el admin del negocio y los profesionales del negocio
    # (identificados por su usuario vinculado) pueden leer y escribir.
    op.execute("""
        CREATE POLICY clientes_historial_all ON clientes_historial FOR ALL USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
            OR EXISTS (
                SELECT 1 FROM profesionales p
                WHERE p.negocio_id = clientes_historial.negocio_id
                AND p.usuario_id IS NOT NULL
                AND p.usuario_id::text = current_setting('app.current_user_id', true)
            )
        );
    """)

    # Lista de espera: solo backend (bypass), super-admin y admin del negocio.
    op.execute("""
        CREATE POLICY lista_espera_all ON lista_espera FOR ALL USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)

    # ── RLS para el rol profesional ───────────────────────────────────────
    # El profesional solo ve SUS reservas (vínculo profesionales.usuario_id).
    op.execute("""
        CREATE POLICY reservas_select_profesional ON reservas FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM profesionales p
                WHERE p.id = reservas.profesional_id
                AND p.usuario_id IS NOT NULL
                AND p.usuario_id::text = current_setting('app.current_user_id', true)
            )
        );
    """)
    # Y los clientes de su negocio (para nombres y ficha técnica).
    op.execute("""
        CREATE POLICY clientes_select_profesional ON clientes FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM profesionales p
                WHERE p.negocio_id = clientes.negocio_id
                AND p.usuario_id IS NOT NULL
                AND p.usuario_id::text = current_setting('app.current_user_id', true)
            )
        );
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS clientes_select_profesional ON clientes;")
    op.execute("DROP POLICY IF EXISTS reservas_select_profesional ON reservas;")
    op.execute("DROP POLICY IF EXISTS lista_espera_all ON lista_espera;")
    op.execute("DROP POLICY IF EXISTS clientes_historial_all ON clientes_historial;")

    op.drop_table("lista_espera")
    op.drop_table("clientes_historial")

    op.drop_constraint("uq_negocios_whatsapp_instancia", "negocios", type_="unique")
    op.drop_column("negocios", "whatsapp_instancia")

    op.drop_column("reservas", "pago_local")
    op.drop_column("reservas", "pago_profesional")
    op.drop_column("reservas", "metodo_pago")

    op.drop_column("profesionales", "valor_comision")
    op.drop_column("profesionales", "tipo_comision")
    op.drop_column("profesionales", "usuario_id")

    bind = op.get_bind()
    estadolistaespera.drop(bind, checkfirst=True)
    bloquehorario.drop(bind, checkfirst=True)
    metodopago.drop(bind, checkfirst=True)
    tipocomision.drop(bind, checkfirst=True)
    # El valor 'profesional' de rolusuario no se puede quitar (limitación de PG).
