"""Agendamiento de turnos por WhatsApp: máquina de estados conversacional.

El cliente reserva sin salir del chat: elige servicio → día → horario → confirma.
El estado de la conversación se guarda en `conversaciones_bot` para retomarla
mensaje a mensaje.
"""
import json
import re
import unicodedata
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalogo import Servicio
from app.models.negocio import Negocio
from app.models.premium import ConversacionBot
from app.services.disponibilidad import calcular_disponibilidad

# Minutos de inactividad tras los cuales la conversación se reinicia.
_EXPIRA_MIN = 20
# Máximo de horarios a mostrar por día (para no mandar un mensaje gigante).
_MAX_SLOTS = 10

_RE_RESERVAR = re.compile(
    r"\b(reservar|reserva|reservo|turno|agendar|agenda|sacar\s+(un\s+)?turno|quiero\s+un\s+turno)\b"
)


def _norm(texto: str) -> str:
    texto = unicodedata.normalize("NFD", texto or "")
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return texto.lower().strip()


def _link(negocio: Negocio) -> str:
    from app.core.config import settings

    return f"{settings.frontend_url.rstrip('/')}/{negocio.slug}"


# ── Acceso a la conversación ─────────────────────────────────────────────


def _get_conv(negocio: Negocio, telefono: str, db: Session) -> ConversacionBot | None:
    return db.scalar(
        select(ConversacionBot).where(
            ConversacionBot.negocio_id == negocio.id,
            ConversacionBot.telefono == telefono,
        )
    )


def _set_conv(conv: ConversacionBot, estado: str, datos: dict, db: Session) -> None:
    conv.estado = estado
    conv.datos = json.dumps(datos, ensure_ascii=False)
    db.commit()


def _crear_conv(negocio: Negocio, telefono: str, db: Session) -> ConversacionBot:
    conv = ConversacionBot(
        negocio_id=negocio.id, telefono=telefono, estado="servicio", datos="{}"
    )
    db.add(conv)
    db.commit()
    return conv


def _borrar_conv(conv: ConversacionBot, db: Session) -> None:
    db.delete(conv)
    db.commit()


def _expirada(conv: ConversacionBot) -> bool:
    if not conv.actualizado_en:
        return False
    return datetime.now(ZoneInfo("UTC")) - conv.actualizado_en > timedelta(minutes=_EXPIRA_MIN)


# ── Helpers de parseo ────────────────────────────────────────────────────


def _servicios_activos(negocio: Negocio, db: Session) -> list[Servicio]:
    return list(
        db.scalars(
            select(Servicio)
            .where(Servicio.negocio_id == negocio.id, Servicio.activo)
            .order_by(Servicio.nombre)
        )
    )


def _parse_numero(texto: str) -> int | None:
    m = re.search(r"\d+", texto)
    return int(m.group()) if m else None


_DIAS_SEMANA = {
    "lunes": 0, "martes": 1, "miercoles": 2, "jueves": 3,
    "viernes": 4, "sabado": 5, "domingo": 6,
}


def _parse_dia(texto: str, hoy: date) -> date | None:
    t = _norm(texto)
    if "hoy" in t:
        return hoy
    if "pasado" in t:
        return hoy + timedelta(days=2)
    if "manana" in t:
        return hoy + timedelta(days=1)
    # Día de la semana (próxima ocurrencia)
    for nombre, idx in _DIAS_SEMANA.items():
        if nombre in t:
            delta = (idx - hoy.weekday()) % 7
            return hoy + timedelta(days=delta or 7)
    # Fecha dd/mm o dd-mm o dd.mm
    m = re.search(r"(\d{1,2})[/\-.](\d{1,2})", t)
    if m:
        d, mes = int(m.group(1)), int(m.group(2))
        try:
            anio = hoy.year if mes >= hoy.month else hoy.year + 1
            return date(anio, mes, d)
        except ValueError:
            return None
    # Solo el número del día (este mes o el próximo)
    m = re.fullmatch(r"\s*(\d{1,2})\s*", t)
    if m:
        d = int(m.group(1))
        try:
            cand = hoy.replace(day=d)
            return cand if cand >= hoy else (cand.replace(month=hoy.month % 12 + 1))
        except ValueError:
            return None
    return None


# ── Pasos de la conversación ─────────────────────────────────────────────


def _iniciar(negocio: Negocio, telefono: str, db: Session) -> str:
    servicios = _servicios_activos(negocio, db)
    if not servicios:
        return f"Por ahora reservá desde acá 👇\n{_link(negocio)}"
    conv = _get_conv(negocio, telefono, db) or _crear_conv(negocio, telefono, db)
    _set_conv(conv, "servicio", {}, db)
    lineas = [
        f"{i + 1}. {s.nombre} — ${s.precio:,.0f} ({s.duracion_min} min)".replace(",", ".")
        for i, s in enumerate(servicios[:12])
    ]
    return (
        "¡Dale! 🙌 ¿Qué servicio querés reservar?\n\n"
        + "\n".join(lineas)
        + "\n\nRespondé con el *número*. (Escribí *cancelar* para salir.)"
    )


