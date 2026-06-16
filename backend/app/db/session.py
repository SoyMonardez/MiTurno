from collections.abc import Generator

from fastapi import Request
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


@event.listens_for(Session, "after_begin")
def set_rls_context_on_begin(session, transaction, connection):
    bypass_rls = session.info.get("bypass_rls", True)
    if bypass_rls:
        connection.execute(text("SET LOCAL app.bypass_rls = 'true'"))
    else:
        usuario_id = session.info.get("current_user_id")
        negocio_id = session.info.get("current_negocio_id")
        rol = session.info.get("current_user_rol")
        token = session.info.get("current_cancelacion_token")
        profesional_id = session.info.get("current_profesional_id")

        connection.execute(text("SET LOCAL app.bypass_rls = 'false'"))
        connection.execute(
            text("SET LOCAL app.current_user_id = :uid"),
            {"uid": str(usuario_id) if usuario_id is not None else ""}
        )
        connection.execute(
            text("SET LOCAL app.current_negocio_id = :nid"),
            {"nid": str(negocio_id) if negocio_id is not None else ""}
        )
        connection.execute(
            text("SET LOCAL app.current_user_rol = :rol"),
            {"rol": str(rol) if rol is not None else ""}
        )
        connection.execute(
            text("SET LOCAL app.current_cancelacion_token = :token"),
            {"token": str(token) if token is not None else ""}
        )
        connection.execute(
            text("SET LOCAL app.current_profesional_id = :pid"),
            {"pid": str(profesional_id) if profesional_id is not None else ""}
        )


def get_db(request: Request = None) -> Generator[Session, None, None]:
    db = SessionLocal()
    if request is not None:
        db.info["bypass_rls"] = False
        db.info["current_user_id"] = None
        db.info["current_negocio_id"] = None
        db.info["current_user_rol"] = None
        db.info["current_cancelacion_token"] = None
    else:
        db.info["bypass_rls"] = True
    try:
        yield db
    finally:
        db.close()

