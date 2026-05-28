from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalogo import Servicio
from app.models.enums import EstadoReserva, TipoExcepcion
from app.models.profesional import (
    ExcepcionAgenda,
    HorarioRecurrente,
    Profesional,
)
from app.models.reserva import Reserva

# Granularidad de los horarios ofrecidos (minutos entre cada slot candidato).
SLOT_GRANULARIDAD_MIN = 15


def duracion_total_min(servicios: list[Servicio]) -> int:
    return sum(s.duracion_min + s.buffer_min for s in servicios)


def _ventanas_del_dia(
    profesional_id: int, fecha: date, db: Session
) -> list[tuple[time, time]]:
    """Devuelve las franjas horarias disponibles del profesional ese día,
    aplicando excepciones de agenda sobre el horario recurrente."""
    excepciones = list(
        db.scalars(
            select(ExcepcionAgenda).where(
                ExcepcionAgenda.profesional_id == profesional_id,
                ExcepcionAgenda.fecha == fecha,
            )
        )
    )

    # Día no disponible (vacaciones / feriado): sin ventanas.
    if any(e.tipo == TipoExcepcion.no_disponible for e in excepciones):
        return []

    especiales = [
        e for e in excepciones if e.tipo == TipoExcepcion.horario_especial
    ]
    if especiales:
        return [(e.hora_inicio, e.hora_fin) for e in especiales if e.hora_inicio and e.hora_fin]

    # Sin excepciones: horario recurrente del día de la semana (0 = lunes).
    horarios = db.scalars(
        select(HorarioRecurrente).where(
            HorarioRecurrente.profesional_id == profesional_id,
            HorarioRecurrente.dia_semana == fecha.weekday(),
        )
    )
    return [(h.hora_inicio, h.hora_fin) for h in horarios]


def _reservas_ocupadas(
    profesional_id: int, inicio_utc: datetime, fin_utc: datetime, db: Session
) -> list[tuple[datetime, datetime]]:
    reservas = db.scalars(
        select(Reserva).where(
            Reserva.profesional_id == profesional_id,
            Reserva.estado == EstadoReserva.confirmada,
            Reserva.inicio < fin_utc,
            Reserva.fin > inicio_utc,
        )
    )
    return [(r.inicio, r.fin) for r in reservas]


def slots_de_profesional(
    profesional: Profesional,
    fecha: date,
    duracion_min: int,
    tz: ZoneInfo,
    db: Session,
) -> list[datetime]:
    """Lista de instantes de inicio (UTC) disponibles para ese profesional ese día."""
    ventanas = _ventanas_del_dia(profesional.id, fecha, db)
    if not ventanas:
        return []

    # Rango del día completo en UTC, para traer las reservas que se solapan.
    dia_inicio_utc = datetime.combine(fecha, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))
    dia_fin_utc = datetime.combine(fecha + timedelta(days=1), time.min, tzinfo=tz).astimezone(
        ZoneInfo("UTC")
    )
    ocupadas = _reservas_ocupadas(profesional.id, dia_inicio_utc, dia_fin_utc, db)

    ahora_utc = datetime.now(ZoneInfo("UTC"))
    paso = timedelta(minutes=SLOT_GRANULARIDAD_MIN)
    bloque = timedelta(minutes=duracion_min)

    slots: list[datetime] = []
    for hora_ini, hora_fin in ventanas:
        cursor_local = datetime.combine(fecha, hora_ini, tzinfo=tz)
        limite_local = datetime.combine(fecha, hora_fin, tzinfo=tz)
        while cursor_local + bloque <= limite_local:
            inicio_utc = cursor_local.astimezone(ZoneInfo("UTC"))
            fin_utc = inicio_utc + bloque
            # No ofrecer slots en el pasado.
            if inicio_utc <= ahora_utc:
                cursor_local += paso
                continue
            solapa = any(o_ini < fin_utc and o_fin > inicio_utc for o_ini, o_fin in ocupadas)
            if not solapa:
                slots.append(inicio_utc)
            cursor_local += paso
    return slots


def _profesionales_candidatos(
    negocio_id: int,
    servicio_ids: list[int],
    profesional_id: int | None,
    db: Session,
) -> list[Profesional]:
    profesionales = list(
        db.scalars(select(Profesional).where(Profesional.negocio_id == negocio_id))
    )
    if profesional_id is not None:
        profesionales = [p for p in profesionales if p.id == profesional_id]

    # Solo profesionales que ofrecen TODOS los servicios pedidos.
    requeridos = set(servicio_ids)
    return [
        p
        for p in profesionales
        if requeridos.issubset({s.id for s in p.servicios})
    ]


def calcular_disponibilidad(
    negocio_id: int,
    servicio_ids: list[int],
    fecha: date,
    profesional_id: int | None,
    tz: ZoneInfo,
    db: Session,
) -> dict[str, list[dict]]:
    """Devuelve slots agrupados en mañana / tarde / noche (hora local)."""
    servicios = list(
        db.scalars(
            select(Servicio).where(
                Servicio.id.in_(servicio_ids), Servicio.negocio_id == negocio_id
            )
        )
    )
    if len(servicios) != len(set(servicio_ids)):
        return {"manana": [], "tarde": [], "noche": []}

    duracion = duracion_total_min(servicios)
    candidatos = _profesionales_candidatos(negocio_id, servicio_ids, profesional_id, db)

    # Para cada instante, conservamos un único profesional disponible (el primero).
    por_inicio: dict[datetime, int] = {}
    for prof in candidatos:
        for inicio_utc in slots_de_profesional(prof, fecha, duracion, tz, db):
            por_inicio.setdefault(inicio_utc, prof.id)

    franjas: dict[str, list[dict]] = {"manana": [], "tarde": [], "noche": []}
    for inicio_utc in sorted(por_inicio):
        hora_local = inicio_utc.astimezone(tz).hour
        slot = {"inicio": inicio_utc, "profesional_id": por_inicio[inicio_utc]}
        if hora_local < 12:
            franjas["manana"].append(slot)
        elif hora_local < 18:
            franjas["tarde"].append(slot)
        else:
            franjas["noche"].append(slot)
    return franjas
