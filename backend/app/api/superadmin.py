from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_super_admin
from app.api.deps import get_db
from app.core.security import hash_password
from app.models.catalogo import Categoria, Servicio
from app.models.cliente import Cliente
from app.models.enums import RolUsuario
from app.models.negocio import Negocio, RegistroAcceso, Usuario
from app.models.notificacion import NotificacionLog, RecordatorioProgramado
from app.models.portafolio import PortafolioImagen
from app.models.profesional import ExcepcionAgenda, HorarioRecurrente, Profesional
from app.models.reserva import Reserva, ReservaItem
from app.models.resena import Resena
from app.schemas.superadmin import (
    MetricasGlobales,
    NegocioActivar,
    NegocioConAdminCreate,
    NegocioEditar,
    NegocioResumen,
    ResetAdminPassword,
)

router = APIRouter(prefix="/super-admin", tags=["super-admin"])


def _resumen_negocio(negocio: Negocio, db: Session) -> NegocioResumen:
    admin = db.scalar(
        select(Usuario)
        .where(Usuario.negocio_id == negocio.id, Usuario.rol == RolUsuario.admin)
        .order_by(Usuario.id)
    )
    total_turnos = db.scalar(
        select(func.count(Reserva.id)).where(Reserva.negocio_id == negocio.id)
    )
    total_clientes = db.scalar(
        select(func.count(Cliente.id)).where(Cliente.negocio_id == negocio.id)
    )
    return NegocioResumen(
        id=negocio.id,
        nombre=negocio.nombre,
        slug=negocio.slug,
        activo=negocio.activo,
        creado_en=negocio.creado_en,
        admin_nombre=admin.nombre if admin else None,
        admin_username=admin.username if admin else None,
        admin_dni=admin.dni if admin else None,
        total_turnos=total_turnos or 0,
        total_clientes=total_clientes or 0,
    )


@router.get("/metricas", response_model=MetricasGlobales)
def metricas_globales(
    _: Usuario = Depends(get_current_super_admin), db: Session = Depends(get_db)
) -> MetricasGlobales:
    hace_30 = datetime.now(ZoneInfo("UTC")) - timedelta(days=30)
    return MetricasGlobales(
        total_negocios=db.scalar(select(func.count(Negocio.id))) or 0,
        negocios_activos=db.scalar(
            select(func.count(Negocio.id)).where(Negocio.activo)
        ) or 0,
        total_turnos=db.scalar(select(func.count(Reserva.id))) or 0,
        total_clientes=db.scalar(select(func.count(Cliente.id))) or 0,
        turnos_ultimos_30_dias=db.scalar(
            select(func.count(Reserva.id)).where(Reserva.creado_en >= hace_30)
        ) or 0,
    )


@router.get("/negocios", response_model=list[NegocioResumen])
def listar_negocios(
    _: Usuario = Depends(get_current_super_admin), db: Session = Depends(get_db)
) -> list[NegocioResumen]:
    negocios = db.scalars(select(Negocio).order_by(Negocio.creado_en.desc()))
    return [_resumen_negocio(n, db) for n in negocios]


