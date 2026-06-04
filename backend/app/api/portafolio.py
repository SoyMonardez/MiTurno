from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_admin
from app.api.deps import get_db
from app.core.planes import requiere_plan
from app.models.negocio import Negocio, Usuario
from app.models.portafolio import PortafolioImagen
from app.schemas.resena import PortafolioCreate, PortafolioOut

router = APIRouter(tags=["portafolio"])


@router.get("/negocios/{negocio_id}/portafolio", response_model=list[PortafolioOut])
def listar_portafolio(negocio_id: int, db: Session = Depends(get_db)) -> list[PortafolioImagen]:
    return list(
        db.scalars(
            select(PortafolioImagen)
            .where(PortafolioImagen.negocio_id == negocio_id)
            .order_by(PortafolioImagen.orden)
        )
    )


@router.post("/admin/portafolio", response_model=PortafolioOut, status_code=201)
def agregar_imagen(
    data: PortafolioCreate,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> PortafolioImagen:
    negocio = db.get(Negocio, admin.negocio_id)
    requiere_plan(negocio.plan if negocio else None, "pro", "El portafolio de fotos")
    imagen = PortafolioImagen(negocio_id=admin.negocio_id, **data.model_dump())
    db.add(imagen)
    db.commit()
    db.refresh(imagen)
    return imagen


@router.delete("/admin/portafolio/{imagen_id}", status_code=204)
def eliminar_imagen(
    imagen_id: int,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    imagen = db.get(PortafolioImagen, imagen_id)
    if not imagen or imagen.negocio_id != admin.negocio_id:
        raise HTTPException(404, "Imagen no encontrada")
    db.delete(imagen)
    db.commit()
