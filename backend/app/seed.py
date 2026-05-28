"""Crea un negocio demo con catálogo, profesional y horario.

Uso (dentro del contenedor):  python -m app.seed
Es idempotente por slug: si el negocio demo ya existe, no hace nada.
"""

from datetime import time
from decimal import Decimal

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.catalogo import Categoria, Servicio
from app.models.enums import BadgeServicio, RolUsuario
from app.models.negocio import Negocio, Usuario
from app.models.profesional import HorarioRecurrente, Profesional

SLUG_DEMO = "barberia-demo"


def ensure_admin() -> None:
    """Crea el admin demo si no existe (idempotente, independiente del negocio)."""
    db = SessionLocal()
    try:
        negocio = db.scalar(select(Negocio).where(Negocio.slug == SLUG_DEMO))
        if not negocio:
            print("No existe el negocio demo; corré primero el seed completo.")
            return
        if db.scalar(select(Usuario).where(Usuario.username == "admin")):
            print("El admin 'admin' ya existe. Nada que hacer.")
            return
        db.add(
            Usuario(
                negocio_id=negocio.id,
                email="admin@barberiademo.local",
                nombre="Admin Demo",
                rol=RolUsuario.admin,
                username="admin",
                dni="30111222",
                password_hash=hash_password("admin1234"),
            )
        )
        db.commit()
        print("Admin creado: usuario='admin', dni='30111222', clave='admin1234'")
    finally:
        db.close()


def run() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(Negocio).where(Negocio.slug == SLUG_DEMO)):
            print(f"El negocio demo '{SLUG_DEMO}' ya existe. Nada que hacer.")
            return

        negocio = Negocio(
            nombre="Barbería MiTurno",
            slug=SLUG_DEMO,
            descripcion="Barbería de ejemplo para probar MiTurno.",
            direccion="Av. Siempre Viva 742",
            zona_horaria="America/Argentina/Buenos_Aires",
            email_notificaciones="admin@barberiademo.local",
        )
        db.add(negocio)
        db.flush()

        admin = Usuario(
            negocio_id=negocio.id,
            email="admin@barberiademo.local",
            nombre="Admin Demo",
            rol=RolUsuario.admin,
            username="admin",
            dni="30111222",
            password_hash=hash_password("admin1234"),
        )
        db.add(admin)

        cat_cabello = Categoria(negocio_id=negocio.id, nombre="Cabello", orden=0)
        cat_barba = Categoria(negocio_id=negocio.id, nombre="Barba", orden=1)
        db.add_all([cat_cabello, cat_barba])
        db.flush()

        corte = Servicio(
            negocio_id=negocio.id,
            categoria_id=cat_cabello.id,
            nombre="Corte de cabello",
            descripcion="Corte clásico o moderno.",
            duracion_min=30,
            buffer_min=5,
            precio=Decimal("5000"),
            badge=BadgeServicio.popular,
        )
        barba = Servicio(
            negocio_id=negocio.id,
            categoria_id=cat_barba.id,
            nombre="Arreglo de barba",
            descripcion="Perfilado y arreglo de barba.",
            duracion_min=20,
            buffer_min=5,
            precio=Decimal("3500"),
            badge=BadgeServicio.recomendado,
        )
        color = Servicio(
            negocio_id=negocio.id,
            categoria_id=cat_cabello.id,
            nombre="Coloración",
            descripcion="Coloración completa.",
            duracion_min=60,
            buffer_min=10,
            precio=Decimal("12000"),
            badge=BadgeServicio.nuevo,
        )
        db.add_all([corte, barba, color])
        db.flush()

        prof = Profesional(
            negocio_id=negocio.id,
            nombre="Carlos Pérez",
            bio="Barbero con 10 años de experiencia.",
        )
        prof.servicios = [corte, barba, color]
        db.add(prof)
        db.flush()

        # Horario: lunes a viernes 9-13 y 15-19.
        for dia in range(0, 5):
            db.add_all(
                [
                    HorarioRecurrente(
                        profesional_id=prof.id,
                        dia_semana=dia,
                        hora_inicio=time(9, 0),
                        hora_fin=time(13, 0),
                    ),
                    HorarioRecurrente(
                        profesional_id=prof.id,
                        dia_semana=dia,
                        hora_inicio=time(15, 0),
                        hora_fin=time(19, 0),
                    ),
                ]
            )

        db.commit()
        print(f"Negocio demo creado: slug='{SLUG_DEMO}', negocio_id={negocio.id}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
