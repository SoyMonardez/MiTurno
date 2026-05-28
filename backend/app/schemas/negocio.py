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
    redes: str | None = None


class NegocioCreate(NegocioBase):
    pass


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


class NegocioPublico(NegocioOut):
    """Vista pública: negocio + catálogo + profesionales."""

    categorias: list[CategoriaOut] = []
    servicios: list[ServicioOut] = []
    profesionales: list[ProfesionalPublico] = []
    calificacion_promedio: float | None = None
