from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.reserva import ReservaCreate, ReservaOut
from app.services.gestion_reservas import cancelar_por_token
from app.services.reservas import crear_reserva

router = APIRouter(prefix="/reservas", tags=["reservas"])


@router.post("", response_model=ReservaOut, status_code=201)
def crear(data: ReservaCreate, db: Session = Depends(get_db)) -> ReservaOut:
    reserva = crear_reserva(data, db)
    return reserva


@router.post("/cancelar/{token}", response_model=ReservaOut)
def cancelar_cliente(token: str, db: Session = Depends(get_db)) -> ReservaOut:
    return cancelar_por_token(token, db)
