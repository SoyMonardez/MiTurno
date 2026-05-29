from datetime import datetime

from pydantic import BaseModel, Field


class NegocioConAdminCreate(BaseModel):
    # Datos del negocio
    nombre: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=120)
    descripcion: str | None = None
    direccion: str | None = None
    zona_horaria: str = "America/Argentina/Buenos_Aires"
    email_notificaciones: str | None = None
    # Datos del admin del negocio
    admin_nombre: str = Field(min_length=2, max_length=120)
    admin_username: str = Field(min_length=3, max_length=60)
    admin_dni: str = Field(min_length=4, max_length=20)
    admin_password: str = Field(min_length=6, max_length=100)
    admin_email: str


class NegocioResumen(BaseModel):
    id: int
    nombre: str
    slug: str
    activo: bool
    creado_en: datetime
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


class MetricasGlobales(BaseModel):
    total_negocios: int
    negocios_activos: int
    total_turnos: int
    total_clientes: int
    turnos_ultimos_30_dias: int
