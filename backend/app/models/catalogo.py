from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import BadgeServicio


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    orden: Mapped[int] = mapped_column(Integer, default=0)

    servicios: Mapped[list["Servicio"]] = relationship(back_populates="categoria")


class Servicio(Base):
    __tablename__ = "servicios"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    categoria_id: Mapped[int | None] = mapped_column(ForeignKey("categorias.id"), default=None)
    nombre: Mapped[str] = mapped_column(String(150))
    descripcion: Mapped[str | None] = mapped_column(String(2000), default=None)
    duracion_min: Mapped[int] = mapped_column(Integer)
    buffer_min: Mapped[int] = mapped_column(Integer, default=0)
    precio: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    imagen: Mapped[str | None] = mapped_column(String(500), default=None)
    badge: Mapped[BadgeServicio] = mapped_column(default=BadgeServicio.ninguno)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    categoria: Mapped["Categoria | None"] = relationship(back_populates="servicios")
