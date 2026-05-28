from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.reserva import ReservaCreate, ReservaOut
from app.services.reservas import crear_reserva

router = APIRouter(prefix="/reservas", tags=["reservas"])


@router.post("", response_model=ReservaOut, status_code=201)
def crear(data: ReservaCreate, db: Session = Depends(get_db)) -> ReservaOut:
    reserva = crear_reserva(data, db)
    return reserva
