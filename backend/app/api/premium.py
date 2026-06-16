"""Módulos Premium del panel admin: reporte de caja diaria, inteligencia de
horas muertas, lista de espera y ficha técnica de clientes. Incluye también
el endpoint público para anotarse en la lista de espera."""
from datetime import date as date_type
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_admin
from app.api.deps import get_db
from app.core.planes import requiere_plan
from app.models.cliente import Cliente
from app.models.enums import BloqueHorario, EstadoListaEspera, EstadoReserva
from app.models.negocio import Negocio, Usuario
from app.models.premium import ClienteHistorial, ListaEspera
from app.models.profesional import HorarioRecurrente, Profesional
from app.models.reserva import Reserva
from app.schemas.premium import (
    CajaDiariaOut,
    CajaMetodoOut,
    FranjaOcupacionOut,
    HistorialConAutorOut,
    HistorialIn,
    HorasMuertasOut,
    ListaEsperaCreate,
    ListaEsperaOut,
    RendimientoOut,
    RendimientoProfesionalOut,
)

router = APIRouter(tags=["premium"])

_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def _gate_premium(
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> Usuario:
    negocio = db.get(Negocio, admin.negocio_id)
    requiere_plan(negocio.plan if negocio else None, "premium", "Este módulo")
    return admin


# ── Reporte de caja diaria ───────────────────────────────────────────────


@router.get("/admin/reportes/caja", response_model=CajaDiariaOut)
def caja_diaria(
    fecha: date_type,
    admin: Usuario = Depends(_gate_premium),
    db: Session = Depends(get_db),
) -> CajaDiariaOut:
    """Arqueo de caja: suma de turnos completados agrupados por método de pago."""
    negocio = db.get(Negocio, admin.negocio_id)
    tz = ZoneInfo(negocio.zona_horaria)
    desde_utc = datetime.combine(fecha, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))
    hasta_utc = datetime.combine(fecha + timedelta(days=1), time.min, tzinfo=tz).astimezone(
        ZoneInfo("UTC")
    )

    filas = db.execute(
        select(
            Reserva.metodo_pago,
            func.count(Reserva.id),
            func.coalesce(func.sum(Reserva.total_precio), 0),
            func.coalesce(func.sum(Reserva.pago_profesional), 0),
            func.coalesce(func.sum(Reserva.pago_local), 0),
        )
        .where(
            Reserva.negocio_id == negocio.id,
            Reserva.estado == EstadoReserva.completada,
            Reserva.inicio >= desde_utc,
            Reserva.inicio < hasta_utc,
        )
        .group_by(Reserva.metodo_pago)
    ).all()

    por_metodo = []
    total = comisiones = local = Decimal("0")
    turnos = 0
    for metodo, cantidad, suma, suma_prof, suma_local in filas:
        por_metodo.append(
            CajaMetodoOut(
                metodo_pago=metodo.value if metodo else "sin_registrar",
                cantidad=cantidad,
                total=Decimal(str(suma)),
            )
        )
        total += Decimal(str(suma))
        comisiones += Decimal(str(suma_prof))
        local += Decimal(str(suma_local))
        turnos += cantidad

    return CajaDiariaOut(
        fecha=fecha,
        total=total.quantize(Decimal("0.01")),
        total_comisiones=comisiones.quantize(Decimal("0.01")),
        total_local=local.quantize(Decimal("0.01")),
        turnos_completados=turnos,
        por_metodo=sorted(por_metodo, key=lambda m: m.total, reverse=True),
    )


# ── Inteligencia de horas muertas ────────────────────────────────────────


