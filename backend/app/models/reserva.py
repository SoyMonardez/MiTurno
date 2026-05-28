from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import EstadoReserva


class Reserva(Base):
    __tablename__ = "reservas"
    __table_args__ = (
        # Evita que un profesional quede con dos reservas en el mismo horario.
        UniqueConstraint("profesional_id", "inicio", name="uq_reserva_profesional_inicio"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), index=True)
    profesional_id: Mapped[int] = mapped_column(ForeignKey("profesionales.id"), index=True)
    estado: Mapped[EstadoReserva] = mapped_column(default=EstadoReserva.confirmada)
    total_precio: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_duracion: Mapped[int] = mapped_column(Integer, default=0)  # minutos
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # UTC
    fin: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # UTC
    frecuencia_recordatorio_dias: Mapped[int | None] = mapped_column(Integer, default=None)
    token_cancelacion: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    notas: Mapped[str | None] = mapped_column(String(2000), default=None)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["ReservaItem"]] = relationship(
        back_populates="reserva", cascade="all, delete-orphan", order_by="ReservaItem.orden"
    )


class ReservaItem(Base):
    __tablename__ = "reserva_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    reserva_id: Mapped[int] = mapped_column(ForeignKey("reservas.id"), index=True)
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios.id"))
    orden: Mapped[int] = mapped_column(Integer, default=0)

    reserva: Mapped["Reserva"] = relationship(back_populates="items")
