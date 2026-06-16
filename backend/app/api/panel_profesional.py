"""Panel individual del profesional (plan Premium).

El profesional se loguea con su propia cuenta y solo puede consultar SUS
turnos y comisiones: la restricción se aplica por JWT (rol `profesional`)
y por RLS a nivel de base de datos. No ve las ganancias del local ni las
agendas de sus compañeros.
"""
from datetime import date as date_type
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.planes import requiere_plan
from app.core.security import decodificar_token
from app.models.catalogo import Servicio
from app.models.cliente import Cliente
from app.models.enums import EstadoReserva, RolUsuario
from app.models.negocio import Negocio, Usuario
from app.models.premium import ClienteHistorial
from app.models.profesional import Profesional
from app.models.reserva import Reserva, ReservaItem
from app.schemas.premium import (
    ComisionesOut,
    HistorialConAutorOut,
    HistorialIn,
    PerfilProfesionalOut,
    TurnoProfesionalOut,
)

router = APIRouter(prefix="/profesional", tags=["panel-profesional"])
_bearer = HTTPBearer(auto_error=True)


def get_current_profesional(
    cred: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Profesional:
    try:
        payload = decodificar_token(cred.credentials)
        usuario_id = int(payload["sub"])
        negocio_id = payload.get("negocio_id")
    except Exception:
        raise HTTPException(401, "Token inválido o expirado")

    db.info["current_user_id"] = usuario_id
    db.info["current_negocio_id"] = negocio_id
    db.info["bypass_rls"] = False

    usuario = db.get(Usuario, usuario_id)
    if not usuario or not usuario.activo:
        raise HTTPException(401, "Usuario no válido")
    if usuario.rol != RolUsuario.profesional:
        raise HTTPException(403, "Se requiere una cuenta de profesional")

    db.info["current_user_rol"] = usuario.rol.value

    profesional = db.scalar(
        select(Profesional).where(Profesional.usuario_id == usuario.id)
    )
    if not profesional:
        raise HTTPException(403, "La cuenta no está vinculada a un profesional")

    db.info["current_profesional_id"] = profesional.id

    negocio = db.get(Negocio, profesional.negocio_id)
    requiere_plan(negocio.plan if negocio else None, "premium", "El panel del profesional")
    return profesional


def _rango_utc(desde: date_type, hasta: date_type, tz: ZoneInfo) -> tuple[datetime, datetime]:
    desde_utc = datetime.combine(desde, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))
    hasta_utc = datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=tz).astimezone(
        ZoneInfo("UTC")
    )
    return desde_utc, hasta_utc


def _mis_reservas(
    profesional: Profesional, desde: date_type, hasta: date_type, db: Session
) -> list[Reserva]:
    negocio = db.get(Negocio, profesional.negocio_id)
    tz = ZoneInfo(negocio.zona_horaria)
    desde_utc, hasta_utc = _rango_utc(desde, hasta, tz)
    # El SELECT queda restringido al propio barbero_id (además del RLS).
    return list(
        db.scalars(
            select(Reserva)
            .where(
                Reserva.profesional_id == profesional.id,
                Reserva.inicio >= desde_utc,
                Reserva.inicio < hasta_utc,
            )
            .order_by(Reserva.inicio)
        )
    )


@router.get("/perfil", response_model=PerfilProfesionalOut)
def perfil(
    profesional: Profesional = Depends(get_current_profesional),
    db: Session = Depends(get_db),
) -> PerfilProfesionalOut:
    negocio = db.get(Negocio, profesional.negocio_id)
    return PerfilProfesionalOut(
        profesional_id=profesional.id,
        nombre=profesional.nombre,
        foto=profesional.foto,
        negocio_id=profesional.negocio_id,
        negocio_nombre=negocio.nombre if negocio else "",
        tipo_comision=profesional.tipo_comision,
        valor_comision=float(profesional.valor_comision or 0),
    )


