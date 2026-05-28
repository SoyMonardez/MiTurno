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


def _enviar_email(destinatario: str, asunto: str, cuerpo: str) -> bool:
    """Envía un email por SMTP. Si no hay SMTP configurado, lo imprime en consola."""
    if not settings.smtp_host:
        print("=" * 60)
        print(f"[EMAIL SIMULADO] Para: {destinatario}")
        print(f"Asunto: {asunto}")
        print(cuerpo)
        print("=" * 60, flush=True)
        return True

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = destinatario
    msg["Subject"] = asunto
    msg.set_content(cuerpo)
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

    ok = _enviar_email(cliente_email, f"Reserva confirmada - {negocio.nombre}", cuerpo_cliente)
    _registrar(db, reserva.id, TipoNotificacion.confirmacion_cliente, cliente_email, ok)

    admin_email = negocio.email_notificaciones
    if admin_email:
        cuerpo_admin = (
            f"Nueva reserva en {negocio.nombre}.\n\n"
            f"Cliente: {cliente_nombre} ({cliente_email})\n"
            f"Servicios: {servicios_str}\n"
            f"Profesional: {profesional_nombre}\n"
            f"Fecha y hora: {fecha_str}\n"
            f"Total: ${reserva.total_precio}\n"
        )
        ok_admin = _enviar_email(admin_email, f"Nueva reserva - {negocio.nombre}", cuerpo_admin)
        _registrar(db, reserva.id, TipoNotificacion.aviso_admin, admin_email, ok_admin)
