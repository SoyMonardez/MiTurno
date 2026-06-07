from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.models.catalogo import Servicio
from app.models.cliente import Cliente
from app.models.enums import EstadoRecordatorio, EstadoReserva, TipoRecordatorio
from app.models.negocio import Negocio
from app.models.notificacion import RecordatorioProgramado
from app.models.profesional import Profesional
from app.models.reserva import Reserva, ReservaItem
from app.schemas.reserva import (
    BajaRecordatoriosOut,
    ReservaCreate,
    ReservaOut,
    ReservaPublicaOut,
)
from app.services.gestion_reservas import cancelar_por_token
from app.services.reservas import crear_reserva

router = APIRouter(prefix="/reservas", tags=["reservas"])


@router.post("", response_model=ReservaOut, status_code=201)
def crear(data: ReservaCreate, db: Session = Depends(get_db)) -> ReservaOut:
    reserva = crear_reserva(data, db)
    return reserva


@router.get("/cancelar/{token}", response_model=ReservaPublicaOut)
def datos_para_cancelar(token: str, db: Session = Depends(get_db)) -> ReservaPublicaOut:
    db.info["current_cancelacion_token"] = token
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
    anticipacion = negocio.cancelacion_anticipacion_min
    limite = reserva.inicio - timedelta(minutes=anticipacion)
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
        minutos_anticipacion=anticipacion,
    )


@router.post("/cancelar/{token}", response_model=ReservaOut)
def cancelar_cliente(token: str, db: Session = Depends(get_db)) -> ReservaOut:
    db.info["current_cancelacion_token"] = token
    return cancelar_por_token(token, db)


def _reserva_por_token(token: str, db: Session) -> Reserva:
    db.info["current_cancelacion_token"] = token
    reserva = db.scalar(select(Reserva).where(Reserva.token_cancelacion == token))
    if not reserva:
        raise HTTPException(404, "Enlace no válido")
    return reserva


@router.get("/recordatorios/baja/{token}", response_model=BajaRecordatoriosOut)
def datos_baja_recordatorios(token: str, db: Session = Depends(get_db)) -> BajaRecordatoriosOut:
    reserva = _reserva_por_token(token, db)
    negocio = db.get(Negocio, reserva.negocio_id)
    cliente = db.get(Cliente, reserva.cliente_id)
    return BajaRecordatoriosOut(
        negocio_nombre=negocio.nombre if negocio else "MiTurno",
        negocio_slug=negocio.slug if negocio else "",
        negocio_icono=negocio.icono if negocio else "scissors",
        cliente_nombre=cliente.nombre if cliente else "",
        ya_dado_de_baja=bool(cliente and not cliente.acepta_recordatorios),
    )


@router.post("/recordatorios/baja/{token}", response_model=BajaRecordatoriosOut)
def baja_recordatorios(token: str, db: Session = Depends(get_db)) -> BajaRecordatoriosOut:
    reserva = _reserva_por_token(token, db)
    negocio = db.get(Negocio, reserva.negocio_id)
    cliente = db.get(Cliente, reserva.cliente_id)
    if cliente:
        cliente.acepta_recordatorios = False
        # Cancelar recordatorios "volvé" pendientes (frecuencia e inasistencia).
        for rec in db.scalars(
            select(RecordatorioProgramado).where(
                RecordatorioProgramado.cliente_id == cliente.id,
                RecordatorioProgramado.estado == EstadoRecordatorio.pendiente,
                RecordatorioProgramado.tipo.in_(
                    [TipoRecordatorio.frecuencia, TipoRecordatorio.inasistencia]
                ),
            )
        ):
            rec.estado = EstadoRecordatorio.cancelado
        db.commit()
    return BajaRecordatoriosOut(
        negocio_nombre=negocio.nombre if negocio else "MiTurno",
        negocio_slug=negocio.slug if negocio else "",
        negocio_icono=negocio.icono if negocio else "scissors",
        cliente_nombre=cliente.nombre if cliente else "",
        ya_dado_de_baja=True,
    )
