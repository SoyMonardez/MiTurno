from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_admin
from app.api.deps import get_db
from app.core.planes import requiere_plan
from app.core.security import hash_password
from app.models.catalogo import Servicio
from app.models.enums import RolUsuario
from app.models.negocio import Negocio, Usuario
from app.schemas.premium import (
    ComisionProfesionalIn,
    CredencialesProfesionalIn,
    CredencialesProfesionalOut,
)
from app.schemas.superadmin import PLAN_PRECIOS

# Límite de profesionales por plan
_LIMITE_PROFESIONALES = {"basico": 1, "pro": 5, "premium": None}  # None = ilimitado
from app.models.profesional import ExcepcionAgenda, HorarioRecurrente, Profesional
from app.schemas.profesional import (
    ExcepcionCreate,
    ExcepcionOut,
    HorarioCreate,
    HorarioOut,
    ProfesionalCreate,
    ProfesionalOut,
    ProfesionalUpdate,
    HorariosBulkCreate,
)

router = APIRouter(tags=["profesionales"])


def _autorizar_negocio(negocio_id: int, admin: Usuario) -> None:
    """El admin solo puede operar sobre su propio negocio (super-admin, cualquiera)."""
    if admin.rol != RolUsuario.super_admin and negocio_id != admin.negocio_id:
        raise HTTPException(403, "No tenés permiso sobre este negocio")


def _profesional_autorizado(profesional_id: int, admin: Usuario, db: Session) -> Profesional:
    profesional = db.get(Profesional, profesional_id)
    if not profesional:
        raise HTTPException(404, "Profesional no encontrado")
    _autorizar_negocio(profesional.negocio_id, admin)
    return profesional


