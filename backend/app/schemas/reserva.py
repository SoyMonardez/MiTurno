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


class ClienteAdminDatos(BaseModel):
    """Datos del cliente para una reserva cargada por el admin (email opcional)."""
    nombre: str
    telefono: str | None = None
    email: EmailStr | None = None


class ReservaAdminCreate(BaseModel):
    servicio_ids: list[int]
    profesional_id: int | None = None  # None = "cualquier profesional"
    inicio: datetime  # UTC
    cliente: ClienteAdminDatos
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


class BajaRecordatoriosOut(BaseModel):
    """Datos para la página de baja de recordatorios (por token)."""
    negocio_nombre: str
    negocio_slug: str
    negocio_icono: str
    cliente_nombre: str
    ya_dado_de_baja: bool


class ReservaPublicaOut(BaseModel):
    """Datos de una reserva para la página de cancelación (por token)."""
    estado: EstadoReserva
    inicio: datetime
    fin: datetime
    total_precio: Decimal
    total_duracion: int
    negocio_nombre: str
    negocio_slug: str
    negocio_icono: str
    profesional_nombre: str
    servicios: list[str]
    cancelable: bool
    minutos_anticipacion: int
