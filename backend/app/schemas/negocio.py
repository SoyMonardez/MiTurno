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
    logo_qr: str | None = None
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
    logo_qr: str | None = None
    icono: str | None = None
    cancelacion_anticipacion_min: int | None = None
    redes: str | None = None
    mapa_url: str | None = None
    whatsapp_instancia: str | None = None
    recordatorios_canal: str | None = None  # email | whatsapp | ambos


class NegocioOut(NegocioBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    activo: bool


class NegocioAdminOut(NegocioOut):
    """Vista del admin: incluye plan e instancia de WhatsApp (no públicos)."""

    plan: str = "pro"
    whatsapp_instancia: str | None = None
    recordatorios_canal: str = "email"


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
    # Premium: permite anotarse en lista de espera cuando el día está lleno.
    lista_espera_habilitada: bool = False
