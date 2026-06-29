"""Bot de atención 24 hs por WhatsApp (plan Premium).

Enrutador híbrido de mensajes entrantes:
1. "SÍ" de un cliente con oferta activa de lista de espera → crea la reserva.
2. Filtro de intenciones con RegEx (gratis): dirección, precios, horarios.
3. Consulta libre → Groq (Llama 3) con contexto del negocio.
"""
import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.catalogo import Servicio
from app.models.negocio import Negocio
from app.models.profesional import HorarioRecurrente, Profesional
from app.services.lista_espera import confirmar_oferta_por_telefono

_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def _normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFD", texto or "")
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return texto.lower().strip()


def _link_reservas(negocio: Negocio) -> str:
    return f"{settings.frontend_url.rstrip('/')}/{negocio.slug}"


# Detección simple de quejas/malestar para registrarlas y que el negocio las vea.
_RE_QUEJA = re.compile(
    r"\b(queja|me quejo|pesimo|horrible|malisimo|desastre|terrible|mal atendid|"
    r"mala atencion|no me gusto|muy mal|una porqueria|porqueria|estafa|nunca mas|"
    r"decepcion|decepcionad|maltrat|grosero|impuntual|me hicieron esperar|"
    r"perdi mi turno|no atienden|no contestan)\b"
)


def _manejar_queja(negocio: Negocio, telefono: str, texto: str, cliente, db: Session) -> str | None:
    """Si el mensaje parece una queja, la guarda para el negocio y responde con empatía."""
    if not _RE_QUEJA.search(_normalizar(texto)):
        return None
    from app.models.premium import FeedbackCliente

    try:
        db.add(
            FeedbackCliente(
                negocio_id=negocio.id,
                cliente_id=cliente.id if cliente else None,
                telefono=telefono,
                nombre=cliente.nombre if cliente else None,
                mensaje=texto[:2000],
                tipo="queja",
            )
        )
        db.commit()
    except Exception as exc:
        print(f"[QUEJA ERROR] {exc}", flush=True)
        db.rollback()
    nombre = cliente.nombre.split(" ")[0] if cliente and cliente.nombre else ""
    saludo = f"{nombre}, " if nombre else ""
    return (
        f"Lamento mucho leer esto 🙏 {saludo}ya le pasé tu comentario al equipo de "
        f"*{negocio.nombre}* para que lo tengan en cuenta y te contacten. "
        f"Gracias por tomarte el tiempo de avisarnos."
    )


def _texto_precios(negocio: Negocio, db: Session) -> str:
    servicios = list(
        db.scalars(
            select(Servicio)
            .where(Servicio.negocio_id == negocio.id, Servicio.activo)
            .order_by(Servicio.precio)
        )
    )
    if not servicios:
        return f"Consultá nuestros servicios y precios acá 👇\n{_link_reservas(negocio)}"
    lineas = [
        f"{s.nombre} — *${s.precio:,.0f}*".replace(",", ".") for s in servicios[:15]
    ]
    return (
        "*Precios* 💈\n\n"
        + "\n".join(lineas)
        + f"\n\nReservá tu turno acá 👇\n{_link_reservas(negocio)}"
    )


def _fmt_hora(minutos: int) -> str:
    """Formatea minutos-desde-medianoche como '9' o '9:30' (sin el ':00')."""
    h, m = divmod(minutos, 60)
    return f"{h}" if m == 0 else f"{h}:{m:02d}"