@router.get("/turnos", response_model=list[TurnoProfesionalOut])
def mis_turnos(
    desde: date_type,
    hasta: date_type,
    profesional: Profesional = Depends(get_current_profesional),
    db: Session = Depends(get_db),
) -> list[TurnoProfesionalOut]:
    reservas = _mis_reservas(profesional, desde, hasta, db)
    if not reservas:
        return []

    cliente_ids = {r.cliente_id for r in reservas}
    clientes = {
        c.id: c
        for c in db.scalars(select(Cliente).where(Cliente.id.in_(cliente_ids)))
    }
    reserva_ids = [r.id for r in reservas]
    servicios_por_reserva: dict[int, list[str]] = {}
    filas = db.execute(
        select(ReservaItem.reserva_id, Servicio.nombre)
        .join(Servicio, Servicio.id == ReservaItem.servicio_id)
        .where(ReservaItem.reserva_id.in_(reserva_ids))
        .order_by(ReservaItem.reserva_id, ReservaItem.orden)
    ).all()
    for rid, nombre in filas:
        servicios_por_reserva.setdefault(rid, []).append(nombre)

    # Última nota del historial por cliente (lo que se le hizo la última vez).
    from app.models.premium import ClienteHistorial

    ultima_nota: dict[int, ClienteHistorial] = {}
    notas = db.scalars(
        select(ClienteHistorial)
        .where(
            ClienteHistorial.negocio_id == profesional.negocio_id,
            ClienteHistorial.cliente_id.in_(cliente_ids),
        )
        .order_by(ClienteHistorial.fecha_actualizacion.desc())
    )
    for n in notas:
        ultima_nota.setdefault(n.cliente_id, n)  # la primera = la más reciente

    salida = []
    for r in reservas:
        cliente = clientes.get(r.cliente_id)
        nota = ultima_nota.get(r.cliente_id)
        salida.append(
            TurnoProfesionalOut(
                id=r.id,
                inicio=r.inicio,
                fin=r.fin,
                estado=r.estado,
                total_precio=r.total_precio,
                pago_profesional=r.pago_profesional,
                metodo_pago=r.metodo_pago,
                cliente_id=r.cliente_id,
                cliente_nombre=cliente.nombre if cliente else "—",
                cliente_telefono=cliente.telefono if cliente else None,
                servicios=servicios_por_reserva.get(r.id, []),
                ultima_nota=nota.notas_estilo if nota else None,
                ultima_nota_fecha=nota.fecha_actualizacion if nota else None,
            )
        )
    return salida


@router.get("/comisiones", response_model=ComisionesOut)
def mis_comisiones(
    desde: date_type,
    hasta: date_type,
    profesional: Profesional = Depends(get_current_profesional),
    db: Session = Depends(get_db),
) -> ComisionesOut:
    reservas = _mis_reservas(profesional, desde, hasta, db)
    completadas = [r for r in reservas if r.estado == EstadoReserva.completada]

    total_generado = sum((Decimal(str(r.total_precio)) for r in completadas), Decimal("0"))
    total_comision = sum(
        (Decimal(str(r.pago_profesional or 0)) for r in completadas), Decimal("0")
    )
    return ComisionesOut(
        desde=desde,
        hasta=hasta,
        tipo_comision=profesional.tipo_comision,
        valor_comision=float(profesional.valor_comision or 0),
        turnos_completados=len(completadas),
        total_generado=total_generado.quantize(Decimal("0.01")),
        total_comision=total_comision.quantize(Decimal("0.01")),
        total_local=(total_generado - total_comision).quantize(Decimal("0.01")),
    )


# ── Ficha técnica del cliente ────────────────────────────────────────────


def _validar_cliente(cliente_id: int, negocio_id: int, db: Session) -> Cliente:
    cliente = db.get(Cliente, cliente_id)
    if not cliente or cliente.negocio_id != negocio_id:
        raise HTTPException(404, "Cliente no encontrado")
    return cliente


