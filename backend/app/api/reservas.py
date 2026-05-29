from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.models.catalogo import Servicio
from app.models.enums import EstadoReserva
from app.models.negocio import Negocio
from app.models.profesional import Profesional
from app.models.reserva import Reserva, ReservaItem
from app.schemas.reserva import ReservaCreate, ReservaOut, ReservaPublicaOut
from app.services.gestion_reservas import cancelar_por_token
from app.services.reservas import crear_reserva

router = APIRouter(prefix="/reservas", tags=["reservas"])


@router.post("", response_model=ReservaOut, status_code=201)
def crear(data: ReservaCreate, db: Session = Depends(get_db)) -> ReservaOut:
    reserva = crear_reserva(data, db)
    return reserva


@router.get("/cancelar/{token}", response_model=ReservaPublicaOut)
def datos_para_cancelar(token: str, db: Session = Depends(get_db)) -> ReservaPublicaOut:
    reserva = db.scalar(select(Reserva).where(Reserva.token_cancelacion == token))
    if not reserva:
        raise HTTPException(404, "Reserva no encontrada")
    negocio = db.get(Negocio, reserva.negocio_id)
    profesional = db.get(Profesional, reserva.profesional_id)
    servicios = list(
        db.scalars(
            select(Servicio.nombre)
            .join(ReservaItem, ReservaItem.servicio_id == Servicio.id)
            .where(ReservaItem.reserva_id == reserva.id)
            .order_by(ReservaItem.orden)
        )
    )
    limite = reserva.inicio - timedelta(minutes=settings.cancelacion_min_anticipacion)
    cancelable = (
        reserva.estado == EstadoReserva.confirmada
        and datetime.now(ZoneInfo("UTC")) <= limite
    )
    return ReservaPublicaOut(
        estado=reserva.estado,
        inicio=reserva.inicio,
        fin=reserva.fin,
        total_precio=reserva.total_precio,
        total_duracion=reserva.total_duracion,
        negocio_nombre=negocio.nombre,
        negocio_slug=negocio.slug,
        negocio_icono=negocio.icono,
        profesional_nombre=profesional.nombre if profesional else "",
        servicios=servicios,
        cancelable=cancelable,
        minutos_anticipacion=settings.cancelacion_min_anticipacion,
    )


@router.post("/cancelar/{token}", response_model=ReservaOut)
def cancelar_cliente(token: str, db: Session = Depends(get_db)) -> ReservaOut:
    return cancelar_por_token(token, db)
