from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.cliente import Cliente
from app.models.profesional import Profesional
from app.models.resena import Resena
from app.models.negocio import Negocio
from app.schemas.resena import ResenaCreate, ResenaOut, ResenaPublicaCreate
from app.services.resenas import crear_resena_por_token

router = APIRouter(tags=["reseñas"])


def _serializar(resena: Resena, db: Session) -> ResenaOut:
    cliente = db.get(Cliente, resena.cliente_id) if resena.cliente_id else None
    profesional = (
        db.get(Profesional, resena.profesional_id) if resena.profesional_id else None
    )
    nombre = (
        resena.autor_nombre
        or (cliente.nombre if cliente else "Anónimo")
    )
    return ResenaOut(
        id=resena.id,
        puntuacion=resena.puntuacion,
        comentario=resena.comentario,
        creado_en=resena.creado_en,
        cliente_nombre=nombre,
        profesional_nombre=profesional.nombre if profesional else None,
    )


@router.post("/reservas/{token}/resena", response_model=ResenaOut, status_code=201)
def crear_resena(token: str, data: ResenaCreate, db: Session = Depends(get_db)) -> ResenaOut:
    resena = crear_resena_por_token(token, data, db)
    return _serializar(resena, db)


@router.post("/negocios/{negocio_id}/resenas", response_model=ResenaOut, status_code=201)
def crear_resena_publica(
    negocio_id: int, data: ResenaPublicaCreate, db: Session = Depends(get_db)
) -> ResenaOut:
    from decimal import Decimal
    from sqlalchemy import func as sqlfunc

    negocio = db.get(Negocio, negocio_id)
    if not negocio:
        from fastapi import HTTPException
        raise HTTPException(404, "Negocio no encontrado")

    resena = Resena(
        negocio_id=negocio_id,
        profesional_id=data.profesional_id,
        puntuacion=data.puntuacion,
        comentario=data.comentario,
        autor_nombre=data.autor_nombre,
        autor_email=data.autor_email,
    )
    db.add(resena)
    db.flush()

    # Recalcular promedio del profesional si se indicó uno
    if data.profesional_id:
        promedio = db.scalar(
            select(sqlfunc.avg(Resena.puntuacion)).where(
                Resena.profesional_id == data.profesional_id
            )
        )
        prof = db.get(Profesional, data.profesional_id)
        if prof:
            prof.calificacion_promedio = (
                Decimal(promedio).quantize(Decimal("0.01")) if promedio is not None else None
            )

    db.commit()
    db.refresh(resena)
    return _serializar(resena, db)


@router.get("/negocios/{negocio_id}/resenas", response_model=list[ResenaOut])
def listar_resenas(negocio_id: int, db: Session = Depends(get_db)) -> list[ResenaOut]:
    resenas = db.scalars(
        select(Resena)
        .where(Resena.negocio_id == negocio_id)
        .order_by(Resena.creado_en.desc())
    )
    return [_serializar(r, db) for r in resenas]
