from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.catalogo import Categoria, Servicio
from app.models.negocio import Negocio
from app.models.profesional import Profesional
from app.models.resena import Resena
from app.schemas.negocio import NegocioCreate, NegocioOut, NegocioPublico

router = APIRouter(prefix="/negocios", tags=["negocios"])


@router.post("", response_model=NegocioOut, status_code=201)
def crear_negocio(data: NegocioCreate, db: Session = Depends(get_db)) -> Negocio:
    existe = db.scalar(select(Negocio).where(Negocio.slug == data.slug))
    if existe:
        raise HTTPException(409, "El slug ya está en uso")
    negocio = Negocio(**data.model_dump())
    db.add(negocio)
    db.commit()
    db.refresh(negocio)
    return negocio


@router.get("", response_model=list[NegocioOut])
def listar_negocios(db: Session = Depends(get_db)) -> list[Negocio]:
    return list(db.scalars(select(Negocio).order_by(Negocio.nombre)))


@router.get("/{slug}", response_model=NegocioPublico)
def negocio_publico(slug: str, db: Session = Depends(get_db)) -> NegocioPublico:
    negocio = db.scalar(select(Negocio).where(Negocio.slug == slug, Negocio.activo))
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")

    categorias = list(
        db.scalars(
            select(Categoria)
            .where(Categoria.negocio_id == negocio.id)
            .order_by(Categoria.orden)
        )
    )
    servicios = list(
        db.scalars(
            select(Servicio)
            .where(Servicio.negocio_id == negocio.id, Servicio.activo)
            .order_by(Servicio.nombre)
        )
    )
    profesionales = list(
        db.scalars(select(Profesional).where(Profesional.negocio_id == negocio.id))
    )
    promedio = db.scalar(
        select(func.avg(Resena.puntuacion)).where(Resena.negocio_id == negocio.id)
    )

    return NegocioPublico(
        **NegocioOut.model_validate(negocio).model_dump(),
        categorias=categorias,
        servicios=servicios,
        profesionales=profesionales,
        calificacion_promedio=float(promedio) if promedio is not None else None,
    )
