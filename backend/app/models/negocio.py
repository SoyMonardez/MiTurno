from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import RolUsuario


class Negocio(Base):
    __tablename__ = "negocios"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    descripcion: Mapped[str | None] = mapped_column(String(2000), default=None)
    direccion: Mapped[str | None] = mapped_column(String(300), default=None)
    zona_horaria: Mapped[str] = mapped_column(String(64), default="America/Argentina/Buenos_Aires")
    email_notificaciones: Mapped[str | None] = mapped_column(String(255), default=None)
    logo: Mapped[str | None] = mapped_column(String(500), default=None)
    icono: Mapped[str] = mapped_column(String(40), default="scissors")
    redes: Mapped[str | None] = mapped_column(String(1000), default=None)
    mapa_url: Mapped[str | None] = mapped_column(String(1000), default=None)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="negocio")


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int | None] = mapped_column(ForeignKey("negocios.id"), default=None)
    email: Mapped[str] = mapped_column(String(255), index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    telefono: Mapped[str | None] = mapped_column(String(40), default=None)
    rol: Mapped[RolUsuario] = mapped_column(default=RolUsuario.cliente)
    google_id: Mapped[str | None] = mapped_column(String(120), unique=True, default=None)

    # Credenciales de acceso al panel (admin / super-admin).
    username: Mapped[str | None] = mapped_column(String(60), unique=True, default=None)
    dni: Mapped[str | None] = mapped_column(String(20), default=None)
    password_hash: Mapped[str | None] = mapped_column(String(255), default=None)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    ultimo_login_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    negocio: Mapped["Negocio | None"] = relationship(back_populates="usuarios")


class RegistroAcceso(Base):
    """Auditoría: cada ingreso al panel queda registrado (quién y cuándo)."""

    __tablename__ = "registros_acceso"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), index=True)
    negocio_id: Mapped[int | None] = mapped_column(ForeignKey("negocios.id"), index=True)
    ingreso_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
