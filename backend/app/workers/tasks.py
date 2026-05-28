from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.cliente import Cliente
from app.models.enums import (
    EstadoNotificacion,
    EstadoRecordatorio,
    TipoNotificacion,
    TipoRecordatorio,
)
from app.models.negocio import Negocio
from app.models.notificacion import NotificacionLog, RecordatorioProgramado
from app.models.reserva import Reserva
from app.services.notificaciones import _boton, _enviar_email, layout_html
from app.workers.celery_app import celery_app

_TIPO_NOTIF = {
    TipoRecordatorio.frecuencia: TipoNotificacion.recordatorio_frecuencia,
    TipoRecordatorio.inasistencia: TipoNotificacion.sugerencia_inasistencia,
    TipoRecordatorio.turno_proximo: TipoNotificacion.recordatorio_turno,
}


def _cuerpo(recordatorio: RecordatorioProgramado, negocio: Negocio, cliente: Cliente) -> str:
    enlace = f"{settings.frontend_url}/{negocio.slug}"
    if recordatorio.tipo == TipoRecordatorio.turno_proximo:
        return (
            f"Hola {cliente.nombre},\n\n"
            f"Te recordamos tu turno en {negocio.nombre} mañana. "
            f"¡Te esperamos!\n"
        )
    if recordatorio.tipo == TipoRecordatorio.frecuencia:
        return (
            f"Hola {cliente.nombre},\n\n"
            f"¿Listo para tu próxima visita a {negocio.nombre}? "
            f"Reservá tu turno acá: {enlace}\n"
        )
    return (
        f"Hola {cliente.nombre},\n\n"
        f"Te extrañamos en {negocio.nombre}. "
        f"Reagendá cuando quieras: {enlace}\n"
    )


@celery_app.task
def enviar_recordatorios_vencidos() -> int:
    """Envía los recordatorios pendientes cuya fecha ya llegó. Devuelve cuántos envió."""
    db = SessionLocal()
    enviados = 0
    try:
        ahora = datetime.now(ZoneInfo("UTC"))
        pendientes = list(
            db.scalars(
                select(RecordatorioProgramado).where(
                    RecordatorioProgramado.estado == EstadoRecordatorio.pendiente,
                    RecordatorioProgramado.enviar_en <= ahora,
                )
            )
        )
        for rec in pendientes:
            cliente = db.get(Cliente, rec.cliente_id)
            reserva = db.get(Reserva, rec.reserva_id)
            negocio = db.get(Negocio, reserva.negocio_id) if reserva else None
            if not cliente or not negocio:
                rec.estado = EstadoRecordatorio.cancelado
                continue

            asunto = f"Te esperamos en {negocio.nombre}"
            enlace = f"{settings.frontend_url}/{negocio.slug}"
            mensaje = (
                "¿Listo para tu próxima visita?"
                if rec.tipo == TipoRecordatorio.frecuencia
                else "Te extrañamos, ¡reagendá cuando quieras!"
            )
            html = layout_html(
                negocio,
                f"""
                <p style="font-size:16px;margin:0 0 4px;">¡Hola {cliente.nombre}! 👋</p>
                <p style="color:#475569;margin:0 0 20px;">{mensaje}</p>
                <p style="text-align:center;">{_boton("Reservar turno", enlace)}</p>
                """,
            )
            ok = _enviar_email(cliente.email, asunto, _cuerpo(rec, negocio, cliente), html)
            rec.estado = (
                EstadoRecordatorio.enviado if ok else EstadoRecordatorio.pendiente
            )
            db.add(
                NotificacionLog(
                    reserva_id=rec.reserva_id,
                    tipo=_TIPO_NOTIF[rec.tipo],
                    destinatario=cliente.email,
                    enviado_en=ahora if ok else None,
                    estado=EstadoNotificacion.enviado if ok else EstadoNotificacion.fallido,
                )
            )
            if ok:
                enviados += 1
        db.commit()
        return enviados
    finally:
        db.close()
