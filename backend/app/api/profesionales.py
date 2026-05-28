from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.catalogo import Servicio
from app.models.negocio import Negocio
from app.models.profesional import ExcepcionAgenda, HorarioRecurrente, Profesional
from app.schemas.profesional import (
    ExcepcionCreate,
    ExcepcionOut,
    HorarioCreate,
    HorarioOut,
    ProfesionalCreate,
    ProfesionalOut,
    ProfesionalUpdate,
)

router = APIRouter(tags=["profesionales"])


def _serializar(profesional: Profesional) -> ProfesionalOut:
    return ProfesionalOut(
        id=profesional.id,
        negocio_id=profesional.negocio_id,
        nombre=profesional.nombre,
        foto=profesional.foto,
        bio=profesional.bio,
        calificacion_promedio=(
            float(profesional.calificacion_promedio)
            if profesional.calificacion_promedio is not None
            else None
        ),
        servicio_ids=[s.id for s in profesional.servicios],
    )


def _cargar_servicios(negocio_id: int, ids: list[int], db: Session) -> list[Servicio]:
    if not ids:
        return []
    servicios = list(
        db.scalars(
            select(Servicio).where(
                Servicio.id.in_(ids), Servicio.negocio_id == negocio_id
            )
        )
    )
    if len(servicios) != len(set(ids)):
        raise HTTPException(400, "Algún servicio no existe en este negocio")
    return servicios


@router.post("/negocios/{negocio_id}/profesionales", response_model=ProfesionalOut, status_code=201)
def crear_profesional(
    negocio_id: int, data: ProfesionalCreate, db: Session = Depends(get_db)
) -> ProfesionalOut:
    if not db.get(Negocio, negocio_id):
        raise HTTPException(404, "Negocio no encontrado")
    profesional = Profesional(
        negocio_id=negocio_id, nombre=data.nombre, foto=data.foto, bio=data.bio
    )
    profesional.servicios = _cargar_servicios(negocio_id, data.servicio_ids, db)
    db.add(profesional)
    db.commit()
    db.refresh(profesional)
    return _serializar(profesional)


@router.get("/negocios/{negocio_id}/profesionales", response_model=list[ProfesionalOut])
def listar_profesionales(negocio_id: int, db: Session = Depends(get_db)) -> list[ProfesionalOut]:
    profesionales = db.scalars(
        select(Profesional).where(Profesional.negocio_id == negocio_id)
    )
    return [_serializar(p) for p in profesionales]


@router.patch("/profesionales/{profesional_id}", response_model=ProfesionalOut)
def actualizar_profesional(
    profesional_id: int, data: ProfesionalUpdate, db: Session = Depends(get_db)
) -> ProfesionalOut:
    profesional = db.get(Profesional, profesional_id)
    if not profesional:
        raise HTTPException(404, "Profesional no encontrado")
    if data.nombre is not None:
        profesional.nombre = data.nombre
    if data.foto is not None:
        profesional.foto = data.foto
    if data.bio is not None:
        profesional.bio = data.bio
    if data.servicio_ids is not None:
        profesional.servicios = _cargar_servicios(
            profesional.negocio_id, data.servicio_ids, db
        )
    db.commit()
    db.refresh(profesional)
    return _serializar(profesional)


# --- Horarios recurrentes ---


@router.post(
    "/profesionales/{profesional_id}/horarios", response_model=HorarioOut, status_code=201
)
def crear_horario(
    profesional_id: int, data: HorarioCreate, db: Session = Depends(get_db)
) -> HorarioRecurrente:
    if not db.get(Profesional, profesional_id):
        raise HTTPException(404, "Profesional no encontrado")
    if data.hora_fin <= data.hora_inicio:
        raise HTTPException(400, "hora_fin debe ser posterior a hora_inicio")
    horario = HorarioRecurrente(profesional_id=profesional_id, **data.model_dump())
    db.add(horario)
    db.commit()
    db.refresh(horario)
    return horario


@router.get("/profesionales/{profesional_id}/horarios", response_model=list[HorarioOut])
def listar_horarios(profesional_id: int, db: Session = Depends(get_db)) -> list[HorarioRecurrente]:
    return list(
        db.scalars(
            select(HorarioRecurrente)
            .where(HorarioRecurrente.profesional_id == profesional_id)
            .order_by(HorarioRecurrente.dia_semana, HorarioRecurrente.hora_inicio)
        )
    )


@router.delete("/horarios/{horario_id}", status_code=204)
def eliminar_horario(horario_id: int, db: Session = Depends(get_db)) -> None:
    horario = db.get(HorarioRecurrente, horario_id)
    if not horario:
        raise HTTPException(404, "Horario no encontrado")
    db.delete(horario)
    db.commit()


# --- Excepciones de agenda (vacaciones / feriados / horario especial) ---


@router.post(
    "/profesionales/{profesional_id}/excepciones", response_model=ExcepcionOut, status_code=201
)
def crear_excepcion(
    profesional_id: int, data: ExcepcionCreate, db: Session = Depends(get_db)
) -> ExcepcionAgenda:
    if not db.get(Profesional, profesional_id):
        raise HTTPException(404, "Profesional no encontrado")
    excepcion = ExcepcionAgenda(profesional_id=profesional_id, **data.model_dump())
    db.add(excepcion)
    db.commit()
    db.refresh(excepcion)
    return excepcion


@router.get("/profesionales/{profesional_id}/excepciones", response_model=list[ExcepcionOut])
def listar_excepciones(profesional_id: int, db: Session = Depends(get_db)) -> list[ExcepcionAgenda]:
    return list(
        db.scalars(
            select(ExcepcionAgenda)
            .where(ExcepcionAgenda.profesional_id == profesional_id)
            .order_by(ExcepcionAgenda.fecha)
        )
    )


@router.delete("/excepciones/{excepcion_id}", status_code=204)
def eliminar_excepcion(excepcion_id: int, db: Session = Depends(get_db)) -> None:
    excepcion = db.get(ExcepcionAgenda, excepcion_id)
    if not excepcion:
        raise HTTPException(404, "Excepción no encontrada")
    db.delete(excepcion)
    db.commit()
