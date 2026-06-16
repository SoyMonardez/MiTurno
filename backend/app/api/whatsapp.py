"""Webhook de WhatsApp: recibe los eventos de Evolution API y responde
mediante el bot híbrido (filtro estático + Groq) en segundo plano."""
from fastapi import APIRouter, BackgroundTasks, Request
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.negocio import Negocio
from app.services.bot_whatsapp import procesar_mensaje
from app.services.whatsapp import enviar_whatsapp, resolver_lid_a_telefono

router = APIRouter(prefix="/webhook", tags=["whatsapp"])

# Deduplicación: Evolution puede entregar el mismo mensaje más de una vez
# (webhook global + por instancia, reintentos, etc.). Guardamos los IDs
# recientes para responder una sola vez por mensaje.
_MSG_VISTOS: dict[str, float] = {}
_DEDUP_VENTANA_SEG = 120


def _ya_procesado(msg_id: str | None) -> bool:
    """True si este mensaje ya se procesó hace poco (evita respuestas dobles)."""
    if not msg_id:
        return False
    import time

    ahora = time.time()
    # Limpieza de IDs viejos para no crecer sin límite.
    for k in [k for k, t in _MSG_VISTOS.items() if ahora - t > _DEDUP_VENTANA_SEG]:
        _MSG_VISTOS.pop(k, None)
    if msg_id in _MSG_VISTOS:
        return True
    _MSG_VISTOS[msg_id] = ahora
    return False


def _extraer_mensaje(payload: dict) -> tuple[str | None, str | None, str | None]:
    """Devuelve (instancia, remote_jid, texto) desde el evento de Evolution API.

    Devolvemos el JID completo (puede ser `<num>@s.whatsapp.net` o `<id>@lid`);
    la resolución a teléfono real se hace en segundo plano (necesita red).
    """
    instancia = payload.get("instance") or payload.get("instanceName")
    data = payload.get("data") or {}
    key = data.get("key") or {}

    # Ignoramos mensajes salientes (enviados por el propio bot).
    if key.get("fromMe"):
        return instancia, None, None

    remote_jid = key.get("remoteJid") or ""
    if remote_jid.endswith("@g.us"):  # grupos: no respondemos
        return instancia, None, None

    message = data.get("message") or {}
    texto = (
        message.get("conversation")
        or (message.get("extendedTextMessage") or {}).get("text")
        or ""
    ).strip()
    return instancia, remote_jid or None, texto or None


def _responder(instancia: str, remote_jid: str, texto: str) -> None:
    """Tarea en segundo plano: resuelve el teléfono, procesa y envía la respuesta."""
    db = SessionLocal()
    db.info["bypass_rls"] = True
    try:
        negocio = db.scalar(
            select(Negocio).where(
                Negocio.whatsapp_instancia == instancia, Negocio.activo
            )
        )
        if not negocio or (negocio.plan or "pro") != "premium":
            return

        # WhatsApp puede mandar un @lid (id de privacidad) en vez del teléfono.
        # En ese caso lo resolvemos al número real antes de responder.
        if remote_jid.endswith("@lid"):
            telefono = resolver_lid_a_telefono(instancia, remote_jid)
            if not telefono:
                print(f"[WEBHOOK WHATSAPP] no pude resolver el @lid {remote_jid}", flush=True)
                return
        else:
            telefono = remote_jid.split("@")[0]

        respuesta = procesar_mensaje(negocio, telefono, texto, db)
        if respuesta:
            enviar_whatsapp(instancia, telefono, respuesta)
    except Exception as exc:
        print(f"[WEBHOOK WHATSAPP ERROR] {exc}", flush=True)
    finally:
        db.close()


@router.post("/whatsapp")
async def webhook_whatsapp(request: Request, background: BackgroundTasks) -> dict:
    """Evolution API dispara un POST por cada mensaje entrante."""
    try:
        payload = await request.json()
    except Exception:
        return {"ok": False}

    # Evolution envía varios tipos de evento; solo nos interesan los mensajes.
    evento = (payload.get("event") or "").lower()
    if evento and evento not in ("messages.upsert", "messages_upsert"):
        return {"ok": True}

    # Deduplicamos por ID de mensaje: si ya lo vimos, no respondemos de nuevo.
    msg_id = ((payload.get("data") or {}).get("key") or {}).get("id")
    if _ya_procesado(msg_id):
        return {"ok": True}

    instancia, remote_jid, texto = _extraer_mensaje(payload)
    if instancia and remote_jid and texto:
        # Respondemos rápido el webhook y procesamos en segundo plano.
        background.add_task(_responder, instancia, remote_jid, texto)
    return {"ok": True}
