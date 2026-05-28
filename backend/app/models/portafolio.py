from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PortafolioImagen(Base):
    __tablename__ = "portafolio_imagenes"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    orden: Mapped[int] = mapped_column(Integer, default=0)
