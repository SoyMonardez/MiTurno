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


# Color de marca por defecto (diseño unificado; branding por negocio queda para más adelante).
COLOR_MARCA = "#1e293b"


def layout_html(negocio: Negocio, contenido_html: str) -> str:
    """Envuelve el contenido en un email HTML con branding del negocio."""
    logo = ""
    if negocio.logo:
        logo = (
            f'<img src="{negocio.logo}" alt="{negocio.nombre}" '
            f'style="max-height:48px;margin-bottom:8px;display:block;" />'
        )
    pie = f"{negocio.nombre}"
    if negocio.direccion:
        pie += f" · {negocio.direccion}"
    return f"""\
<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:{COLOR_MARCA};color:#ffffff;border-radius:12px 12px 0 0;padding:20px 24px;">
      {logo}
      <div style="font-size:20px;font-weight:bold;">{negocio.nombre}</div>
    </div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
      {contenido_html}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">{pie}</p>
  </div>
</body>
</html>"""


def _fila(etiqueta: str, valor: str) -> str:
    return (
        f'<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">{etiqueta}</td>'
        f'<td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;">{valor}</td></tr>'
    )


def _boton(texto: str, enlace: str) -> str:
    return (
        f'<a href="{enlace}" style="display:inline-block;background:{COLOR_MARCA};color:#ffffff;'
        f'text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">{texto}</a>'
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
    html_cliente = layout_html(
        negocio,
        f"""
        <p style="font-size:16px;margin:0 0 4px;">¡Hola {cliente_nombre}! 👋</p>
        <p style="color:#475569;margin:0 0 16px;">Tu reserva quedó <strong>confirmada</strong>.</p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;
                      border-bottom:1px solid #e2e8f0;margin-bottom:20px;">{filas}</table>
        <p style="text-align:center;margin:0 0 8px;">{_boton("Cancelar reserva", enlace_cancelar)}</p>
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin:0;">
          Podés cancelar hasta 20 minutos antes del turno.</p>
        """,
    )
    ics = generar_ics(
        titulo=f"{servicios_str} - {negocio.nombre}",
        inicio=reserva.inicio,
        fin=reserva.fin,
        descripcion=f"Profesional: {profesional_nombre}. Total: ${reserva.total_precio}.",
        ubicacion=negocio.direccion or negocio.nombre,
        uid=f"reserva-{reserva.id}@miturno",
    )
    ok = _enviar_email(
        cliente_email,
        f"Reserva confirmada - {negocio.nombre}",
        cuerpo_cliente,
        html_cliente,
        ics=ics,
    )
    _registrar(db, reserva.id, TipoNotificacion.confirmacion_cliente, cliente_email, ok)
    # El aviso de nuevas reservas al negocio se ve en el panel admin (auto-refresco),
    # por eso no se envía email al administrador.