@router.post("/negocios", response_model=NegocioResumen, status_code=201)
def crear_negocio_con_admin(
    data: NegocioConAdminCreate,
    _: Usuario = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> NegocioResumen:
    if db.scalar(select(Negocio).where(Negocio.slug == data.slug)):
        raise HTTPException(409, "El slug (URL) ya está en uso")
    if db.scalar(select(Usuario).where(Usuario.username == data.admin_username)):
        raise HTTPException(409, "El nombre de usuario del admin ya existe")

    negocio = Negocio(
        nombre=data.nombre,
        slug=data.slug,
        descripcion=data.descripcion,
        direccion=data.direccion,
        zona_horaria=data.zona_horaria,
        email_notificaciones=data.email_notificaciones,
    )
    db.add(negocio)
    db.flush()

    admin = Usuario(
        negocio_id=negocio.id,
        email=data.admin_email,
        nombre=data.admin_nombre,
        rol=RolUsuario.admin,
        username=data.admin_username,
        dni=data.admin_dni,
        password_hash=hash_password(data.admin_password),
    )
    db.add(admin)
    db.commit()
    db.refresh(negocio)
    return _resumen_negocio(negocio, db)


@router.post("/negocios/{negocio_id}/reset-password", response_model=NegocioResumen)
def reset_password_admin(
    negocio_id: int,
    data: ResetAdminPassword,
    _: Usuario = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> NegocioResumen:
    negocio = db.get(Negocio, negocio_id)
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")
    admin = db.scalar(
        select(Usuario)
        .where(Usuario.negocio_id == negocio_id, Usuario.rol == RolUsuario.admin)
        .order_by(Usuario.id)
    )
    if not admin:
        raise HTTPException(404, "Este negocio no tiene un admin")
    admin.password_hash = hash_password(data.password)
    db.commit()
    return _resumen_negocio(negocio, db)


@router.delete("/negocios/{negocio_id}", status_code=204)
def eliminar_negocio(
    negocio_id: int,
    _: Usuario = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> None:
    negocio = db.get(Negocio, negocio_id)
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")

    # Cascada manual en orden correcto (FK constraints)
    profesionales = list(db.scalars(select(Profesional).where(Profesional.negocio_id == negocio_id)))
    for p in profesionales:
        db.execute(select(HorarioRecurrente).where(HorarioRecurrente.profesional_id == p.id))
        for h in db.scalars(select(HorarioRecurrente).where(HorarioRecurrente.profesional_id == p.id)):
            db.delete(h)
        for e in db.scalars(select(ExcepcionAgenda).where(ExcepcionAgenda.profesional_id == p.id)):
            db.delete(e)

    reservas = list(db.scalars(select(Reserva).where(Reserva.negocio_id == negocio_id)))
    for r in reservas:
        for item in db.scalars(select(ReservaItem).where(ReservaItem.reserva_id == r.id)):
            db.delete(item)
        for rec in db.scalars(select(RecordatorioProgramado).where(RecordatorioProgramado.reserva_id == r.id)):
            db.delete(rec)
        for log in db.scalars(select(NotificacionLog).where(NotificacionLog.reserva_id == r.id)):
            db.delete(log)
        for res in db.scalars(select(Resena).where(Resena.reserva_id == r.id)):
            db.delete(res)
        db.delete(r)

    # Reseñas sin reserva (públicas)
    for res in db.scalars(select(Resena).where(Resena.negocio_id == negocio_id)):
        db.delete(res)

    for p in profesionales:
        p.servicios = []
        db.delete(p)

    for c in db.scalars(select(Cliente).where(Cliente.negocio_id == negocio_id)):
        db.delete(c)
    for s in db.scalars(select(Servicio).where(Servicio.negocio_id == negocio_id)):
        db.delete(s)
    for cat in db.scalars(select(Categoria).where(Categoria.negocio_id == negocio_id)):
        db.delete(cat)
    for img in db.scalars(select(PortafolioImagen).where(PortafolioImagen.negocio_id == negocio_id)):
        db.delete(img)
    for u in db.scalars(select(Usuario).where(Usuario.negocio_id == negocio_id)):
        for acc in db.scalars(select(RegistroAcceso).where(RegistroAcceso.usuario_id == u.id)):
            db.delete(acc)
        db.delete(u)

    db.delete(negocio)
    db.commit()


@router.patch("/negocios/{negocio_id}/editar", response_model=NegocioResumen)
def editar_negocio(
    negocio_id: int,
    data: NegocioEditar,
    _: Usuario = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> NegocioResumen:
    negocio = db.get(Negocio, negocio_id)
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")
    # Verificar que el nuevo slug no esté en uso por otro negocio
    slug_limpio = data.slug.strip().lower().replace(" ", "-")
    existente = db.scalar(select(Negocio).where(Negocio.slug == slug_limpio, Negocio.id != negocio_id))
    if existente:
        raise HTTPException(409, f"La URL '/{slug_limpio}' ya está en uso por otro negocio.")
    negocio.nombre = data.nombre.strip()
    negocio.slug = slug_limpio
    db.commit()
    db.refresh(negocio)
    return _resumen_negocio(negocio, db)


@router.patch("/negocios/{negocio_id}", response_model=NegocioResumen)
def activar_negocio(
    negocio_id: int,
    data: NegocioActivar,
    _: Usuario = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
) -> NegocioResumen:
    negocio = db.get(Negocio, negocio_id)
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")
    negocio.activo = data.activo
    db.commit()
    db.refresh(negocio)
    return _resumen_negocio(negocio, db)
