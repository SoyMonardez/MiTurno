from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import EstadoReserva


class ClienteDatos(BaseModel):
    nombre: str
    email: EmailStr
    telefono: str


class ReservaCreate(BaseModel):
    negocio_id: int
    servicio_ids: list[int]
    profesional_id: int | None = None  # None = "cualquier profesional"
    inicio: datetime  # UTC
    cliente: ClienteDatos
    frecuencia_recordatorio_dias: int | None = None
    notas: str | None = None


class ReservaItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    servicio_id: int
    orden: int


class ReservaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    negocio_id: int
    cliente_id: int
    profesional_id: int
    estado: EstadoReserva
    total_precio: Decimal
    total_duracion: int
    inicio: datetime
    fin: datetime
    token_cancelacion: str
    items: list[ReservaItemOut] = []
