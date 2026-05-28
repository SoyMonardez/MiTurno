from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import EstadoReserva
from app.models.profesional import Profesional
from app.models.resena import Resena
from app.models.reserva import Reserva
from app.schemas.resena import ResenaCreate


def _recalcular_promedio_profesional(profesional_id: int, db: Session) -> None:
    promedio = db.scalar(
        select(func.avg(Resena.puntuacion)).where(
            Resena.profesional_id == profesional_id
        )
    )
    profesional = db.get(Profesional, profesional_id)
    if profesional:
        profesional.calificacion_promedio = (
            Decimal(promedio).quantize(Decimal("0.01")) if promedio is not None else None
        )


def crear_resena_por_token(token: str, data: ResenaCreate, db: Session) -> Resena:
    reserva = db.scalar(select(Reserva).where(Reserva.token_cancelacion == token))
    if not reserva:
        raise HTTPException(404, "Reserva no encontrada")
    if reserva.estado != EstadoReserva.completada:
        raise HTTPException(409, "Solo se puede reseñar una reserva completada")
    if db.scalar(select(Resena).where(Resena.reserva_id == reserva.id)):
        raise HTTPException(409, "Esta reserva ya tiene una reseña")

    resena = Resena(
        negocio_id=reserva.negocio_id,
        reserva_id=reserva.id,
        profesional_id=reserva.profesional_id,
        cliente_id=reserva.cliente_id,
        puntuacion=data.puntuacion,
        comentario=data.comentario,
    )
    db.add(resena)
    db.flush()
    _recalcular_promedio_profesional(reserva.profesional_id, db)
    db.commit()
    db.refresh(resena)
    return resena