def _merge_rangos(rangos: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Fusiona rangos horarios que se solapan o se tocan en intervalos mínimos."""
    fusionados: list[tuple[int, int]] = []
    for ini, fin in sorted(set(rangos)):
        if fusionados and ini <= fusionados[-1][1]:
            fusionados[-1] = (fusionados[-1][0], max(fusionados[-1][1], fin))
        else:
            fusionados.append((ini, fin))
    return fusionados


def _texto_horarios(negocio: Negocio, db: Session) -> str:
    filas = db.execute(
        select(HorarioRecurrente.dia_semana, HorarioRecurrente.hora_inicio, HorarioRecurrente.hora_fin)
        .join(Profesional, Profesional.id == HorarioRecurrente.profesional_id)
        .where(Profesional.negocio_id == negocio.id)
    ).all()
    if not filas:
        return f"Consultá nuestros horarios acá 👇\n{_link_reservas(negocio)}"

    # Fusionamos los rangos de todos los profesionales en intervalos limpios por día.
    por_dia: dict[int, list[tuple[int, int]]] = {}
    for dia, h_ini, h_fin in filas:
        por_dia.setdefault(dia, []).append(
            (h_ini.hour * 60 + h_ini.minute, h_fin.hour * 60 + h_fin.minute)
        )
    dia_horas: dict[int, str] = {
        dia: " y ".join(f"{_fmt_hora(a)} a {_fmt_hora(b)} hs" for a, b in _merge_rangos(r))
        for dia, r in por_dia.items()
    }

    # Agrupamos días consecutivos con el mismo horario (ej: "Lunes a viernes").
    dias = sorted(dia_horas)
    lineas: list[str] = []
    i = 0
    while i < len(dias):
        j = i
        while (
            j + 1 < len(dias)
            and dias[j + 1] == dias[j] + 1
            and dia_horas[dias[j + 1]] == dia_horas[dias[i]]
        ):
            j += 1
        etiqueta = (
            _DIAS[dias[i]]
            if i == j
            else f"{_DIAS[dias[i]]} a {_DIAS[dias[j]].lower()}"
        )
        lineas.append(f"{etiqueta}: {dia_horas[dias[i]]}")
        i = j + 1
    return "*Horarios* 🕒\n\n" + "\n".join(lineas)


# Claves de las respuestas personalizables del bot.
CLAVES_BOT = ("bienvenida", "precios", "horarios", "direccion", "reservar")


def _contexto_placeholders(negocio: Negocio, db: Session) -> dict[str, str]:
    """Valores que el admin puede usar como {placeholders} en sus respuestas."""
    return {
        "nombre": negocio.nombre,
        "link": _link_reservas(negocio),
        "direccion": negocio.direccion or "",
        "mapa": negocio.mapa_url or "",
        "precios": _texto_precios(negocio, db),
        "horarios": _texto_horarios(negocio, db),
    }


def _custom(negocio: Negocio, clave: str, db: Session) -> str | None:
    """Devuelve la respuesta personalizada del admin para una clave, con los
    {placeholders} reemplazados. None si el admin no la personalizó."""
    import json

    if not negocio.bot_respuestas:
        return None
    try:
        data = json.loads(negocio.bot_respuestas)
    except (ValueError, TypeError):
        return None
    texto = (data.get(clave) or "").strip()
    if not texto:
        return None
    ctx = _contexto_placeholders(negocio, db)
    for k, v in ctx.items():
        texto = texto.replace(f"{{{k}}}", v)
    return texto


def _auto_direccion(negocio: Negocio) -> str:
    cuerpo = negocio.direccion or "Consultanos la dirección por este medio."
    texto = f"*Dónde estamos* 📍\n\n{cuerpo}"
    if negocio.mapa_url:
        texto += f"\n\nCómo llegar 👇\n{negocio.mapa_url}"
    return texto


def _auto_reservar(negocio: Negocio) -> str:
    return f"¡Genial! 🙌 Reservá tu turno acá 👇\n{_link_reservas(negocio)}"


def _respuesta_estatica(texto: str, negocio: Negocio, db: Session) -> str | None:
    """Filtro de intenciones simples antes de consumir IA (ahorra cómputo).

    Para cada intención: si el admin personalizó la respuesta, usa esa; si no,
    genera la automática con los datos reales del negocio.
    """
    t = _normalizar(texto)
    if re.search(r"\b(direccion|ubicacion|donde (estan|queda)|como llego)\b", t):
        return _custom(negocio, "direccion", db) or _auto_direccion(negocio)
    if re.search(r"\b(precio|precios|cuanto (sale|cuesta|cobran)|tarifa)\b", t):
        return _custom(negocio, "precios", db) or _texto_precios(negocio, db)
    if re.search(r"\b(horario|horarios|que hora (abren|cierran)|abren|cierran)\b", t):
        return _custom(negocio, "horarios", db) or _texto_horarios(negocio, db)
    if re.search(r"\b(turno|reserva|reservar|agendar|sacar (un )?turno)\b", t):
        return _custom(negocio, "reservar", db) or _auto_reservar(negocio)
    return None


def _cliente_por_telefono(negocio: Negocio, telefono: str | None, db: Session):
    """Busca al cliente registrado que coincide con el teléfono (match flexible
    por los últimos dígitos, porque los formatos varían: +54 9, 549, 0, etc.)."""
    from app.models.cliente import Cliente
    from app.services.whatsapp import normalizar_telefono

    tel = normalizar_telefono(telefono)
    if len(tel) < 8:
        return None
    cola = tel[-8:]
    clientes = db.scalars(select(Cliente).where(Cliente.negocio_id == negocio.id))
    for c in clientes:
        if c.telefono and normalizar_telefono(c.telefono).endswith(cola):
            return c
    return None


def _contexto_cliente(cliente) -> str:
    """Frase de contexto del cliente para que la IA dé seguimiento personalizado."""
    if not cliente:
        return ""
    partes = [f"El cliente se llama {cliente.nombre}"]
    if getattr(cliente, "email", None):
        partes.append(f"(email registrado: {cliente.email})")
    seg = getattr(cliente, "segmento", None)
    if seg:
        partes.append(f", es un cliente {getattr(seg, 'value', seg)}")
    if getattr(cliente, "turnos_completados", 0):
        partes.append(f" con {cliente.turnos_completados} visitas")
    if getattr(cliente, "ultima_visita", None):
        partes.append(f"; su última visita fue el {cliente.ultima_visita:%d/%m/%Y}")
    return (
        " ".join(partes)
        + ". Saludalo por su nombre y, si corresponde, hacé referencia a su historial."
    )


def _ultima_nota_historial(negocio: Negocio, cliente, db: Session):
    """Devuelve el registro de historial más reciente del cliente, o None."""
    if not cliente:
        return None
    from app.models.premium import ClienteHistorial

    return db.scalar(
        select(ClienteHistorial)
        .where(
            ClienteHistorial.negocio_id == negocio.id,
            ClienteHistorial.cliente_id == cliente.id,
        )
        .order_by(ClienteHistorial.fecha_actualizacion.desc())
    )


def _system_prompt(negocio: Negocio, db: Session, cliente=None) -> str:
    servicios = list(
        db.scalars(
            select(Servicio).where(Servicio.negocio_id == negocio.id, Servicio.activo)
        )
    )
    lista = "; ".join(f"{s.nombre} (${s.precio:,.0f})".replace(",", ".") for s in servicios)
    contexto = _contexto_cliente(cliente)
    # Última sesión: le permite a la IA conversar sobre lo que se hizo la vez pasada.
    nota = _ultima_nota_historial(negocio, cliente, db)
    if nota:
        contexto += (
            f" En su última sesión ({nota.fecha_actualizacion:%d/%m/%Y}) se registró: "
            f"\"{nota.notas_estilo}\". Si el cliente lo menciona o es relevante, podés "
            f"hacer referencia a eso de forma natural (preguntarle cómo le fue, etc.), "
            f"pero sin revelar datos médicos sensibles si no los menciona él primero."
        )
    # Base de conocimiento cargada por el negocio (FAQs, políticas, promos).
    conocimiento = (negocio.bot_conocimiento or "").strip()
    bloque_conocimiento = (
        f"\n\nINFORMACIÓN DEL NEGOCIO (usá SOLO esto, es la fuente de verdad):\n{conocimiento}"
        if conocimiento
        else ""
    )
    return (
        f"Sos el asistente virtual de '{negocio.nombre}'. Tu tono es amable, directo "
        f"y profesional, en español rioplatense.\n\n"
        f"REGLAS ESTRICTAS (cumplilas siempre):\n"
        f"1. NUNCA inventes datos. Solo podés afirmar lo que está acá: servicios, "
        f"precios, dirección y la información del negocio. Si no sabés algo, decí "
        f"'no tengo esa info, consultá en el local' — nunca te lo inventes.\n"
        f"2. No prometas descuentos, promociones, disponibilidad ni horarios "
        f"específicos que no estén indicados.\n"
        f"3. Si te piden agendar, NO inventes turnos: pedile que escriba *reservar* "
        f"para iniciar la reserva, o pasale el enlace: {_link_reservas(negocio)}\n"
        f"4. Respondé corto (máximo 3 oraciones), sin markdown.\n\n"
        f"DATOS:\n"
        f"- Servicios: {lista or 'consultar en el local'}\n"
        f"- Dirección: {negocio.direccion or 'no publicada'}"
        + bloque_conocimiento
        + (f"\n\nSOBRE EL CLIENTE: {contexto}" if contexto else "")
    )


def _respuesta_ia(texto: str, negocio: Negocio, db: Session, cliente=None) -> str | None:
    if not settings.groq_api_key:
        return None
    try:
        from groq import Groq

        client = Groq(api_key=settings.groq_api_key)
        resp = client.chat.completions.create(
            model=settings.groq_model,
            max_tokens=300,
            # Temperatura baja = respuestas más determinísticas y menos "creativas"
            # (menos alucinación).
            temperature=0.2,
            messages=[
                {"role": "system", "content": _system_prompt(negocio, db, cliente)},
                {"role": "user", "content": texto},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        print(f"[BOT IA ERROR] {exc}", flush=True)
        return None


def procesar_mensaje(negocio: Negocio, telefono: str, texto: str, db: Session) -> str | None:
    """Devuelve la respuesta a enviar por WhatsApp (None = no responder)."""
    if not texto:
        return None

    # Reconocemos al cliente por su teléfono (seguimiento personalizado).
    cliente = _cliente_por_telefono(negocio, telefono, db)

    # 0. Agendamiento por el bot: si hay una reserva en curso o el cliente pide
    #    un turno, manejamos toda la conversación (servicio → día → hora → confirmar).
    from app.services.bot_reservas import manejar_conversacion

    reserva = manejar_conversacion(negocio, telefono, texto, db, cliente)
    if reserva is not None:
        return reserva

    # 0.5 Quejas: las registramos para el negocio y respondemos con empatía.
    queja = _manejar_queja(negocio, telefono, texto, cliente, db)
    if queja:
        return queja

    # 1. Confirmación de lista de espera ("SÍ")
    if re.fullmatch(r"\s*si\s*!*\s*", _normalizar(texto)):
        respuesta = confirmar_oferta_por_telefono(negocio, telefono, db)
        if respuesta:
            return respuesta

    # 2. Respuestas pregrabadas (RegEx, sin costo de IA)
    estatica = _respuesta_estatica(texto, negocio, db)
    if estatica:
        return estatica

    # 3. Consulta libre → Groq (con contexto del cliente si lo conocemos)
    ia = _respuesta_ia(texto, negocio, db, cliente)
    if ia:
        return ia

    # 4. Fallback: respuesta de bienvenida personalizada o la automática.
    saludo = (
        f"¡Hola {cliente.nombre.split(' ')[0]}! 👋"
        if cliente and cliente.nombre
        else "¡Hola! 👋"
    )
    return _custom(negocio, "bienvenida", db) or (
        f"{saludo} Gracias por escribir a *{negocio.nombre}*.\n\n"
        f"Escribime *precios*, *horarios* o *dónde están*, "
        f"o reservá tu turno acá 👇\n{_link_reservas(negocio)}"
    )
