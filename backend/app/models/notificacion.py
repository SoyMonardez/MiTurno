from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.enums import (
    EstadoNotificacion,
    EstadoRecordatorio,
    TipoNotificacion,
    TipoRecordatorio,
)


class RecordatorioProgramado(Base):
    __tablename__ = "recordatorios_programados"

    id: Mapped[int] = mapped_column(primary_key=True)
    reserva_id: Mapped[int] = mapped_column(ForeignKey("reservas.id"), index=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"))
    tipo: Mapped[TipoRecordatorio] = mapped_column()
    enviar_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    estado: Mapped[EstadoRecordatorio] = mapped_column(default=EstadoRecordatorio.pendiente)


class NotificacionLog(Base):
    __tablename__ = "notificacion_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    reserva_id: Mapped[int | None] = mapped_column(ForeignKey("reservas.id"), default=None)
    tipo: Mapped[TipoNotificacion] = mapped_column()
    destinatario: Mapped[str] = mapped_column(String(255))
    enviado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    estado: Mapped[EstadoNotificacion] = mapped_column(default=EstadoNotificacion.pendiente)