def _serializar(
    profesional: Profesional, db: Session | None = None, incluir_premium: bool = False
) -> ProfesionalOut:
    """Serializa el profesional. Los datos financieros (comisión) y el username
    solo se incluyen en contextos autenticados (incluir_premium=True): el
    listado público no debe exponerlos."""
    salida = ProfesionalOut(
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
    if incluir_premium:
        salida.tipo_comision = profesional.tipo_comision
        salida.valor_comision = float(profesional.valor_comision or 0)
        if db is not None and profesional.usuario_id:
            usuario = db.get(Usuario, profesional.usuario_id)
            salida.username = usuario.username if usuario else None
    return salida


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
    negocio_id: int,
    data: ProfesionalCreate,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ProfesionalOut:
    _autorizar_negocio(negocio_id, admin)
    negocio = db.get(Negocio, negocio_id)
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")

    # Verificar límite de profesionales según el plan
    plan = negocio.plan or "pro"
    limite = _LIMITE_PROFESIONALES.get(plan)
    if limite is not None:
        actuales = db.scalar(
            select(func.count(Profesional.id)).where(Profesional.negocio_id == negocio_id)
        ) or 0
        if actuales >= limite:
            plan_label = {"basico": "Básico", "pro": "Pro", "premium": "Premium"}.get(plan, plan)
            raise HTTPException(
                403,
                f"El plan {plan_label} permite hasta {limite} profesional{'es' if limite != 1 else ''}. "
                f"Actualizá el plan para agregar más."
            )

    profesional = Profesional(
        negocio_id=negocio_id, nombre=data.nombre, foto=data.foto, bio=data.bio
    )
    profesional.servicios = _cargar_servicios(negocio_id, data.servicio_ids, db)
    db.add(profesional)
    db.commit()
    db.refresh(profesional)
    return _serializar(profesional, db, incluir_premium=True)


@router.get("/negocios/{negocio_id}/profesionales", response_model=list[ProfesionalOut])
def listar_profesionales(negocio_id: int, db: Session = Depends(get_db)) -> list[ProfesionalOut]:
    profesionales = db.scalars(
        select(Profesional).where(Profesional.negocio_id == negocio_id)
    )
    return [_serializar(p) for p in profesionales]


@router.patch("/profesionales/{profesional_id}", response_model=ProfesionalOut)
def actualizar_profesional(
    profesional_id: int,
    data: ProfesionalUpdate,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ProfesionalOut:
    profesional = _profesional_autorizado(profesional_id, admin, db)
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
    return _serializar(profesional, db, incluir_premium=True)


# --- Horarios recurrentes ---


@router.post(
    "/profesionales/{profesional_id}/horarios", response_model=HorarioOut, status_code=201
)
def crear_horario(
    profesional_id: int,
    data: HorarioCreate,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> HorarioRecurrente:
    _profesional_autorizado(profesional_id, admin, db)
    if data.hora_fin <= data.hora_inicio:
        raise HTTPException(400, "hora_fin debe ser posterior a hora_inicio")
    horario = HorarioRecurrente(profesional_id=profesional_id, **data.model_dump())
    db.add(horario)
    db.commit()
    db.refresh(horario)
    return horario


@router.post("/profesionales/{profesional_id}/horarios/bulk", status_code=204)
def crear_horarios_bulk(
    profesional_id: int,
    data: HorariosBulkCreate,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    _profesional_autorizado(profesional_id, admin, db)

    from sqlalchemy import delete

    if data.limpiar_existentes:
        db.execute(
            delete(HorarioRecurrente).where(
                HorarioRecurrente.profesional_id == profesional_id
            )
        )

    for dia in data.dias_semana:
        for rango in data.rangos:
            if rango.hora_fin <= rango.hora_inicio:
                raise HTTPException(400, "hora_fin debe ser posterior a hora_inicio")
            horario = HorarioRecurrente(
                profesional_id=profesional_id,
                dia_semana=dia,
                hora_inicio=rango.hora_inicio,
                hora_fin=rango.hora_fin,
            )
            db.add(horario)

    db.commit()


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
def eliminar_horario(
    horario_id: int,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    horario = db.get(HorarioRecurrente, horario_id)
    if not horario:
        raise HTTPException(404, "Horario no encontrado")
    _profesional_autorizado(horario.profesional_id, admin, db)
    db.delete(horario)
    db.commit()


# --- Excepciones de agenda (vacaciones / feriados / horario especial) ---


@router.post(
    "/profesionales/{profesional_id}/excepciones", response_model=ExcepcionOut, status_code=201
)
def crear_excepcion(
    profesional_id: int,
    data: ExcepcionCreate,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ExcepcionAgenda:
    _profesional_autorizado(profesional_id, admin, db)
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
def eliminar_excepcion(
    excepcion_id: int,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    excepcion = db.get(ExcepcionAgenda, excepcion_id)
    if not excepcion:
        raise HTTPException(404, "Excepción no encontrada")
    _profesional_autorizado(excepcion.profesional_id, admin, db)
    db.delete(excepcion)
    db.commit()


@router.delete("/profesionales/{profesional_id}", status_code=204)
def eliminar_profesional(
    profesional_id: int,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    profesional = _profesional_autorizado(profesional_id, admin, db)

    # Desvincular servicios N:N
    profesional.servicios = []

    # Eliminar dependencias
    for h in profesional.horarios:
        db.delete(h)
    for e in profesional.excepciones:
        db.delete(e)

    from sqlalchemy.exc import IntegrityError
    try:
        db.delete(profesional)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            400,
            "No se puede eliminar el profesional porque tiene reservas asociadas. Habilita o deshabilita sus servicios en su lugar."
        )


# --- Premium: listado con datos financieros, credenciales y comisión ---


def _gate_premium_negocio(admin: Usuario, db: Session) -> Negocio:
    negocio = db.get(Negocio, admin.negocio_id)
    requiere_plan(negocio.plan if negocio else None, "premium", "Este módulo")
    return negocio


@router.get("/admin/profesionales", response_model=list[ProfesionalOut])
def listar_profesionales_admin(
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[ProfesionalOut]:
    """Listado para el panel admin: incluye comisión y acceso de cada profesional."""
    profesionales = db.scalars(
        select(Profesional).where(Profesional.negocio_id == admin.negocio_id)
    )
    return [_serializar(p, db, incluir_premium=True) for p in profesionales]


@router.post(
    "/profesionales/{profesional_id}/credenciales",
    response_model=CredencialesProfesionalOut,
)
def configurar_credenciales(
    profesional_id: int,
    data: CredencialesProfesionalIn,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> CredencialesProfesionalOut:
    """Crea (o actualiza) la cuenta de login individual del profesional."""
    profesional = _profesional_autorizado(profesional_id, admin, db)
    _gate_premium_negocio(admin, db)

    username = data.username.strip()
    ocupado = db.scalar(
        select(Usuario).where(Usuario.username == username, Usuario.id != (profesional.usuario_id or 0))
    )
    if ocupado:
        raise HTTPException(409, "Ese nombre de usuario ya está en uso")

    if profesional.usuario_id:
        usuario = db.get(Usuario, profesional.usuario_id)
    else:
        usuario = None

    if usuario is None:
        usuario = Usuario(
            negocio_id=profesional.negocio_id,
            email=data.email or f"{username}@profesional.local",
            nombre=profesional.nombre,
            rol=RolUsuario.profesional,
        )
        db.add(usuario)
        db.flush()
        profesional.usuario_id = usuario.id

    usuario.username = username
    usuario.dni = data.dni.strip()
    usuario.password_hash = hash_password(data.password.strip())
    usuario.rol = RolUsuario.profesional
    usuario.activo = True
    if data.email:
        usuario.email = data.email

    db.commit()
    return CredencialesProfesionalOut(
        profesional_id=profesional.id, usuario_id=usuario.id, username=username
    )


@router.delete("/profesionales/{profesional_id}/credenciales", status_code=204)
def revocar_credenciales(
    profesional_id: int,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    """Desactiva el acceso individual del profesional (no borra sus datos)."""
    profesional = _profesional_autorizado(profesional_id, admin, db)
    if profesional.usuario_id:
        usuario = db.get(Usuario, profesional.usuario_id)
        if usuario:
            usuario.activo = False
        db.commit()


@router.patch("/profesionales/{profesional_id}/comision", response_model=ProfesionalOut)
def configurar_comision(
    profesional_id: int,
    data: ComisionProfesionalIn,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ProfesionalOut:
    """Define la regla financiera del profesional: % por corte o fijo del local."""
    profesional = _profesional_autorizado(profesional_id, admin, db)
    _gate_premium_negocio(admin, db)
    profesional.tipo_comision = data.tipo_comision
    profesional.valor_comision = data.valor_comision
    db.commit()
    db.refresh(profesional)
    return _serializar(profesional, db, incluir_premium=True)
