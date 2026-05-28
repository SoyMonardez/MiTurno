from datetime import datetime

from pydantic import BaseModel


class SlotOut(BaseModel):
    inicio: datetime  # UTC
    profesional_id: int


class FranjasOut(BaseModel):
    """Slots agrupados por franja horaria (hora local del negocio)."""

    manana: list[SlotOut] = []
    tarde: list[SlotOut] = []
    noche: list[SlotOut] = []
