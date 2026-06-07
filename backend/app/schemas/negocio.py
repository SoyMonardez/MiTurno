from pydantic import BaseModel, ConfigDict

from app.schemas.catalogo import CategoriaOut, ServicioOut


class NegocioBase(BaseModel):
    nombre: str
    slug: str
    descripcion: str | None = None
    direccion: str | None = None
    zona_horaria: str = "America/Argentina/Buenos_Aires"
    email_notificaciones: str | None = None
    logo: str | None = None
    icono: str = "scissors"
    cancelacion_anticipacion_min: int = 20
    redes: str | None = None
    mapa_url: str | None = None


class NegocioCreate(NegocioBase):
    pass


class NegocioUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    direccion: str | None = None
    zona_horaria: str | None = None
    email_notificaciones: str | None = None
    logo: str | None = None
    icono: str | None = None
    cancelacion_anticipacion_min: int | None = None
    redes: str | None = None
    mapa_url: str | None = None


class NegocioOut(NegocioBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    activo: bool


class ProfesionalPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    foto: str | None = None
    bio: str | None = None
    calificacion_promedio: float | None = None
    servicio_ids: list[int] = []


class NegocioPublico(NegocioOut):
    """Vista pública: negocio + catálogo + profesionales."""

    categorias: list[CategoriaOut] = []
    servicios: list[ServicioOut] = []
    profesionales: list[ProfesionalPublico] = []
    calificacion_promedio: float | None = None
