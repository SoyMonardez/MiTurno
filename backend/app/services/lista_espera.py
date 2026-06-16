"""Lista de espera inteligente (plan Premium).

Cuando se cancela un turno, se busca al primer anotado de la cola para ese
día y bloque horario y se le ofrece el lugar por WhatsApp. Si responde "SÍ",
se crea la reserva oficial y se lo da de baja de la cola.
"""
import secrets
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import BloqueHorario, EstadoListaEspera, EstadoReserva
from app.models.negocio import Negocio
from app.models.premium import ListaEspera
from app.models.profesional import Profesional
from app.models.reserva import Reserva
from app.services.whatsapp import enviar_whatsapp, normalizar_telefono


def _bloque_de(inicio_local: datetime) -> BloqueHorario:
    return BloqueHorario.manana if inicio_local.hour < 13 else BloqueHorario.tarde


def expirar_ofertas_vencidas(negocio_id: int, db: Session) -> None:
    """Las ofertas no respondidas vuelven a liberar el turno para el siguiente."""
    limite = datetime.now(ZoneInfo("UTC")) - timedelta(
        hours=settings.lista_espera_oferta_horas
    )
    vencidas = db.scalars(
        select(ListaEspera).where(
            ListaEspera.negocio_id == negocio_id,
            ListaEspera.estado == EstadoListaEspera.notificado,
            ListaEspera.notificado_en < limite,
        )
    )
    for registro in vencidas:
        registro.estado = EstadoListaEspera.expirado


def ofrecer_turno_liberado(reserva: Reserva, db: Session) -> None:
    """Ofrece el horario de una reserva recién cancelada al primero de la cola.

    Se llama después del commit de la cancelación; maneja su propio commit.
    La cancelación puede venir de un cliente (token) sin permisos sobre la
    tabla lista_espera, por eso operamos con bypass de RLS.
    """
    bypass_previo = db.info.get("bypass_rls", True)
    db.info["bypass_rls"] = True
    try:
        _ofrecer_turno_liberado(reserva, db)
    finally:
        db.info["bypass_rls"] = bypass_previo


def _ofrecer_turno_liberado(reserva: Reserva, db: Session) -> None:
    negocio = db.get(Negocio, reserva.negocio_id)
    if not negocio or (negocio.plan or "pro") != "premium":
        return

    tz = ZoneInfo(negocio.zona_horaria)
    inicio_local = reserva.inicio.astimezone(tz)
    if inicio_local < datetime.now(tz):
        return  # el turno cancelado ya pasó, no hay nada que ofrecer

    expirar_ofertas_vencidas(negocio.id, db)

    bloque = _bloque_de(inicio_local)
    candidato = db.scalar(
        select(ListaEspera)
        .where(
            ListaEspera.negocio_id == negocio.id,
            ListaEspera.estado == EstadoListaEspera.pendiente,
            ListaEspera.fecha == inicio_local.date(),
            ListaEspera.bloque == bloque,
        )
        .order_by(ListaEspera.creado_en)
        .limit(1)
    )
    if not candidato:
        db.commit()
        return

    candidato.estado = EstadoListaEspera.notificado
    candidato.oferta_inicio = reserva.inicio
    candidato.oferta_profesional_id = reserva.profesional_id
    candidato.notificado_en = datetime.now(ZoneInfo("UTC"))
    db.commit()

    hora = inicio_local.strftime("%H:%M")
    fecha = inicio_local.strftime("%d/%m")
    enviar_whatsapp(
        negocio.whatsapp_instancia,
        candidato.telefono,
        f"¡Hola {candidato.nombre}! Se liberó un espacio para el {fecha} a las "
        f"{hora} hs en {negocio.nombre}. Si querés reservarlo, respondé la "
        f"palabra SÍ a este mensaje de inmediato.",
    )


def confirmar_oferta_por_telefono(negocio: Negocio, telefono: str, db: Session) -> str | None:
    """Procesa el "SÍ" de un cliente notificado: crea la reserva y responde.

    Devuelve el texto de respuesta para WhatsApp, o None si el teléfono no
    tiene ninguna oferta activa.
    """
    numero = normalizar_telefono(telefono)
    registros = db.scalars(
        select(ListaEspera).where(
            ListaEspera.negocio_id == negocio.id,
            ListaEspera.estado == EstadoListaEspera.notificado,
        )
    )
    registro = next(
        (r for r in registros if normalizar_telefono(r.telefono) == numero), None
    )
    if not registro or not registro.oferta_inicio:
        return None

    if datetime.now(ZoneInfo("UTC")) - registro.notificado_en > timedelta(
        hours=settings.lista_espera_oferta_horas
    ):
        registro.estado = EstadoListaEspera.expirado
        db.commit()
        return (
            "Lo sentimos, la oferta de ese turno ya venció. "
            "Te avisaremos si se libera otro lugar."
        )

    # Verificamos que el slot siga libre antes de crear la reserva.
    ocupado = db.scalar(
        select(Reserva.id).where(
            Reserva.profesional_id == registro.oferta_profesional_id,
            Reserva.estado == EstadoReserva.confirmada,
            Reserva.inicio == registro.oferta_inicio,
        )
    )
    if ocupado:
        registro.estado = EstadoListaEspera.expirado
        db.commit()
        return (
            "Lo sentimos, ese turno acaba de ser tomado por otra persona. "
            "Te avisaremos si se libera otro lugar."
        )

    from app.services.reservas import _upsert_cliente_admin

    inicio = registro.oferta_inicio
    cliente = _upsert_cliente_admin(
        negocio.id, registro.nombre, registro.telefono, None, inicio, db
    )
    profesional = db.get(Profesional, registro.oferta_profesional_id)
    # Duración estándar de 30 min: la reserva se creó sin servicios elegidos,
    # el local ajusta el detalle al recibir al cliente.
    reserva = Reserva(
        negocio_id=negocio.id,
        cliente_id=cliente.id,
        profesional_id=registro.oferta_profesional_id,
        estado=EstadoReserva.confirmada,
        total_precio=0,
        total_duracion=30,
        inicio=inicio,
        fin=inicio + timedelta(minutes=30),
        token_cancelacion=secrets.token_urlsafe(24),
        notas="Reserva creada automáticamente desde la lista de espera (WhatsApp)",
    )
    db.add(reserva)
    registro.estado = EstadoListaEspera.confirmado
    db.commit()

    tz = ZoneInfo(negocio.zona_horaria)
    hora = inicio.astimezone(tz).strftime("%H:%M")
    nombre_prof = profesional.nombre if profesional else "el equipo"
    return (
        f"¡Listo, {registro.nombre}! Tu turno quedó confirmado para las {hora} hs "
        f"con {nombre_prof} en {negocio.nombre}. Te esperamos."
    )
