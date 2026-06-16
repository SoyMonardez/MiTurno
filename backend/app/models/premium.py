"""Modelos del plan Premium: ficha técnica de clientes y lista de espera."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.enums import BloqueHorario, EstadoListaEspera


class ClienteHistorial(Base):
    """Ficha técnica: notas de estilo que el profesional consulta antes del servicio."""

    __tablename__ = "clientes_historial"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), index=True)
    # El profesional que realizó la última anotación.
    profesional_id: Mapped[int | None] = mapped_column(
        ForeignKey("profesionales.id"), default=None
    )
    notas_estilo: Mapped[str] = mapped_column(Text)
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ConversacionBot(Base):
    """Estado de una conversación de agendamiento por WhatsApp (máquina de estados)."""

    __tablename__ = "conversaciones_bot"
    __table_args__ = (
        UniqueConstraint("negocio_id", "telefono", name="uq_conversacion_negocio_tel"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    telefono: Mapped[str] = mapped_column(String(40), index=True)
    estado: Mapped[str] = mapped_column(String(30))  # servicio | dia | hora | nombre
    datos: Mapped[str | None] = mapped_column(Text, default=None)  # JSON con el contexto
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ListaEspera(Base):
    """Cola de espera para días con ocupación completa (plan Premium)."""

    __tablename__ = "lista_espera"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    telefono: Mapped[str] = mapped_column(String(40), index=True)
    fecha: Mapped[date] = mapped_column(Date, index=True)
    bloque: Mapped[BloqueHorario] = mapped_column()
    profesional_id: Mapped[int | None] = mapped_column(
        ForeignKey("profesionales.id"), default=None
    )
    estado: Mapped[EstadoListaEspera] = mapped_column(default=EstadoListaEspera.pendiente)
    # Datos del turno liberado que se le ofreció por WhatsApp (para crear la
    # reserva si responde "SÍ").
    oferta_inicio: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    oferta_profesional_id: Mapped[int | None] = mapped_column(
        ForeignKey("profesionales.id"), default=None
    )
    notificado_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
