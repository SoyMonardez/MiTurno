from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import EstadoReserva, SegmentoCliente


class ReservaAdminOut(BaseModel):
    id: int
    inicio: datetime
    fin: datetime
    estado: EstadoReserva
    total_precio: Decimal
    total_duracion: int
    cliente_nombre: str
    cliente_email: str
    cliente_telefono: str | None
    profesional_nombre: str
    servicios: list[str]


class AsistenciaIn(BaseModel):
    estado: EstadoReserva  # completada | no_show


class ClienteAdminOut(BaseModel):
    id: int
    nombre: str
    email: str
    telefono: str | None
    segmento: SegmentoCliente
    turnos_completados: int
    turnos_cancelados: int
    no_shows: int
    ultima_visita: datetime | None


class AccesoOut(BaseModel):
    usuario_nombre: str
    usuario_dni: str | None
    ingreso_en: datetime


class EstadisticaDiaOut(BaseModel):
    fecha: date
    turnos: int


class EstadisticasOut(BaseModel):
    datos: list[EstadisticaDiaOut]


class SugerenciaIn(BaseModel):
    mensaje: str
    tipo_negocio: str = ""


class ServicioSugerido(BaseModel):
    nombre: str
    descripcion: str
    duracion_min: int
    precio_sugerido: int


class SugerenciaOut(BaseModel):
    respuesta: str
    servicios: list[ServicioSugerido]


class TextoIn(BaseModel):
    texto: str


class SugerenciaTextoOut(BaseModel):
    texto: str


class DashboardOut(BaseModel):
    turnos_hoy: int
    turnos_semana: int
    hoy: list[ReservaAdminOut]
    proximos: list[ReservaAdminOut]
    accesos_recientes: list[AccesoOut]


class SugerenciaCategoriasOut(BaseModel):
    categorias: list[str]


class ServicioPopularOut(BaseModel):
    nombre: str
    cantidad: int
    ingresos: Decimal


class ClienteFrecuenteOut(BaseModel):
    nombre: str
    telefono: str | None
    turnos: int


class ReportesOut(BaseModel):
    # Período
    desde: date
    hasta: date
    # Ingresos
    ingresos_total: Decimal
    ingresos_promedio: Decimal
    # Turnos
    turnos_total: int
    turnos_completados: int
    turnos_cancelados: int
    turnos_no_show: int
    tasa_no_show: float        # 0–100 %
    tasa_cancelacion: float    # 0–100 %
    # Rankings
    servicios_populares: list[ServicioPopularOut]   # top 5
    clientes_frecuentes: list[ClienteFrecuenteOut]  # top 5
    # Mejor día de la semana (0=lun…6=dom)
    mejor_dia_semana: str | None
    # Hora pico (franja con más turnos)
    hora_pico: str | None