@router.get("/admin/reportes/horas-muertas", response_model=HorasMuertasOut)
def horas_muertas(
    semanas: int = 4,
    admin: Usuario = Depends(_gate_premium),
    db: Session = Depends(get_db),
) -> HorasMuertasOut:
    """Ocupación promedio por día de la semana y bloque (mañana / tarde).

    La capacidad se estima con los horarios recurrentes de los profesionales
    (slots de 30 min). Si una franja cae por debajo del 20 %, se sugiere
    activar una promoción para incentivar reservas.
    """
    semanas = max(1, min(semanas, 12))
    negocio = db.get(Negocio, admin.negocio_id)
    tz = ZoneInfo(negocio.zona_horaria)
    hoy = datetime.now(tz).date()
    desde = hoy - timedelta(weeks=semanas)
    desde_utc = datetime.combine(desde, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))
    hasta_utc = datetime.combine(hoy, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))

    # Capacidad semanal: minutos de atención por (día, bloque) según horarios.
    horarios = db.execute(
        select(
            HorarioRecurrente.dia_semana,
            HorarioRecurrente.hora_inicio,
            HorarioRecurrente.hora_fin,
        )
        .join(Profesional, Profesional.id == HorarioRecurrente.profesional_id)
        .where(Profesional.negocio_id == negocio.id)
    ).all()

    capacidad: dict[tuple[int, BloqueHorario], int] = {}
    for dia, h_ini, h_fin in horarios:
        minutos_manana = max(
            0,
            min(h_fin.hour * 60 + h_fin.minute, 13 * 60)
            - max(h_ini.hour * 60 + h_ini.minute, 0),
        )
        minutos_tarde = max(
            0,
            (h_fin.hour * 60 + h_fin.minute)
            - max(h_ini.hour * 60 + h_ini.minute, 13 * 60),
        )
        if minutos_manana:
            clave = (dia, BloqueHorario.manana)
            capacidad[clave] = capacidad.get(clave, 0) + (minutos_manana // 30) * semanas
        if minutos_tarde:
            clave = (dia, BloqueHorario.tarde)
            capacidad[clave] = capacidad.get(clave, 0) + (minutos_tarde // 30) * semanas

    # Turnos reales del período agrupados por (día, bloque).
    reservas = db.scalars(
        select(Reserva).where(
            Reserva.negocio_id == negocio.id,
            Reserva.estado.in_([EstadoReserva.confirmada, EstadoReserva.completada]),
            Reserva.inicio >= desde_utc,
            Reserva.inicio < hasta_utc,
        )
    )
    ocupados: dict[tuple[int, BloqueHorario], int] = {}
    for r in reservas:
        local = r.inicio.astimezone(tz)
        bloque = BloqueHorario.manana if local.hour < 13 else BloqueHorario.tarde
        clave = (local.weekday(), bloque)
        ocupados[clave] = ocupados.get(clave, 0) + 1

    franjas: list[FranjaOcupacionOut] = []
    sugerencias: list[str] = []
    for (dia, bloque), cap in sorted(capacidad.items()):
        turnos = ocupados.get((dia, bloque), 0)
        pct = round(turnos / cap * 100, 1) if cap else 0.0
        alerta = pct < 20.0
        bloque_label = "Mañana" if bloque == BloqueHorario.manana else "Tarde"
        franjas.append(
            FranjaOcupacionOut(
                dia_semana=dia,
                dia_nombre=_DIAS[dia],
                bloque=bloque_label,
                ocupacion_pct=pct,
                turnos=turnos,
                capacidad=cap,
                alerta=alerta,
            )
        )
        if alerta:
            sugerencias.append(
                f"Detectamos que los {_DIAS[dia].lower()} a la "
                f"{'mañana' if bloque == BloqueHorario.manana else 'tarde'} tu "
                f"ocupación es baja ({pct}%). ¿Querés activar un descuento del "
                f"20% para incentivar reservas en esa franja?"
            )

    return HorasMuertasOut(desde=desde, hasta=hoy, franjas=franjas, sugerencias=sugerencias)


# ── Rendimiento por profesional ──────────────────────────────────────────


@router.get("/admin/reportes/profesionales", response_model=RendimientoOut)
def rendimiento_profesionales(
    desde: date_type,
    hasta: date_type,
    admin: Usuario = Depends(_gate_premium),
    db: Session = Depends(get_db),
) -> RendimientoOut:
    """Desglose de turnos, facturación y comisiones por profesional en el período."""
    negocio = db.get(Negocio, admin.negocio_id)
    tz = ZoneInfo(negocio.zona_horaria)
    desde_utc = datetime.combine(desde, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))
    hasta_utc = datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=tz).astimezone(
        ZoneInfo("UTC")
    )

    filas = db.execute(
        select(
            Reserva.profesional_id,
            Profesional.nombre,
            func.count(Reserva.id),
            func.coalesce(func.sum(Reserva.total_precio), 0),
            func.coalesce(func.sum(Reserva.pago_profesional), 0),
            func.coalesce(func.sum(Reserva.pago_local), 0),
        )
        .join(Profesional, Profesional.id == Reserva.profesional_id)
        .where(
            Reserva.negocio_id == negocio.id,
            Reserva.estado == EstadoReserva.completada,
            Reserva.inicio >= desde_utc,
            Reserva.inicio < hasta_utc,
        )
        .group_by(Reserva.profesional_id, Profesional.nombre)
        .order_by(func.coalesce(func.sum(Reserva.total_precio), 0).desc())
    ).all()

    profesionales = []
    total_ing = total_com = total_loc = Decimal("0")
    for prof_id, nombre, turnos, ingresos, comision, para_local in filas:
        ingresos = Decimal(str(ingresos))
        comision = Decimal(str(comision))
        para_local = Decimal(str(para_local))
        profesionales.append(
            RendimientoProfesionalOut(
                profesional_id=prof_id,
                nombre=nombre,
                turnos_completados=turnos,
                ingresos_generados=ingresos.quantize(Decimal("0.01")),
                comision=comision.quantize(Decimal("0.01")),
                para_local=para_local.quantize(Decimal("0.01")),
            )
        )
        total_ing += ingresos
        total_com += comision
        total_loc += para_local

    return RendimientoOut(
        desde=desde,
        hasta=hasta,
        profesionales=profesionales,
        total_ingresos=total_ing.quantize(Decimal("0.01")),
        total_comisiones=total_com.quantize(Decimal("0.01")),
        total_local=total_loc.quantize(Decimal("0.01")),
    )


