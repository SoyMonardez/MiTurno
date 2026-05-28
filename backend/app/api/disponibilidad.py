from datetime import date as date_type
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.negocio import Negocio
from app.schemas.disponibilidad import FranjasOut
from app.services.disponibilidad import calcular_disponibilidad

router = APIRouter(tags=["disponibilidad"])


@router.get("/disponibilidad", response_model=FranjasOut)
def disponibilidad(
    negocio_id: int,
    fecha: date_type,
    servicio_ids: list[int] = Query(...),
    profesional_id: int | None = None,
    db: Session = Depends(get_db),
) -> FranjasOut:
    negocio = db.get(Negocio, negocio_id)
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")
    if not servicio_ids:
        raise HTTPException(400, "Debe indicar al menos un servicio")

    tz = ZoneInfo(negocio.zona_horaria)
    franjas = calcular_disponibilidad(
        negocio_id=negocio_id,
        servicio_ids=servicio_ids,
        fecha=fecha,
        profesional_id=profesional_id,
        tz=tz,
        db=db,
    )
    return FranjasOut(**franjas)
