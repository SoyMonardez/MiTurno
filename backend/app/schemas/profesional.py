from datetime import time

from pydantic import BaseModel, ConfigDict


class HorarioBase(BaseModel):
    dia_semana: int  # 0 = lunes ... 6 = domingo
    hora_inicio: time
    hora_fin: time


class HorarioCreate(HorarioBase):
    pass


class HorarioOut(HorarioBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    profesional_id: int


class ProfesionalBase(BaseModel):
    nombre: str
    foto: str | None = None
    bio: str | None = None


class ProfesionalCreate(ProfesionalBase):
    servicio_ids: list[int] = []


class ProfesionalUpdate(BaseModel):
    nombre: str | None = None
    foto: str | None = None
    bio: str | None = None
    servicio_ids: list[int] | None = None


class ProfesionalOut(ProfesionalBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    negocio_id: int
    calificacion_promedio: float | None = None
    servicio_ids: list[int] = []
