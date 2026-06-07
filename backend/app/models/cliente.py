from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.enums import SegmentoCliente


class Cliente(Base):
    __tablename__ = "clientes"
    __table_args__ = (
        UniqueConstraint("negocio_id", "email", name="uq_cliente_negocio_email"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    telefono: Mapped[str | None] = mapped_column(String(40), default=None)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), default=None)

    turnos_completados: Mapped[int] = mapped_column(Integer, default=0)
    turnos_cancelados: Mapped[int] = mapped_column(Integer, default=0)
    no_shows: Mapped[int] = mapped_column(Integer, default=0)
    primera_visita: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    ultima_visita: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    segmento: Mapped[SegmentoCliente] = mapped_column(default=SegmentoCliente.nuevo)
    # Si el cliente aceptó recibir recordatorios de "volvé a visitarnos".
    acepta_recordatorios: Mapped[bool] = mapped_column(Boolean, default=True)
