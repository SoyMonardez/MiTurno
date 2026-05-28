from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import BadgeServicio


class CategoriaBase(BaseModel):
    nombre: str
    orden: int = 0


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaOut(CategoriaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    negocio_id: int


class CategoriaUpdate(BaseModel):
    nombre: str | None = None
    orden: int | None = None


class ServicioBase(BaseModel):
    nombre: str
    descripcion: str | None = None
    duracion_min: int
    buffer_min: int = 0
    precio: Decimal = Decimal("0")
    imagen: str | None = None
    badge: BadgeServicio = BadgeServicio.ninguno
    activo: bool = True
    categoria_id: int | None = None


class ServicioCreate(ServicioBase):
    pass


class ServicioUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    duracion_min: int | None = None
    buffer_min: int | None = None
    precio: Decimal | None = None
    imagen: str | None = None
    badge: BadgeServicio | None = None
    activo: bool | None = None
    categoria_id: int | None = None


class ServicioOut(ServicioBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    negocio_id: int
