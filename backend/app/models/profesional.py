from datetime import date, time

from sqlalchemy import (
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import TipoComision, TipoExcepcion

profesional_servicio = Table(
    "profesional_servicio",
    Base.metadata,
    Column("profesional_id", ForeignKey("profesionales.id"), primary_key=True),
    Column("servicio_id", ForeignKey("servicios.id"), primary_key=True),
)


class Profesional(Base):
    __tablename__ = "profesionales"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    foto: Mapped[str | None] = mapped_column(String(500), default=None)
    bio: Mapped[str | None] = mapped_column(String(2000), default=None)
    calificacion_promedio: Mapped[float | None] = mapped_column(Numeric(3, 2), default=None)
    # Usuario asociado para el login individual del profesional (plan Premium).
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), default=None)
    # Regla financiera: % por corte (ej: 25.00, 35.00, 45.00) o sueldo fijo del local.
    tipo_comision: Mapped[TipoComision] = mapped_column(default=TipoComision.porcentaje_corte)
    valor_comision: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    servicios: Mapped[list["Servicio"]] = relationship(secondary=profesional_servicio)
    horarios: Mapped[list["HorarioRecurrente"]] = relationship(back_populates="profesional")
    excepciones: Mapped[list["ExcepcionAgenda"]] = relationship(back_populates="profesional")


class HorarioRecurrente(Base):
    __tablename__ = "horarios_recurrentes"

    id: Mapped[int] = mapped_column(primary_key=True)
    profesional_id: Mapped[int] = mapped_column(ForeignKey("profesionales.id"), index=True)
    dia_semana: Mapped[int] = mapped_column(Integer)  # 0 = lunes ... 6 = domingo
    hora_inicio: Mapped[time] = mapped_column(Time)
    hora_fin: Mapped[time] = mapped_column(Time)

    profesional: Mapped["Profesional"] = relationship(back_populates="horarios")


class ExcepcionAgenda(Base):
    __tablename__ = "excepciones_agenda"

    id: Mapped[int] = mapped_column(primary_key=True)
    profesional_id: Mapped[int] = mapped_column(ForeignKey("profesionales.id"), index=True)
    fecha: Mapped[date] = mapped_column(Date)
    tipo: Mapped[TipoExcepcion] = mapped_column()
    hora_inicio: Mapped[time | None] = mapped_column(Time, default=None)
    hora_fin: Mapped[time | None] = mapped_column(Time, default=None)

    profesional: Mapped["Profesional"] = relationship(back_populates="excepciones")


from app.models.catalogo import Servicio  # noqa: E402
