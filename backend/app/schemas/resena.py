from datetime import datetime

from pydantic import BaseModel, Field


class ResenaCreate(BaseModel):
    puntuacion: int = Field(ge=1, le=5)
    comentario: str | None = None


class ResenaPublicaCreate(BaseModel):
    puntuacion: int = Field(ge=1, le=5)
    comentario: str | None = None
    autor_nombre: str = Field(min_length=2, max_length=120)
    autor_email: str | None = None
    profesional_id: int | None = None


class ResenaOut(BaseModel):
    id: int
    puntuacion: int
    comentario: str | None
    creado_en: datetime
    cliente_nombre: str          # nombre del autor (cliente o anónimo)
    profesional_nombre: str | None


class PortafolioCreate(BaseModel):
    url: str
    orden: int = 0


class PortafolioOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    url: str
    orden: int