# ── Lista de espera ──────────────────────────────────────────────────────


@router.post(
    "/negocios/{slug}/lista-espera", response_model=ListaEsperaOut, status_code=201
)
def anotarse_lista_espera(
    slug: str,
    data: ListaEsperaCreate,
    db: Session = Depends(get_db),
) -> ListaEspera:
    """Endpoint público: el cliente se anota cuando el día está completo."""
    db.info["bypass_rls"] = True
    negocio = db.scalar(select(Negocio).where(Negocio.slug == slug, Negocio.activo))
    if not negocio:
        raise HTTPException(404, "Negocio no encontrado")
    requiere_plan(negocio.plan, "premium", "La lista de espera")

    if data.fecha < datetime.now(ZoneInfo(negocio.zona_horaria)).date():
        raise HTTPException(400, "La fecha ya pasó")

    # Evitamos anotar dos veces el mismo teléfono para el mismo día y bloque.
    existente = db.scalar(
        select(ListaEspera).where(
            ListaEspera.negocio_id == negocio.id,
            ListaEspera.telefono == data.telefono,
            ListaEspera.fecha == data.fecha,
            ListaEspera.bloque == data.bloque,
            ListaEspera.estado.in_(
                [EstadoListaEspera.pendiente, EstadoListaEspera.notificado]
            ),
        )
    )
    if existente:
        raise HTTPException(409, "Ya estás anotado en la lista de espera para ese día")

    registro = ListaEspera(
        negocio_id=negocio.id,
        nombre=data.nombre.strip(),
        telefono=data.telefono.strip(),
        fecha=data.fecha,
        bloque=data.bloque,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return registro


@router.get("/admin/lista-espera", response_model=list[ListaEsperaOut])
def listar_lista_espera(
    desde: date_type | None = None,
    admin: Usuario = Depends(_gate_premium),
    db: Session = Depends(get_db),
) -> list[ListaEspera]:
    consulta = select(ListaEspera).where(ListaEspera.negocio_id == admin.negocio_id)
    if desde:
        consulta = consulta.where(ListaEspera.fecha >= desde)
    return list(db.scalars(consulta.order_by(ListaEspera.fecha, ListaEspera.creado_en)))


@router.delete("/admin/lista-espera/{registro_id}", status_code=204)
def eliminar_de_lista_espera(
    registro_id: int,
    admin: Usuario = Depends(_gate_premium),
    db: Session = Depends(get_db),
) -> None:
    registro = db.get(ListaEspera, registro_id)
    if not registro or registro.negocio_id != admin.negocio_id:
        raise HTTPException(404, "Registro no encontrado")
    registro.estado = EstadoListaEspera.cancelado
    db.commit()


# ── Historial del cliente (vista del admin, disponible en todos los planes) ──


@router.get(
    "/admin/clientes/{cliente_id}/historial", response_model=list[HistorialConAutorOut]
)
def historial_cliente_admin(
    cliente_id: int,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[HistorialConAutorOut]:
    cliente = db.get(Cliente, cliente_id)
    if not cliente or cliente.negocio_id != admin.negocio_id:
        raise HTTPException(404, "Cliente no encontrado")
    registros = list(
        db.scalars(
            select(ClienteHistorial)
            .where(
                ClienteHistorial.negocio_id == admin.negocio_id,
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
    "/admin/clientes/{cliente_id}/historial",
    response_model=HistorialConAutorOut,
    status_code=201,
)
def agregar_historial_admin(
    cliente_id: int,
    data: HistorialIn,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> HistorialConAutorOut:
    cliente = db.get(Cliente, cliente_id)
    if not cliente or cliente.negocio_id != admin.negocio_id:
        raise HTTPException(404, "Cliente no encontrado")
    registro = ClienteHistorial(
        negocio_id=admin.negocio_id,
        cliente_id=cliente_id,
        profesional_id=None,
        notas_estilo=data.notas_estilo.strip(),
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return HistorialConAutorOut(
        id=registro.id,
        cliente_id=registro.cliente_id,
        profesional_id=None,
        notas_estilo=registro.notas_estilo,
        fecha_actualizacion=registro.fecha_actualizacion,
        profesional_nombre=None,
    )


@router.delete("/admin/clientes/{cliente_id}/historial/{nota_id}", status_code=204)
def eliminar_historial_admin(
    cliente_id: int,
    nota_id: int,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    nota = db.get(ClienteHistorial, nota_id)
    if not nota or nota.negocio_id != admin.negocio_id or nota.cliente_id != cliente_id:
        raise HTTPException(404, "Nota no encontrada")
    db.delete(nota)
    db.commit()
