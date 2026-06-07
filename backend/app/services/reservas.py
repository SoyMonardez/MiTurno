import re
import secrets
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.catalogo import Servicio
from app.models.cliente import Cliente
from app.models.enums import EstadoReserva
from app.models.negocio import Negocio
from app.models.profesional import Profesional
from app.models.reserva import Reserva, ReservaItem
from app.schemas.reserva import ReservaAdminCreate, ReservaCreate
from app.services.disponibilidad import duracion_total_min
from app.services.notificaciones import enviar_confirmacion_reserva
from app.services.recordatorios import (
    cancelar_pendientes_de_cliente,
    programar_recordatorio_turno,
)


def _cargar_servicios_ordenados(
    negocio_id: int, servicio_ids: list[int], db: Session
) -> list[Servicio]:
    servicios = list(
        db.scalars(
            select(Servicio).where(
                Servicio.id.in_(servicio_ids),
                Servicio.negocio_id == negocio_id,
                Servicio.activo,
            )
        )
    )
    if len(servicios) != len(set(servicio_ids)):
        raise HTTPException(400, "Algún servicio no existe o no está activo")
    por_id = {s.id: s for s in servicios}
    return [por_id[sid] for sid in servicio_ids]


def _profesional_para(
    negocio_id: int,
    servicio_ids: list[int],
    profesional_id: int | None,
    inicio: datetime,
    fin: datetime,
    db: Session,
) -> Profesional:
    requeridos = set(servicio_ids)
    profesionales = list(
        db.scalars(select(Profesional).where(Profesional.negocio_id == negocio_id))
    )
    if profesional_id is not None:
        profesionales = [p for p in profesionales if p.id == profesional_id]
        if not profesionales:
            raise HTTPException(404, "Profesional no encontrado")

    candidatos = [
        p for p in profesionales if requeridos.issubset({s.id for s in p.servicios})
    ]
    if not candidatos:
        raise HTTPException(400, "El profesional no ofrece todos los servicios pedidos")

    # Elige el primer candidato sin solapamiento en ese horario.
    for prof in candidatos:
        ocupado = db.scalar(
            select(Reserva.id).where(
                Reserva.profesional_id == prof.id,
                Reserva.estado == EstadoReserva.confirmada,
                Reserva.inicio < fin,
                Reserva.fin > inicio,
            )
        )
        if not ocupado:
            return prof
    raise HTTPException(409, "El horario ya no está disponible")


def _upsert_cliente(
    negocio_id: int, nombre: str, email: str, telefono: str, inicio: datetime, db: Session
) -> Cliente:
    cliente = db.scalar(
        select(Cliente).where(
            Cliente.negocio_id == negocio_id, Cliente.email == email
        )
    )
    if cliente is None:
        cliente = Cliente(
            negocio_id=negocio_id,
            nombre=nombre,
            email=email,
            telefono=telefono,
            primera_visita=inicio,
        )
        db.add(cliente)
        db.flush()
    else:
        cliente.nombre = nombre
        cliente.telefono = telefono
    return cliente


def _upsert_cliente_admin(
    negocio_id: int,
    nombre: str,
    telefono: str | None,
    email: str | None,
    inicio: datetime,
    db: Session,
) -> Cliente:
    """Resuelve el cliente para una reserva cargada por el admin.

    Busca por email (si lo hay), luego por teléfono; si no existe, lo crea.
    Cuando no hay email, genera uno sintético para respetar la restricción
    de unicidad (negocio_id, email).
    """
    cliente = None
    if email:
        cliente = db.scalar(
            select(Cliente).where(
                Cliente.negocio_id == negocio_id, Cliente.email == email
            )
        )
    if cliente is None and telefono:
        cliente = db.scalar(
            select(Cliente).where(
                Cliente.negocio_id == negocio_id, Cliente.telefono == telefono
            )
        )

    if cliente is None:
        if email:
            email_final = email
        elif telefono:
            email_final = f"tel-{re.sub(r'[^0-9]', '', telefono)}@sin-correo.local"
        else:
            email_final = f"manual-{secrets.token_hex(4)}@sin-correo.local"
        cliente = Cliente(
            negocio_id=negocio_id,
            nombre=nombre,
            email=email_final,
            telefono=telefono,
            primera_visita=inicio,
        )
        db.add(cliente)
        db.flush()
    else:
        cliente.nombre = nombre
        if telefono:
            cliente.telefono = telefono
    return cliente


