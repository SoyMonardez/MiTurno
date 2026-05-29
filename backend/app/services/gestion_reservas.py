from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.cliente import Cliente
from app.models.enums import EstadoReserva
from app.models.negocio import Negocio
from app.models.reserva import Reserva
from app.services.recordatorios import (
    cancelar_pendientes_de_reserva,
    programar_por_frecuencia,
    programar_por_inasistencia,
)
from app.services.segmentacion import recalcular_segmento
from app.services.notificaciones import enviar_notificacion_satisfaccion


def _cliente(reserva: Reserva, db: Session) -> Cliente:
    return db.get(Cliente, reserva.cliente_id)


def cancelar_por_token(token: str, db: Session) -> Reserva:
    reserva = db.scalar(select(Reserva).where(Reserva.token_cancelacion == token))
    if not reserva:
        raise HTTPException(404, "Reserva no encontrada")
    if reserva.estado != EstadoReserva.confirmada:
        raise HTTPException(409, "La reserva no se puede cancelar en su estado actual")

    limite = reserva.inicio - timedelta(minutes=settings.cancelacion_min_anticipacion)
    if datetime.now(ZoneInfo("UTC")) > limite:
        raise HTTPException(
            409,
            f"Solo se puede cancelar hasta {settings.cancelacion_min_anticipacion} minutos antes",
        )
    return _aplicar_cancelacion(reserva, db, cuenta_como_falla=True)


def cancelar_por_admin(reserva_id: int, negocio_id: int, db: Session) -> Reserva:
    reserva = db.get(Reserva, reserva_id)
    if not reserva or reserva.negocio_id != negocio_id:
        raise HTTPException(404, "Reserva no encontrada")
    if reserva.estado != EstadoReserva.confirmada:
        raise HTTPException(409, "La reserva no se puede cancelar en su estado actual")
    # El admin puede cancelar en cualquier momento; no penaliza al cliente.
    return _aplicar_cancelacion(reserva, db, cuenta_como_falla=False)


def _aplicar_cancelacion(reserva: Reserva, db: Session, cuenta_como_falla: bool) -> Reserva:
    reserva.estado = EstadoReserva.cancelada
    cancelar_pendientes_de_reserva(reserva.id, db)
    if cuenta_como_falla:
        cliente = _cliente(reserva, db)
        cliente.turnos_cancelados += 1
        recalcular_segmento(cliente)
    db.commit()
    db.refresh(reserva)
    return reserva


def marcar_asistencia(
    reserva_id: int, negocio_id: int, estado: EstadoReserva, db: Session
) -> Reserva:
    if estado not in (EstadoReserva.completada, EstadoReserva.no_show):
        raise HTTPException(400, "Estado inválido para asistencia")
    reserva = db.get(Reserva, reserva_id)
    if not reserva or reserva.negocio_id != negocio_id:
        raise HTTPException(404, "Reserva no encontrada")
    if reserva.estado != EstadoReserva.confirmada:
        raise HTTPException(409, "Solo se marca asistencia de reservas confirmadas")

    reserva.estado = estado
    cliente = _cliente(reserva, db)

    if estado == EstadoReserva.completada:
        cliente.turnos_completados += 1
        cliente.ultima_visita = reserva.inicio
        programar_por_frecuencia(reserva, db)
        
        # Enviar notificación de satisfacción para opinión/reseña
        negocio = db.get(Negocio, reserva.negocio_id)
        if negocio:
            enviar_notificacion_satisfaccion(
                db=db,
                reserva=reserva,
                negocio=negocio,
                cliente_nombre=cliente.nombre,
                cliente_email=cliente.email,
            )
    else:  # no_show
        cliente.no_shows += 1
        programar_por_inasistencia(reserva, db)

    recalcular_segmento(cliente)
    db.commit()
    db.refresh(reserva)
    return reserva