@router.get("/clientes/{cliente_id}/historial", response_model=list[HistorialConAutorOut])
def historial_cliente(
    cliente_id: int,
    profesional: Profesional = Depends(get_current_profesional),
    db: Session = Depends(get_db),
) -> list[HistorialConAutorOut]:
    _validar_cliente(cliente_id, profesional.negocio_id, db)
    registros = list(
        db.scalars(
            select(ClienteHistorial)
            .where(
                ClienteHistorial.negocio_id == profesional.negocio_id,
                ClienteHistorial.cliente_id == cliente_id,
            )
            .order_by(ClienteHistorial.fecha_actualizacion.desc())
        )
    )
    prof_ids = {r.profesional_id for r in registros if r.profesional_id}
    nombres = {
        p.id: p.nombre
        for p in db.scalars(select(Profesional).where(Profesional.id.in_(prof_ids)))
    } if prof_ids else {}
    return [
        HistorialConAutorOut(
            id=r.id,
            cliente_id=r.cliente_id,
            profesional_id=r.profesional_id,
            notas_estilo=r.notas_estilo,
            fecha_actualizacion=r.fecha_actualizacion,
            profesional_nombre=nombres.get(r.profesional_id),
        )
        for r in registros
    ]


@router.post(
    "/clientes/{cliente_id}/historial",
    response_model=HistorialConAutorOut,
    status_code=201,
)
def agregar_nota_historial(
    cliente_id: int,
    data: HistorialIn,
    profesional: Profesional = Depends(get_current_profesional),
    db: Session = Depends(get_db),
) -> HistorialConAutorOut:
    _validar_cliente(cliente_id, profesional.negocio_id, db)
    registro = ClienteHistorial(
        negocio_id=profesional.negocio_id,
        cliente_id=cliente_id,
        profesional_id=profesional.id,
        notas_estilo=data.notas_estilo.strip(),
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return HistorialConAutorOut(
        id=registro.id,
        cliente_id=registro.cliente_id,
        profesional_id=registro.profesional_id,
        notas_estilo=registro.notas_estilo,
        fecha_actualizacion=registro.fecha_actualizacion,
        profesional_nombre=profesional.nombre,
    )


# ── IA para el historial (versión del profesional) ───────────────────────────


@router.post("/ia/nota-historial")
def prof_ia_mejorar_nota(
    data: dict,
    profesional: Profesional = Depends(get_current_profesional),
):
    """Reescribe una nota de seguimiento de forma clara y profesional."""
    from app.api.admin import _ia_texto

    texto = (data.get("texto") or "").strip()
    if not texto:
        return {"texto": ""}
    prompt = (
        "Reescribí esta nota de seguimiento de un cliente de un negocio de servicios "
        "de forma clara, profesional y concisa (español rioplatense, máximo 40 palabras, "
        "sin inventar datos que no estén en la nota). "
        f"Nota original: \"{texto}\". Respondé SOLO con la nota mejorada, sin comillas."
    )
    out = _ia_texto(prompt, max_tokens=120)
    return {"texto": (out or texto).strip().strip('"').strip()}


@router.post("/clientes/{cliente_id}/historial/resumen")
def prof_ia_resumen_historial(
    cliente_id: int,
    profesional: Profesional = Depends(get_current_profesional),
    db: Session = Depends(get_db),
):
    """Resumen del historial del cliente para leer antes de atenderlo."""
    from app.api.admin import _ia_texto

    _validar_cliente(cliente_id, profesional.negocio_id, db)
    notas = list(
        db.scalars(
            select(ClienteHistorial)
            .where(
                ClienteHistorial.negocio_id == profesional.negocio_id,
                ClienteHistorial.cliente_id == cliente_id,
            )
            .order_by(ClienteHistorial.fecha_actualizacion.desc())
            .limit(20)
        )
    )
    if not notas:
        return {"texto": "Este cliente todavía no tiene notas en su historial."}
    detalle = "\n".join(
        f"- {n.fecha_actualizacion:%d/%m/%Y}: {n.notas_estilo}" for n in notas
    )
    prompt = (
        "Resumí el historial de un cliente para que el profesional lo lea en segundos "
        "antes de atenderlo. Destacá lo más reciente y lo importante (preferencias, "
        "tratamientos, observaciones, qué se hizo la última vez). Máximo 4 oraciones, "
        f"español rioplatense, sin inventar. Historial:\n{detalle}\n\nRespondé SOLO con el resumen."
    )
    out = _ia_texto(prompt, max_tokens=220)
    if not out:
        out = f"Última nota ({notas[0].fecha_actualizacion:%d/%m/%Y}): {notas[0].notas_estilo}"
    return {"texto": out.strip().strip('"').strip()}
