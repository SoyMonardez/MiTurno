from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_admin
from app.api.deps import get_db
from app.models.catalogo import Categoria, Servicio
from app.models.negocio import Negocio, Usuario
from app.models.profesional import Profesional
from app.models.resena import Resena
from app.schemas.negocio import (
    NegocioCreate,
    NegocioOut,
    NegocioPublico,
    NegocioUpdate,
    ProfesionalPublico,
)

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


# --- Configuración del negocio (admin) ---
# Va ANTES de "/{slug}" para que "mi-negocio" no se interprete como slug.


@router.get("/mi-negocio", response_model=NegocioOut)
def obtener_mi_negocio(
    admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)
) -> Negocio:
    negocio = db.get(Negocio, admin.negocio_id)
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")
    return negocio


@router.patch("/mi-negocio", response_model=NegocioOut)
def actualizar_mi_negocio(
    data: NegocioUpdate,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> Negocio:
    negocio = db.get(Negocio, admin.negocio_id)
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")
    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(negocio, campo, valor)
    db.commit()
    db.refresh(negocio)
    return negocio


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

    profesionales_out = []
    for p in profesionales:
        p_dict = ProfesionalPublico.model_validate(p).model_dump()
        p_dict["servicio_ids"] = [s.id for s in p.servicios]
        profesionales_out.append(ProfesionalPublico(**p_dict))

    return NegocioPublico(
        **NegocioOut.model_validate(negocio).model_dump(),
        categorias=categorias,
        servicios=servicios,
        profesionales=profesionales_out,
        calificacion_promedio=float(promedio) if promedio is not None else None,
    )
