"""Schemas de los módulos Premium: panel del profesional, comisiones,
ficha técnica, lista de espera y reportes de caja / horas muertas."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    BloqueHorario,
    EstadoListaEspera,
    EstadoReserva,
    MetodoPago,
    TipoComision,
)


# ── Panel del profesional ────────────────────────────────────────────────


class TurnoProfesionalOut(BaseModel):
    id: int
    inicio: datetime
    fin: datetime
    estado: EstadoReserva
    total_precio: Decimal
    pago_profesional: Decimal | None
    metodo_pago: MetodoPago | None
    cliente_id: int
    cliente_nombre: str
    cliente_telefono: str | None
    servicios: list[str]
    # Resumen de la última sesión registrada en el historial del cliente.
    ultima_nota: str | None = None
    ultima_nota_fecha: datetime | None = None


class ComisionesOut(BaseModel):
    desde: date
    hasta: date
    tipo_comision: TipoComision
    valor_comision: float
    turnos_completados: int
    total_generado: Decimal      # facturación de sus turnos
    total_comision: Decimal      # lo que cobra el profesional
    total_local: Decimal         # lo que queda para el local


class PerfilProfesionalOut(BaseModel):
    profesional_id: int
    nombre: str
    foto: str | None
    negocio_id: int
    negocio_nombre: str
    tipo_comision: TipoComision
    valor_comision: float


# ── Credenciales y comisión (gestión del admin) ──────────────────────────


class CredencialesProfesionalIn(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    dni: str = Field(min_length=4, max_length=20)
    password: str = Field(min_length=6, max_length=120)
    email: str | None = None


class ComisionProfesionalIn(BaseModel):
    tipo_comision: TipoComision
    valor_comision: float = Field(ge=0, le=100)


class CredencialesProfesionalOut(BaseModel):
    profesional_id: int
    usuario_id: int
    username: str


# ── Ficha técnica del cliente ────────────────────────────────────────────


class HistorialIn(BaseModel):
    notas_estilo: str = Field(min_length=1, max_length=5000)


class HistorialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cliente_id: int
    profesional_id: int | None
    notas_estilo: str
    fecha_actualizacion: datetime


class HistorialConAutorOut(HistorialOut):
    profesional_nombre: str | None = None


# ── Lista de espera ──────────────────────────────────────────────────────


class ListaEsperaCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    telefono: str = Field(min_length=6, max_length=40)
    fecha: date
    bloque: BloqueHorario


class ListaEsperaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    telefono: str
    fecha: date
    bloque: BloqueHorario
    estado: EstadoListaEspera
    oferta_inicio: datetime | None
    notificado_en: datetime | None
    creado_en: datetime


# ── Reporte de caja diaria ───────────────────────────────────────────────


class CajaMetodoOut(BaseModel):
    metodo_pago: str   # efectivo | transferencia | mercado_pago | sin_registrar
    cantidad: int
    total: Decimal


class CajaDiariaOut(BaseModel):
    fecha: date
    total: Decimal
    total_comisiones: Decimal
    total_local: Decimal
    turnos_completados: int
    por_metodo: list[CajaMetodoOut]


# ── Horas muertas ────────────────────────────────────────────────────────


class FranjaOcupacionOut(BaseModel):
    dia_semana: int          # 0 = lunes ... 6 = domingo
    dia_nombre: str
    bloque: str              # "Mañana" | "Tarde"
    ocupacion_pct: float     # 0–100
    turnos: int
    capacidad: int
    alerta: bool             # ocupación < 20 %


class HorasMuertasOut(BaseModel):
    desde: date
    hasta: date
    franjas: list[FranjaOcupacionOut]
    sugerencias: list[str]


# ── Rendimiento por profesional ──────────────────────────────────────────


class RendimientoProfesionalOut(BaseModel):
    profesional_id: int
    nombre: str
    turnos_completados: int
    ingresos_generados: Decimal   # facturación de sus turnos completados
    comision: Decimal             # lo que cobra el profesional
    para_local: Decimal           # lo que queda para el local


class RendimientoOut(BaseModel):
    desde: date
    hasta: date
    profesionales: list[RendimientoProfesionalOut]
    total_ingresos: Decimal
    total_comisiones: Decimal
    total_local: Decimal
