import smtplib
from datetime import datetime
from email.message import EmailMessage
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import EstadoNotificacion, TipoNotificacion
from app.models.negocio import Negocio
from app.models.notificacion import NotificacionLog
from app.models.reserva import Reserva


def generar_ics(
    titulo: str,
    inicio: datetime,
    fin: datetime,
    descripcion: str = "",
    ubicacion: str = "",
    uid: str | None = None,
) -> str:
    """Genera el contenido de un archivo iCalendar (.ics) para un evento."""
    import uuid

    def _fmt(dt: datetime) -> str:
        return dt.astimezone(ZoneInfo("UTC")).strftime("%Y%m%dT%H%M%SZ")

    def _esc(texto: str) -> str:
        return (
            texto.replace("\\", "\\\\")
            .replace(";", "\\;")
            .replace(",", "\\,")
            .replace("\n", "\\n")
        )

    uid = uid or f"{uuid.uuid4()}@miturno"
    return "\r\n".join(
        [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//MiTurno//Reservas//ES",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{_fmt(datetime.now(ZoneInfo('UTC')))}",
            f"DTSTART:{_fmt(inicio)}",
            f"DTEND:{_fmt(fin)}",
            f"SUMMARY:{_esc(titulo)}",
            f"DESCRIPTION:{_esc(descripcion)}",
            f"LOCATION:{_esc(ubicacion)}",
            "STATUS:CONFIRMED",
            "BEGIN:VALARM",
            "TRIGGER:-PT2H",
            "ACTION:DISPLAY",
            f"DESCRIPTION:{_esc('Recordatorio: ' + titulo)}",
            "END:VALARM",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
    )


def _enviar_email(
    destinatario: str,
    asunto: str,
    cuerpo: str,
    cuerpo_html: str | None = None,
    ics: str | None = None,
) -> bool:
    """Envía un email por SMTP. Si no hay SMTP configurado, lo imprime en consola."""
    if not settings.smtp_host:
        print("=" * 60)
        print(f"[EMAIL SIMULADO] Para: {destinatario}")
        print(f"Asunto: {asunto}")
        print(cuerpo)
        if ics:
            print("[+ adjunto turno.ics]")
        print("=" * 60, flush=True)
        return True

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = destinatario
    msg["Subject"] = asunto
    msg.set_content(cuerpo)
    if cuerpo_html:
        msg.add_alternative(cuerpo_html, subtype="html")
    if ics:
        msg.add_attachment(
            ics.encode("utf-8"),
            maintype="text",
            subtype="calendar",
            filename="turno.ics",
        )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[EMAIL ERROR] {destinatario}: {exc}", flush=True)
        return False


def _registrar(
    db: Session,
    reserva_id: int | None,
    tipo: TipoNotificacion,
    destinatario: str,
    ok: bool,
) -> None:
    db.add(
        NotificacionLog(
            reserva_id=reserva_id,
            tipo=tipo,
            destinatario=destinatario,
            enviado_en=datetime.now(ZoneInfo("UTC")) if ok else None,
            estado=EstadoNotificacion.enviado if ok else EstadoNotificacion.fallido,
        )
    )


def _formato_fecha(dt: datetime, tz: ZoneInfo) -> str:
    return dt.astimezone(tz).strftime("%d/%m/%Y %H:%M")


# Paleta editorial (coincide con el frontend): negro + neutros.
COLOR_NEGRO = "#0a0a0a"
COLOR_TEXTO = "#171717"
COLOR_SUAVE = "#737373"
COLOR_BORDE = "#e5e5e5"
FUENTE_SERIF = "Georgia, 'Times New Roman', serif"
FUENTE_SANS = "Arial, Helvetica, sans-serif"


def layout_html(negocio: Negocio, contenido_html: str) -> str:
    """Envuelve el contenido en un email HTML con estética editorial."""
    if negocio.logo:
        marca = (
            f'<img src="{negocio.logo}" alt="{negocio.nombre}" '
            f'style="max-height:44px;margin:0 auto;display:block;" />'
        )
    else:
        marca = (
            f'<div style="font-family:{FUENTE_SERIF};font-size:26px;letter-spacing:3px;'
            f'text-transform:uppercase;color:#ffffff;">{negocio.nombre}</div>'
        )

    pie = negocio.nombre
    if negocio.direccion:
        pie += f" &middot; {negocio.direccion}"

    return f"""\
<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f5f5;font-family:{FUENTE_SANS};color:{COLOR_TEXTO};">
  <div style="max-width:540px;margin:0 auto;padding:24px 16px;">
    <!-- Header negro -->
    <div style="background:{COLOR_NEGRO};padding:34px 24px;text-align:center;">
      <div style="margin-bottom:10px;">
        <span style="display:inline-block;width:36px;height:1px;background:rgba(255,255,255,0.35);vertical-align:middle;"></span>
        <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.5);margin:0 10px;vertical-align:middle;"></span>
        <span style="display:inline-block;width:36px;height:1px;background:rgba(255,255,255,0.35);vertical-align:middle;"></span>
      </div>
      {marca}
    </div>
    <!-- Cuerpo -->
    <div style="background:#ffffff;border:1px solid {COLOR_BORDE};border-top:none;padding:32px 28px;">
      {contenido_html}
    </div>
    <!-- Pie -->
    <p style="text-align:center;color:#a3a3a3;font-size:10px;letter-spacing:1.5px;
              text-transform:uppercase;margin:18px 0 0;">{pie}</p>
  </div>
</body>
</html>"""


def _titulo(texto: str) -> str:
    return (
        f'<h1 style="font-family:{FUENTE_SERIF};font-size:22px;font-weight:normal;'
        f'color:{COLOR_TEXTO};margin:0 0 6px;">{texto}</h1>'
    )


def _parrafo(texto: str) -> str:
    return f'<p style="color:{COLOR_SUAVE};font-size:14px;line-height:1.6;margin:0 0 18px;">{texto}</p>'


def _fila(etiqueta: str, valor: str) -> str:
    return (
        f'<tr>'
        f'<td style="padding:9px 0;border-bottom:1px solid #f0f0f0;color:{COLOR_SUAVE};'
        f'font-size:10px;letter-spacing:1.2px;text-transform:uppercase;">{etiqueta}</td>'
        f'<td style="padding:9px 0;border-bottom:1px solid #f0f0f0;text-align:right;'
        f'font-size:14px;color:{COLOR_TEXTO};">{valor}</td>'
        f'</tr>'
    )


def _boton(texto: str, enlace: str) -> str:
    return (
        f'<a href="{enlace}" style="display:inline-block;background:{COLOR_NEGRO};color:#ffffff;'
        f'text-decoration:none;padding:14px 30px;font-size:11px;letter-spacing:2px;'
        f'text-transform:uppercase;font-family:{FUENTE_SANS};">{texto}</a>'
    )


def _boton_borde(texto: str, enlace: str) -> str:
    return (
        f'<a href="{enlace}" style="display:inline-block;background:#ffffff;color:{COLOR_NEGRO};'
        f'border:1px solid {COLOR_NEGRO};text-decoration:none;padding:13px 30px;font-size:11px;'
        f'letter-spacing:2px;text-transform:uppercase;font-family:{FUENTE_SANS};">{texto}</a>'
    )


def link_google_calendar(
    titulo: str, inicio: datetime, fin: datetime, descripcion: str = "", ubicacion: str = ""
) -> str:
    """Genera un enlace que abre Google Calendar con el evento precargado (sin descargas)."""
    from urllib.parse import quote_plus

    def _fmt(dt: datetime) -> str:
        return dt.astimezone(ZoneInfo("UTC")).strftime("%Y%m%dT%H%M%SZ")

    return (
        "https://calendar.google.com/calendar/render?action=TEMPLATE"
        f"&text={quote_plus(titulo)}"
        f"&dates={_fmt(inicio)}/{_fmt(fin)}"
        f"&details={quote_plus(descripcion)}"
        f"&location={quote_plus(ubicacion)}"
    )


def enviar_confirmacion_reserva(
    db: Session,
    reserva: Reserva,
    negocio: Negocio,
    cliente_nombre: str,
    cliente_email: str,
    servicios_nombres: list[str],
    profesional_nombre: str,
) -> None:
    """Envía confirmación al cliente y aviso al admin. Registra ambos en el log."""
    tz = ZoneInfo(negocio.zona_horaria)
    fecha_str = _formato_fecha(reserva.inicio, tz)
    servicios_str = ", ".join(servicios_nombres)
    enlace_cancelar = f"{settings.frontend_url}/cancelar/{reserva.token_cancelacion}"

    cuerpo_cliente = (
        f"Hola {cliente_nombre},\n\n"
        f"Tu reserva en {negocio.nombre} quedó confirmada.\n\n"
        f"Servicios: {servicios_str}\n"
        f"Profesional: {profesional_nombre}\n"
        f"Fecha y hora: {fecha_str} ({negocio.zona_horaria})\n"
        f"Total: ${reserva.total_precio}\n"
        f"Duración: {reserva.total_duracion} min\n"
    )
    if negocio.direccion:
        cuerpo_cliente += f"Dirección: {negocio.direccion}\n"
    cuerpo_cliente += f"\nSi necesitás cancelar: {enlace_cancelar}\n"

    filas = (
        _fila("Servicios", servicios_str)
        + _fila("Profesional", profesional_nombre)
        + _fila("Fecha y hora", f"{fecha_str} hs")
        + _fila("Duración", f"{reserva.total_duracion} min")
        + _fila("Total", f"${reserva.total_precio}")
    )
    if negocio.direccion:
        filas += _fila("Dirección", negocio.direccion)
    enlace_calendario = link_google_calendar(
        titulo=f"{servicios_str} - {negocio.nombre}",
        inicio=reserva.inicio,
        fin=reserva.fin,
        descripcion=f"Profesional: {profesional_nombre}. Total: ${reserva.total_precio}.",
        ubicacion=negocio.direccion or negocio.nombre,
    )
    html_cliente = layout_html(
        negocio,
        f"""
        {_titulo("Reserva confirmada")}
        {_parrafo(f"Hola {cliente_nombre}, tu turno quedó reservado. Te esperamos.")}
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #f0f0f0;
                      margin-bottom:24px;">{filas}</table>
        <p style="text-align:center;margin:0 0 10px;">{_boton("Agregar al calendario", enlace_calendario)}</p>
        <p style="text-align:center;margin:0 0 14px;">{_boton_borde("Cancelar reserva", enlace_cancelar)}</p>
        <p style="text-align:center;color:#a3a3a3;font-size:11px;margin:0;">
          Podés cancelar hasta 20 minutos antes del turno.</p>
        """,
    )
    ok = _enviar_email(
        cliente_email,
        f"Reserva confirmada - {negocio.nombre}",
        cuerpo_cliente,
        html_cliente,
    )
    _registrar(db, reserva.id, TipoNotificacion.confirmacion_cliente, cliente_email, ok)
    # El aviso de nuevas reservas al negocio se ve en el panel admin (auto-refresco),
    # por eso no se envía email al administrador.


def enviar_notificacion_satisfaccion(
    db: Session,
    reserva: Reserva,
    negocio: Negocio,
    cliente_nombre: str,
    cliente_email: str,
) -> None:
    """Envía un correo al cliente solicitando su opinión tras finalizar su turno."""
    enlace_opinion = f"{settings.frontend_url}/{negocio.slug}?tab=resenas&opinar=true"

    cuerpo = (
        f"Hola {cliente_nombre},\n\n"
        f"¡Gracias por visitarnos en {negocio.nombre}!\n\n"
        f"Nos encantaría saber qué te pareció el servicio. "
        f"Podés dejarnos tu opinión en el siguiente enlace:\n"
        f"{enlace_opinion}\n\n"
        f"¡Te esperamos pronto!"
    )

    html = layout_html(
        negocio,
        f"""
        {_titulo("¿Cómo estuvo todo?")}
        {_parrafo(f"Hola {cliente_nombre}, gracias por visitarnos. Tu opinión nos ayuda a mejorar y le sirve a otros clientes.")}
        <p style="text-align:center;margin:0 0 14px;">{_boton("Dejar mi reseña", enlace_opinion)}</p>
        <p style="text-align:center;color:#a3a3a3;font-size:11px;margin:0;">Te lleva menos de un minuto.</p>
        """,
    )

    ok = _enviar_email(
        cliente_email,
        f"¿Qué te pareció el servicio en {negocio.nombre}?",
        cuerpo,
        html,
    )
    _registrar(db, reserva.id, TipoNotificacion.opinion_cliente, cliente_email, ok)

