from datetime import datetime

from pydantic import BaseModel, Field

# Precios por plan (ARS/mes). Fuente única de verdad.
PLAN_PRECIOS: dict[str, int] = {
    "basico": 13_000,
    "pro": 22_000,
    "premium": 35_000,
}
PLAN_LABELS: dict[str, str] = {
    "basico": "Básico",
    "pro": "Pro",
    "premium": "Premium",
}


class NegocioConAdminCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=120)
    descripcion: str | None = None
    direccion: str | None = None
    zona_horaria: str = "America/Argentina/Buenos_Aires"
    email_notificaciones: str | None = None
    plan: str = "pro"
    admin_nombre: str = Field(min_length=2, max_length=120)
    admin_username: str = Field(min_length=3, max_length=60)
    admin_dni: str = Field(min_length=4, max_length=20)
    admin_password: str = Field(min_length=6, max_length=100)
    admin_email: str


class AdminResumen(BaseModel):
    id: int
    nombre: str
    username: str | None
    dni: str | None
    activo: bool


class NuevoAdminCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    email: str
    username: str = Field(min_length=3, max_length=60)
    dni: str = Field(min_length=4, max_length=20)
    password: str = Field(min_length=6, max_length=100)


class NegocioResumen(BaseModel):
    id: int
    nombre: str
    slug: str
    activo: bool
    plan: str
    precio_mensual: int
    creado_en: datetime
    admins: list[AdminResumen]
    # primer admin (compat con modal eliminar existente)
    admin_nombre: str | None
    admin_username: str | None
    admin_dni: str | None
    total_turnos: int
    total_clientes: int


class NegocioActivar(BaseModel):
    activo: bool


class ResetAdminPassword(BaseModel):
    password: str = Field(min_length=6, max_length=100)


class NegocioEditar(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=120)
    plan: str = "pro"


class MetricasGlobales(BaseModel):
    total_negocios: int
    negocios_activos: int
    facturacion_mensual: int
    facturacion_anual: int
