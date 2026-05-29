from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.catalogo import Categoria, Servicio
from app.models.negocio import Negocio
from app.schemas.catalogo import (
    CategoriaCreate,
    CategoriaOut,
    CategoriaUpdate,
    ServicioCreate,
    ServicioOut,
    ServicioUpdate,
)

router = APIRouter(tags=["catálogo"])


def _negocio_o_404(negocio_id: int, db: Session) -> Negocio:
    negocio = db.get(Negocio, negocio_id)
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")
    return negocio


# --- Categorías ---


@router.post("/negocios/{negocio_id}/categorias", response_model=CategoriaOut, status_code=201)
def crear_categoria(
    negocio_id: int, data: CategoriaCreate, db: Session = Depends(get_db)
) -> Categoria:
    _negocio_o_404(negocio_id, db)
    categoria = Categoria(negocio_id=negocio_id, **data.model_dump())
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria


@router.get("/negocios/{negocio_id}/categorias", response_model=list[CategoriaOut])
def listar_categorias(negocio_id: int, db: Session = Depends(get_db)) -> list[Categoria]:
    return list(
        db.scalars(
            select(Categoria)
            .where(Categoria.negocio_id == negocio_id)
            .order_by(Categoria.orden)
        )
    )


@router.patch("/categorias/{categoria_id}", response_model=CategoriaOut)
def actualizar_categoria(
    categoria_id: int, data: CategoriaUpdate, db: Session = Depends(get_db)
) -> Categoria:
    categoria = db.get(Categoria, categoria_id)
    if not categoria:
        raise HTTPException(404, "Categoría no encontrada")
    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(categoria, campo, valor)
    db.commit()
    db.refresh(categoria)
    return categoria


@router.delete("/categorias/{categoria_id}", status_code=204)
def eliminar_categoria(categoria_id: int, db: Session = Depends(get_db)) -> None:
    categoria = db.get(Categoria, categoria_id)
    if not categoria:
        raise HTTPException(404, "Categoría no encontrada")
    # Desasignar servicios que la usaban (no los borra)
    for servicio in db.scalars(
        select(Servicio).where(Servicio.categoria_id == categoria_id)
    ):
        servicio.categoria_id = None
    db.delete(categoria)
    db.commit()


# --- Servicios ---


@router.post("/negocios/{negocio_id}/servicios", response_model=ServicioOut, status_code=201)
def crear_servicio(
    negocio_id: int, data: ServicioCreate, db: Session = Depends(get_db)
) -> Servicio:
    _negocio_o_404(negocio_id, db)
    servicio = Servicio(negocio_id=negocio_id, **data.model_dump())
    db.add(servicio)
    db.commit()
    db.refresh(servicio)
    return servicio


@router.get("/negocios/{negocio_id}/servicios", response_model=list[ServicioOut])
def listar_servicios(negocio_id: int, db: Session = Depends(get_db)) -> list[Servicio]:
    return list(
        db.scalars(
            select(Servicio)
            .where(Servicio.negocio_id == negocio_id)
            .order_by(Servicio.nombre)
        )
    )


@router.patch("/servicios/{servicio_id}", response_model=ServicioOut)
def actualizar_servicio(
    servicio_id: int, data: ServicioUpdate, db: Session = Depends(get_db)
) -> Servicio:
    servicio = db.get(Servicio, servicio_id)
    if not servicio:
        raise HTTPException(404, "Servicio no encontrado")
    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(servicio, campo, valor)
    db.commit()
    db.refresh(servicio)
    return servicio


@router.delete("/servicios/{servicio_id}", status_code=204)
def eliminar_servicio(servicio_id: int, db: Session = Depends(get_db)) -> None:
    servicio = db.get(Servicio, servicio_id)
    if not servicio:
        raise HTTPException(404, "Servicio no encontrado")
    
    # Desvincular de profesionales (tabla N:N)
    from app.models.profesional import profesional_servicio
    db.execute(
        profesional_servicio.delete().where(
            profesional_servicio.c.servicio_id == servicio_id
        )
    )
    
    from sqlalchemy.exc import IntegrityError
    try:
        db.delete(servicio)
        db.commit()
    except IntegrityError:
        db.rollback()
        # Fallback a desactivar si tiene reservas
        servicio.activo = False
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el servicio porque tiene reservas asociadas. Se ha desactivado en su lugar."
        )
