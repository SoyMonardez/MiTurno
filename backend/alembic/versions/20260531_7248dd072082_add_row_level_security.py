"""add_row_level_security

Revision ID: 7248dd072082
Revises: b2c3d4e5f6a7
Create Date: 2026-05-31 00:38:06.519963

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7248dd072082'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable RLS on all tables and force it
    tables = [
        "negocios",
        "categorias",
        "portafolio_imagenes",
        "profesionales",
        "usuarios",
        "clientes",
        "excepciones_agenda",
        "horarios_recurrentes",
        "servicios",
        "profesional_servicio",
        "reservas",
        "notificacion_logs",
        "recordatorios_programados",
        "resenas",
        "reserva_items",
        "registros_acceso"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

    # 2. Define Policies
    # negocios
    op.execute("""
        CREATE POLICY negocios_select ON negocios FOR SELECT USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR activo = true
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)
    op.execute("""
        CREATE POLICY negocios_insert ON negocios FOR INSERT WITH CHECK (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
        );
    """)
    op.execute("""
        CREATE POLICY negocios_update ON negocios FOR UPDATE USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)
    op.execute("""
        CREATE POLICY negocios_delete ON negocios FOR DELETE USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)

    # categorias, servicios, profesionales, portafolio_imagenes
    for tbl in ["categorias", "servicios", "profesionales", "portafolio_imagenes"]:
        op.execute(f"""
            CREATE POLICY {tbl}_select ON {tbl} FOR SELECT USING (
                true
            );
        """)
        op.execute(f"""
            CREATE POLICY {tbl}_write ON {tbl} FOR ALL USING (
                current_setting('app.bypass_rls', true) = 'true'
                OR current_setting('app.current_user_rol', true) = 'super_admin'
                OR (
                    current_setting('app.current_user_rol', true) = 'admin'
                    AND negocio_id::text = current_setting('app.current_negocio_id', true)
                )
            );
        """)

    # exceptions, recurring schedules
    for tbl in ["excepciones_agenda", "horarios_recurrentes"]:
        op.execute(f"""
            CREATE POLICY {tbl}_select ON {tbl} FOR SELECT USING (
                true
            );
        """)
        op.execute(f"""
            CREATE POLICY {tbl}_write ON {tbl} FOR ALL USING (
                current_setting('app.bypass_rls', true) = 'true'
                OR current_setting('app.current_user_rol', true) = 'super_admin'
                OR EXISTS (
                    SELECT 1 FROM profesionales p 
                    WHERE p.id = profesional_id 
                    AND p.negocio_id::text = current_setting('app.current_negocio_id', true)
                    AND current_setting('app.current_user_rol', true) = 'admin'
                )
            );
        """)

    # profesional_servicio
    op.execute("""
        CREATE POLICY profesional_servicio_select ON profesional_servicio FOR SELECT USING (
            true
        );
    """)
    op.execute("""
        CREATE POLICY profesional_servicio_write ON profesional_servicio FOR ALL USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR EXISTS (
                SELECT 1 FROM profesionales p 
                WHERE p.id = profesional_id 
                AND p.negocio_id::text = current_setting('app.current_negocio_id', true)
                AND current_setting('app.current_user_rol', true) = 'admin'
            )
        );
    """)

    # usuarios
    op.execute("""
        CREATE POLICY usuarios_select ON usuarios FOR SELECT USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR id::text = current_setting('app.current_user_id', true)
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)
    op.execute("""
        CREATE POLICY usuarios_insert ON usuarios FOR INSERT WITH CHECK (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)
    op.execute("""
        CREATE POLICY usuarios_update ON usuarios FOR UPDATE USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR id::text = current_setting('app.current_user_id', true)
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)
    op.execute("""
        CREATE POLICY usuarios_delete ON usuarios FOR DELETE USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)

    # clientes
    op.execute("""
        CREATE POLICY clientes_select ON clientes FOR SELECT USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)
    op.execute("""
        CREATE POLICY clientes_insert ON clientes FOR INSERT WITH CHECK (
            true
        );
    """)
    op.execute("""
        CREATE POLICY clientes_update ON clientes FOR UPDATE USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)
    op.execute("""
        CREATE POLICY clientes_delete ON clientes FOR DELETE USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)

    # reservas
    op.execute("""
        CREATE POLICY reservas_select ON reservas FOR SELECT USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
            OR token_cancelacion = current_setting('app.current_cancelacion_token', true)
        );
    """)
    op.execute("""
        CREATE POLICY reservas_insert ON reservas FOR INSERT WITH CHECK (
            true
        );
    """)
    op.execute("""
        CREATE POLICY reservas_update ON reservas FOR UPDATE USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
            OR token_cancelacion = current_setting('app.current_cancelacion_token', true)
        );
    """)
    op.execute("""
        CREATE POLICY reservas_delete ON reservas FOR DELETE USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)

    # reserva_items
    op.execute("""
        CREATE POLICY reserva_items_select ON reserva_items FOR SELECT USING (
            true
        );
    """)
    op.execute("""
        CREATE POLICY reserva_items_write ON reserva_items FOR ALL USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR EXISTS (
                SELECT 1 FROM reservas r 
                WHERE r.id = reserva_id 
                AND r.negocio_id::text = current_setting('app.current_negocio_id', true)
                AND current_setting('app.current_user_rol', true) = 'admin'
            )
        );
    """)

    # resenas
    op.execute("""
        CREATE POLICY resenas_select ON resenas FOR SELECT USING (
            true
        );
    """)
    op.execute("""
        CREATE POLICY resenas_insert ON resenas FOR INSERT WITH CHECK (
            true
        );
    """)
    op.execute("""
        CREATE POLICY resenas_write ON resenas FOR ALL USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)

    # notificacion_logs, recordatorios_programados
    for tbl in ["notificacion_logs", "recordatorios_programados"]:
        op.execute(f"""
            CREATE POLICY {tbl}_all ON {tbl} FOR ALL USING (
                current_setting('app.bypass_rls', true) = 'true'
                OR current_setting('app.current_user_rol', true) = 'super_admin'
                OR EXISTS (
                    SELECT 1 FROM reservas r 
                    WHERE r.id = reserva_id 
                    AND r.negocio_id::text = current_setting('app.current_negocio_id', true)
                    AND current_setting('app.current_user_rol', true) = 'admin'
                )
            );
        """)

    # registros_acceso
    op.execute("""
        CREATE POLICY registros_acceso_all ON registros_acceso FOR ALL USING (
            current_setting('app.bypass_rls', true) = 'true'
            OR current_setting('app.current_user_rol', true) = 'super_admin'
            OR (
                current_setting('app.current_user_rol', true) = 'admin'
                AND negocio_id::text = current_setting('app.current_negocio_id', true)
            )
        );
    """)


def downgrade() -> None:
    tables = [
        "negocios",
        "categorias",
        "portafolio_imagenes",
        "profesionales",
        "usuarios",
        "clientes",
        "excepciones_agenda",
        "horarios_recurrentes",
        "servicios",
        "profesional_servicio",
        "reservas",
        "notificacion_logs",
        "recordatorios_programados",
        "resenas",
        "reserva_items",
        "registros_acceso"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
        
    # Drop policies
    op.execute("DROP POLICY IF EXISTS negocios_select ON negocios;")
    op.execute("DROP POLICY IF EXISTS negocios_insert ON negocios;")
    op.execute("DROP POLICY IF EXISTS negocios_update ON negocios;")
    op.execute("DROP POLICY IF EXISTS negocios_delete ON negocios;")

    for tbl in ["categorias", "servicios", "profesionales", "portafolio_imagenes"]:
        op.execute(f"DROP POLICY IF EXISTS {tbl}_select ON {tbl};")
        op.execute(f"DROP POLICY IF EXISTS {tbl}_write ON {tbl};")

    for tbl in ["excepciones_agenda", "horarios_recurrentes"]:
        op.execute(f"DROP POLICY IF EXISTS {tbl}_select ON {tbl};")
        op.execute(f"DROP POLICY IF EXISTS {tbl}_write ON {tbl};")

    op.execute("DROP POLICY IF EXISTS profesional_servicio_select ON profesional_servicio;")
    op.execute("DROP POLICY IF EXISTS profesional_servicio_write ON profesional_servicio;")

    op.execute("DROP POLICY IF EXISTS usuarios_select ON usuarios;")
    op.execute("DROP POLICY IF EXISTS usuarios_insert ON usuarios;")
    op.execute("DROP POLICY IF EXISTS usuarios_update ON usuarios;")
    op.execute("DROP POLICY IF EXISTS usuarios_delete ON usuarios;")

    op.execute("DROP POLICY IF EXISTS clientes_select ON clientes;")
    op.execute("DROP POLICY IF EXISTS clientes_insert ON clientes;")
    op.execute("DROP POLICY IF EXISTS clientes_update ON clientes;")
    op.execute("DROP POLICY IF EXISTS clientes_delete ON clientes;")

    op.execute("DROP POLICY IF EXISTS reservas_select ON reservas;")
    op.execute("DROP POLICY IF EXISTS reservas_insert ON reservas;")
    op.execute("DROP POLICY IF EXISTS reservas_update ON reservas;")
    op.execute("DROP POLICY IF EXISTS reservas_delete ON reservas;")

    op.execute("DROP POLICY IF EXISTS reserva_items_select ON reserva_items;")
    op.execute("DROP POLICY IF EXISTS reserva_items_write ON reserva_items;")

    op.execute("DROP POLICY IF EXISTS resenas_select ON resenas;")
    op.execute("DROP POLICY IF EXISTS resenas_insert ON resenas;")
    op.execute("DROP POLICY IF EXISTS resenas_write ON resenas;")

    for tbl in ["notificacion_logs", "recordatorios_programados"]:
        op.execute(f"DROP POLICY IF EXISTS {tbl}_all ON {tbl};")

    op.execute("DROP POLICY IF EXISTS registros_acceso_all ON registros_acceso;")

