from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Resena(Base):
    __tablename__ = "resenas"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    reserva_id: Mapped[int] = mapped_column(ForeignKey("reservas.id"))
    profesional_id: Mapped[int | None] = mapped_column(ForeignKey("profesionales.id"), default=None)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"))
    puntuacion: Mapped[int] = mapped_column(Integer)  # 1..5
    comentario: Mapped[str | None] = mapped_column(String(2000), default=None)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