def crear_reserva_admin(negocio_id: int, data: ReservaAdminCreate, db: Session) -> Reserva:
    """Crea una reserva confirmada cargada manualmente por el admin.

    Reutiliza la misma lógica de validación de servicios, asignación de
    profesional y control de solapamiento que la reserva pública. El email
    del cliente es opcional (típico de reservas tomadas por teléfono).
    """
    negocio = db.get(Negocio, negocio_id)
    if not negocio or not negocio.activo:
        raise HTTPException(404, "Negocio no encontrado")

    if data.inicio.tzinfo is None:
        raise HTTPException(400, "inicio debe incluir zona horaria (UTC)")
    inicio = data.inicio.astimezone(ZoneInfo("UTC"))

    if not data.servicio_ids:
        raise HTTPException(400, "Debe indicar al menos un servicio")

    servicios = _cargar_servicios_ordenados(negocio_id, data.servicio_ids, db)
    duracion = duracion_total_min(servicios)
    precio_total = sum(s.precio for s in servicios)
    fin = inicio + timedelta(minutes=duracion)

    profesional = _profesional_para(
        negocio_id, data.servicio_ids, data.profesional_id, inicio, fin, db
    )
    cliente = _upsert_cliente_admin(
        negocio_id,
        data.cliente.nombre,
        data.cliente.telefono,
        data.cliente.email,
        inicio,
        db,
    )

    reserva = Reserva(
        negocio_id=negocio_id,
        cliente_id=cliente.id,
        profesional_id=profesional.id,
        estado=EstadoReserva.confirmada,
        total_precio=precio_total,
        total_duracion=duracion,
        inicio=inicio,
        fin=fin,
        token_cancelacion=secrets.token_urlsafe(24),
        notas=data.notas,
    )
    reserva.items = [
        ReservaItem(servicio_id=s.id, orden=i) for i, s in enumerate(servicios)
    ]
    db.add(reserva)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El horario ya fue reservado")

    programar_recordatorio_turno(reserva, db)

    # Solo enviamos email de confirmación si el cliente dejó un correo real.
    if data.cliente.email:
        enviar_confirmacion_reserva(
            db=db,
            reserva=reserva,
            negocio=negocio,
            cliente_nombre=cliente.nombre,
            cliente_email=data.cliente.email,
            servicios_nombres=[s.nombre for s in servicios],
            profesional_nombre=profesional.nombre,
        )

    db.commit()
    db.refresh(reserva)
    return reserva


def crear_reserva(data: ReservaCreate, db: Session) -> Reserva:
    negocio = db.get(Negocio, data.negocio_id)
    if not negocio or not negocio.activo:
        raise HTTPException(404, "Negocio no encontrado")

    if data.inicio.tzinfo is None:
        raise HTTPException(400, "inicio debe incluir zona horaria (UTC)")
    inicio = data.inicio.astimezone(ZoneInfo("UTC"))
    if inicio <= datetime.now(ZoneInfo("UTC")):
        raise HTTPException(400, "El horario ya pasó")

    servicios = _cargar_servicios_ordenados(data.negocio_id, data.servicio_ids, db)
    duracion = duracion_total_min(servicios)
    precio_total = sum(s.precio for s in servicios)
    fin = inicio + timedelta(minutes=duracion)

    profesional = _profesional_para(
        data.negocio_id, data.servicio_ids, data.profesional_id, inicio, fin, db
    )
    cliente = _upsert_cliente(
        data.negocio_id,
        data.cliente.nombre,
        data.cliente.email,
        data.cliente.telefono,
        inicio,
        db,
    )
    # Si el cliente eligió recibir recordatorios, re-activamos su consentimiento
    # (por si se había dado de baja antes).
    if data.frecuencia_recordatorio_dias:
        cliente.acepta_recordatorios = True

    reserva = Reserva(
        negocio_id=data.negocio_id,
        cliente_id=cliente.id,
        profesional_id=profesional.id,
        estado=EstadoReserva.confirmada,
        total_precio=precio_total,
        total_duracion=duracion,
        inicio=inicio,
        fin=fin,
        frecuencia_recordatorio_dias=data.frecuencia_recordatorio_dias,
        token_cancelacion=secrets.token_urlsafe(24),
        notas=data.notas,
    )
    reserva.items = [
        ReservaItem(servicio_id=s.id, orden=i) for i, s in enumerate(servicios)
    ]
    db.add(reserva)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El horario ya fue reservado")

    # El cliente vuelve a reservar: cancelamos recordatorios pendientes de "volver".
    cancelar_pendientes_de_cliente(cliente.id, db)

    # Recordatorio automático 24 h antes del turno.
    programar_recordatorio_turno(reserva, db)

    enviar_confirmacion_reserva(
        db=db,
        reserva=reserva,
        negocio=negocio,
        cliente_nombre=cliente.nombre,
        cliente_email=cliente.email,
        servicios_nombres=[s.nombre for s in servicios],
        profesional_nombre=profesional.nombre,
    )

    db.commit()
    db.refresh(reserva)
    return reserva
