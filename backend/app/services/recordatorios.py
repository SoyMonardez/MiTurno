from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.enums import EstadoRecordatorio, TipoRecordatorio
from app.models.notificacion import RecordatorioProgramado
from app.models.reserva import Reserva


def _acepta_recordatorios(cliente_id: int, db: Session) -> bool:
    cliente = db.get(Cliente, cliente_id)
    return bool(cliente and cliente.acepta_recordatorios)

# Días tras una inasistencia para sugerir reagendar.
DIAS_SUGERENCIA_INASISTENCIA = 1
# Horas antes del turno para enviar el recordatorio.
HORAS_RECORDATORIO_TURNO = 24


def programar_recordatorio_turno(reserva: Reserva, db: Session) -> None:
    """Programa un recordatorio N horas antes del turno (si hay tiempo)."""
    enviar_en = reserva.inicio - timedelta(hours=HORAS_RECORDATORIO_TURNO)
    # Solo si el recordatorio cae en el futuro
    if enviar_en <= datetime.now(ZoneInfo("UTC")):
        return
    db.add(
        RecordatorioProgramado(
            reserva_id=reserva.id,
            cliente_id=reserva.cliente_id,
            tipo=TipoRecordatorio.turno_proximo,
            enviar_en=enviar_en,
        )
    )


def programar_por_frecuencia(reserva: Reserva, db: Session) -> None:
    if not reserva.frecuencia_recordatorio_dias:
        return
    if not _acepta_recordatorios(reserva.cliente_id, db):
        return
    enviar_en = reserva.inicio + timedelta(days=reserva.frecuencia_recordatorio_dias)
    db.add(
        RecordatorioProgramado(
            reserva_id=reserva.id,
            cliente_id=reserva.cliente_id,
            tipo=TipoRecordatorio.frecuencia,
            enviar_en=enviar_en,
        )
    )


def programar_por_inasistencia(reserva: Reserva, db: Session) -> None:
    if not _acepta_recordatorios(reserva.cliente_id, db):
        return
    enviar_en = reserva.inicio + timedelta(days=DIAS_SUGERENCIA_INASISTENCIA)
    db.add(
        RecordatorioProgramado(
            reserva_id=reserva.id,
            cliente_id=reserva.cliente_id,
            tipo=TipoRecordatorio.inasistencia,
            enviar_en=enviar_en,
        )
    )


def cancelar_pendientes_de_reserva(reserva_id: int, db: Session) -> None:
    db.execute(
        update(RecordatorioProgramado)
        .where(
            RecordatorioProgramado.reserva_id == reserva_id,
            RecordatorioProgramado.estado == EstadoRecordatorio.pendiente,
        )
        .values(estado=EstadoRecordatorio.cancelado)
    )


def cancelar_pendientes_de_cliente(cliente_id: int, db: Session) -> None:
    """Cuando el cliente vuelve a reservar, no duplicamos el aviso de volver."""
    pendientes = db.scalars(
        select(RecordatorioProgramado).where(
            RecordatorioProgramado.cliente_id == cliente_id,
            RecordatorioProgramado.estado == EstadoRecordatorio.pendiente,
        )
    )
    for rec in pendientes:
        rec.estado = EstadoRecordatorio.cancelado
