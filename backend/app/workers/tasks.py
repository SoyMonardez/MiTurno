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
from app.services.notificaciones import (
    _boton,
    _enviar_email,
    _parrafo,
    _titulo,
    es_email_enviable,
    layout_html,
)
from app.services.whatsapp import enviar_whatsapp
from app.workers.celery_app import celery_app


def _texto_wa_recordatorio(tipo, negocio, cliente, enlace) -> str:
    """Mensaje de recordatorio con formato WhatsApp (negrita con *)."""
    nombre = cliente.nombre.split(" ")[0] if cliente.nombre else ""
    saludo = f"¡Hola {nombre}! 👋" if nombre else "¡Hola! 👋"
    if tipo == TipoRecordatorio.turno_proximo:
        return (
            f"{saludo}\n\nTe recordamos tu turno en *{negocio.nombre}* mañana. "
            f"¡Te esperamos! 🙌\n\nSi no podés venir, avisanos así liberamos el lugar 🙏"
        )
    if tipo == TipoRecordatorio.frecuencia:
        return (
            f"{saludo}\n\nPasó un tiempo desde tu última visita a *{negocio.nombre}*. "
            f"¿Reservamos tu próximo turno? 👇\n{enlace}"
        )
    return (
        f"{saludo}\n\nLa última vez no pudiste venir a *{negocio.nombre}*. "
        f"Reagendá cuando quieras, te esperamos 👇\n{enlace}"
    )

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

            # Canales según la configuración del negocio.
            canal = negocio.recordatorios_canal or "email"
            puede_email = canal in ("email", "ambos") and es_email_enviable(cliente.email)
            puede_wa = (
                canal in ("whatsapp", "ambos")
                and bool(negocio.whatsapp_instancia)
                and bool(cliente.telefono)
            )
            # Si no hay ningún canal posible, cancelamos (no reintentar para siempre).
            if not puede_email and not puede_wa:
                rec.estado = EstadoRecordatorio.cancelado
                continue

            enlace = f"{settings.frontend_url}/{negocio.slug}"
            if rec.tipo == TipoRecordatorio.turno_proximo:
                asunto = f"Recordatorio de tu turno en {negocio.nombre}"
                titulo = "Te esperamos mañana"
                mensaje = "Este es un recordatorio de tu próximo turno. Si no podés asistir, avisanos con tiempo."
                boton = "Ver el negocio"
            elif rec.tipo == TipoRecordatorio.frecuencia:
                asunto = f"¿Reservamos tu próxima visita en {negocio.nombre}?"
                titulo = "¿Listo para volver?"
                mensaje = "Pasó un tiempo desde tu última visita. Reservá tu próximo turno cuando quieras."
                boton = "Reservar turno"
            else:  # inasistencia
                asunto = f"Te esperamos de nuevo en {negocio.nombre}"
                titulo = "Te extrañamos"
                mensaje = "La última vez no pudiste venir. Reagendá tu turno cuando te quede cómodo."
                boton = "Reservar turno"

            # Para los recordatorios de "volvé", agregamos un enlace de baja.
            baja_html = ""
            if rec.tipo in (TipoRecordatorio.frecuencia, TipoRecordatorio.inasistencia) and reserva:
                baja_url = f"{settings.frontend_url}/baja-recordatorios/{reserva.token_cancelacion}"
                baja_html = (
                    f'<p style="text-align:center;margin-top:18px;font-size:11px;color:#a3a3a3;">'
                    f'¿No querés recibir más estos recordatorios? '
                    f'<a href="{baja_url}" style="color:#a3a3a3;text-decoration:underline;">Darme de baja</a>'
                    f'</p>'
                )

            html = layout_html(
                negocio,
                f"""
                {_titulo(titulo)}
                {_parrafo(f"Hola {cliente.nombre}, {mensaje}")}
                <p style="text-align:center;">{_boton(boton, enlace)}</p>
                {baja_html}
                """,
            )
            enviado_algo = False
            # Email
            if puede_email:
                ok = _enviar_email(cliente.email, asunto, _cuerpo(rec, negocio, cliente), html)
                enviado_algo = enviado_algo or ok
                db.add(
                    NotificacionLog(
                        reserva_id=rec.reserva_id,
                        tipo=_TIPO_NOTIF[rec.tipo],
                        destinatario=cliente.email,
                        enviado_en=ahora if ok else None,
                        estado=EstadoNotificacion.enviado if ok else EstadoNotificacion.fallido,
                    )
                )
            # WhatsApp
            if puede_wa:
                texto_wa = _texto_wa_recordatorio(rec.tipo, negocio, cliente, enlace)
                ok_wa = enviar_whatsapp(negocio.whatsapp_instancia, cliente.telefono, texto_wa)
                enviado_algo = enviado_algo or ok_wa
                db.add(
                    NotificacionLog(
                        reserva_id=rec.reserva_id,
                        tipo=_TIPO_NOTIF[rec.tipo],
                        destinatario=cliente.telefono,
                        enviado_en=ahora if ok_wa else None,
                        estado=EstadoNotificacion.enviado if ok_wa else EstadoNotificacion.fallido,
                    )
                )

            rec.estado = (
                EstadoRecordatorio.enviado if enviado_algo else EstadoRecordatorio.pendiente
            )
            if enviado_algo:
                enviados += 1
        db.commit()
        return enviados
    finally:
        db.close()