def _profesionales_de_servicio(negocio, servicio_id, db):
    from app.models.profesional import Profesional

    profs = db.scalars(select(Profesional).where(Profesional.negocio_id == negocio.id))
    return [p for p in profs if any(s.id == servicio_id for s in p.servicios)]


def _pregunta_dia() -> str:
    return "¿Para qué día? Escribí *hoy*, *mañana* o una fecha (ej: *18/06*)."


def _paso_servicio(negocio, conv, datos, texto, db) -> str:
    servicios = _servicios_activos(negocio, db)
    elegido = None
    num = _parse_numero(texto)
    if num and 1 <= num <= len(servicios):
        elegido = servicios[num - 1]
    else:
        t = _norm(texto)
        for s in servicios:
            if _norm(s.nombre) in t or t in _norm(s.nombre):
                elegido = s
                break
    if not elegido:
        return "No entendí 🤔. Respondé con el *número* del servicio de la lista."

    datos = {"servicio_id": elegido.id, "servicio_nombre": elegido.nombre}
    profs = _profesionales_de_servicio(negocio, elegido.id, db)
    if not profs:
        _borrar_conv(conv, db)
        return f"Ese servicio no tiene profesional asignado todavía. Reservá acá 👇\n{_link(negocio)}"
    if len(profs) == 1:
        datos["profesional_id"] = profs[0].id
        datos["profesional_nombre"] = profs[0].nombre
        _set_conv(conv, "dia", datos, db)
        return f"Genial, *{elegido.nombre}* con *{profs[0].nombre}* ✅\n\n{_pregunta_dia()}"

    datos["profesionales"] = [{"id": p.id, "nombre": p.nombre} for p in profs]
    _set_conv(conv, "profesional", datos, db)
    lineas = [f"{i + 1}. {p.nombre}" for i, p in enumerate(profs)]
    lineas.append(f"{len(profs) + 1}. Cualquiera 🤷")
    return (
        f"Genial, *{elegido.nombre}* ✅\n\n¿Con qué profesional querés atenderte?\n\n"
        + "\n".join(lineas)
        + "\n\nRespondé con el *número*."
    )


def _paso_profesional(negocio, conv, datos, texto, db) -> str:
    profs = datos.get("profesionales", [])
    num = _parse_numero(texto)
    if not num or not (1 <= num <= len(profs) + 1):
        return "Respondé con el *número* de un profesional de la lista."
    if num == len(profs) + 1:  # cualquiera
        datos["profesional_id"] = None
        datos["profesional_nombre"] = "cualquiera"
        quien = "el primero disponible"
    else:
        p = profs[num - 1]
        datos["profesional_id"] = p["id"]
        datos["profesional_nombre"] = p["nombre"]
        quien = f"*{p['nombre']}*"
    _set_conv(conv, "dia", datos, db)
    return f"Perfecto, con {quien} 👍\n\n{_pregunta_dia()}"


def _paso_dia(negocio, conv, datos, texto, db) -> str:
    tz = ZoneInfo(negocio.zona_horaria)
    hoy = datetime.now(tz).date()
    fecha = _parse_dia(texto, hoy)
    if not fecha:
        return "No entendí la fecha 🤔. Escribí *hoy*, *mañana* o algo como *18/06*."
    if fecha < hoy:
        return "Esa fecha ya pasó 🙈. Probá con otro día (ej: *mañana* o *18/06*)."

    franjas = calcular_disponibilidad(
        negocio.id, [datos["servicio_id"]], fecha, datos.get("profesional_id"), tz, db
    )
    slots = franjas["manana"] + franjas["tarde"] + franjas["noche"]
    if not slots:
        return (
            f"No hay horarios disponibles para el *{fecha:%d/%m}* 😕. "
            "¿Querés probar otro día?"
        )
    slots = slots[:_MAX_SLOTS]
    datos["fecha"] = fecha.isoformat()
    datos["slots"] = [
        {"inicio": s["inicio"].isoformat(), "profesional_id": s["profesional_id"]}
        for s in slots
    ]
    _set_conv(conv, "hora", datos, db)
    lineas = [
        f"{i + 1}. {datetime.fromisoformat(s['inicio']).astimezone(tz):%H:%M} hs"
        for i, s in enumerate(datos["slots"])
    ]
    return (
        f"Horarios para el *{fecha:%d/%m}*:\n\n"
        + "\n".join(lineas)
        + "\n\nRespondé con el *número* del horario."
    )


def _paso_hora(negocio, conv, datos, texto, db, cliente) -> str:
    slots = datos.get("slots", [])
    num = _parse_numero(texto)
    if not num or not (1 <= num <= len(slots)):
        return "Respondé con el *número* de uno de los horarios de la lista."
    datos["slot"] = slots[num - 1]
    # Si reconocemos al cliente, igual confirmamos el nombre (puede querer corregirlo).
    if cliente and cliente.nombre:
        datos["nombre_sugerido"] = cliente.nombre
        datos["email_cliente"] = cliente.email
        _set_conv(conv, "confirmar", datos, db)
        return (
            f"¡Casi listo! 🙌 ¿Confirmo el turno a nombre de *{cliente.nombre}*?\n\n"
            "Respondé *sí* para confirmar, o escribime tu nombre si querés otro."
        )
    _set_conv(conv, "nombre", datos, db)
    return "¡Casi listo! ✍️ ¿A nombre de quién reservo? Decime tu *nombre*."


def _paso_confirmar(negocio, conv, datos, texto, db) -> str:
    t = _norm(texto)
    if t in ("si", "si!", "sii", "dale", "confirmo", "ok", "oka", "sip", "listo", "correcto"):
        return _crear_reserva(
            negocio, conv, datos, datos.get("nombre_sugerido", ""), datos.get("email_cliente"), db
        )
    # Cualquier otra cosa la tomamos como el nombre con el que quiere reservar.
    nombre = texto.strip()[:80]
    if len(nombre) < 2:
        return "Respondé *sí* para confirmar, o escribime tu nombre 🙂."
    return _crear_reserva(negocio, conv, datos, nombre, None, db)


def _paso_nombre(negocio, conv, datos, texto, db) -> str:
    nombre = texto.strip()[:80]
    if len(nombre) < 2:
        return "Decime tu nombre para confirmar la reserva 🙂."
    return _crear_reserva(negocio, conv, datos, nombre, None, db)


def _crear_reserva(negocio, conv, datos, nombre, email, db) -> str:
    from fastapi import HTTPException

    from app.schemas.reserva import ClienteAdminDatos, ReservaAdminCreate
    from app.services.reservas import crear_reserva_admin

    slot = datos["slot"]
    telefono = conv.telefono
    data = ReservaAdminCreate(
        servicio_ids=[datos["servicio_id"]],
        profesional_id=slot["profesional_id"],
        inicio=datetime.fromisoformat(slot["inicio"]),
        cliente=ClienteAdminDatos(nombre=nombre, telefono=telefono, email=email or None),
        notas="Reserva creada por el bot de WhatsApp",
    )
    try:
        reserva = crear_reserva_admin(negocio.id, data, db)
    except HTTPException:
        _borrar_conv(conv, db)
        return (
            "Uy, ese horario ya no está disponible 😕. "
            "Escribí *reservar* para elegir otro."
        )

    tz = ZoneInfo(negocio.zona_horaria)
    inicio_local = reserva.inicio.astimezone(tz)
    nombre_corto = nombre.split(" ")[0]
    prof_txt = ""
    prof_nombre = datos.get("profesional_nombre")
    if prof_nombre and prof_nombre != "cualquiera":
        prof_txt = f" con *{prof_nombre}*"
    _borrar_conv(conv, db)
    return (
        f"¡Listo {nombre_corto}! ✅\n\n"
        f"Tu turno de *{datos['servicio_nombre']}*{prof_txt} quedó reservado para el "
        f"*{inicio_local:%d/%m}* a las *{inicio_local:%H:%M} hs*.\n\n"
        f"¡Te esperamos! 🙌 Si no podés venir, avisanos así liberamos el lugar."
    )


# ── Punto de entrada ─────────────────────────────────────────────────────


def manejar_conversacion(
    negocio: Negocio, telefono: str, texto: str, db: Session, cliente=None
) -> str | None:
    """Maneja el flujo de agendamiento. Devuelve la respuesta del bot, o None si
    el mensaje no corresponde a una reserva (para que siga el flujo normal)."""
    conv = _get_conv(negocio, telefono, db)
    t = _norm(texto)

    # Cancelar / salir de una conversación activa.
    if conv and t in ("cancelar", "salir", "menu", "menú", "no"):
        _borrar_conv(conv, db)
        return "Listo, cancelé eso 🙌. Si querés reservar después, escribí *reservar*."

    # Conversación vencida: la borramos y, si pidió reservar, arrancamos de nuevo.
    if conv and _expirada(conv):
        _borrar_conv(conv, db)
        conv = None

    if not conv:
        # Sin conversación activa: solo arrancamos si pidió un turno.
        if _RE_RESERVAR.search(t):
            return _iniciar(negocio, telefono, db)
        return None

    # Continuamos según el estado.
    try:
        datos = json.loads(conv.datos or "{}")
    except (ValueError, TypeError):
        datos = {}

    if conv.estado == "servicio":
        return _paso_servicio(negocio, conv, datos, texto, db)
    if conv.estado == "profesional":
        return _paso_profesional(negocio, conv, datos, texto, db)
    if conv.estado == "dia":
        return _paso_dia(negocio, conv, datos, texto, db)
    if conv.estado == "hora":
        return _paso_hora(negocio, conv, datos, texto, db, cliente)
    if conv.estado == "confirmar":
        return _paso_confirmar(negocio, conv, datos, texto, db)
    if conv.estado == "nombre":
        return _paso_nombre(negocio, conv, datos, texto, db)
    # Estado desconocido: limpiamos.
    _borrar_conv(conv, db)
    return None
