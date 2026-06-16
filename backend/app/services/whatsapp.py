"""Envío de mensajes de WhatsApp a través de Evolution API (auto-hospedada).

Si EVOLUTION_API_URL no está configurada, los mensajes se imprimen en consola
para poder desarrollar sin el gateway levantado.
"""
import re

import httpx

from app.core.config import settings


def normalizar_telefono(telefono: str) -> str:
    """Deja solo dígitos (Evolution espera el número sin '+' ni espacios)."""
    return re.sub(r"[^0-9]", "", telefono or "")


# Cache en memoria de resolución @lid -> teléfono real (estable por contacto).
_LID_CACHE: dict[str, str] = {}


def resolver_lid_a_telefono(instancia: str | None, lid_jid: str) -> str | None:
    """Resuelve un identificador de privacidad @lid de WhatsApp al teléfono real.

    WhatsApp ahora entrega `<id>@lid` en vez del número. Evolution no mapea ese
    @lid al teléfono, pero en su store de contactos quedan dos registros (el @lid
    y el del teléfono real) que comparten la misma foto de perfil. Matcheamos por
    foto (y como respaldo, por nombre único) para obtener el número al que responder.
    """
    if not settings.evolution_api_url or not instancia:
        return None
    if lid_jid in _LID_CACHE:
        return _LID_CACHE[lid_jid]

    base = settings.evolution_api_url.rstrip("/")
    headers = {"apikey": settings.evolution_api_key, "Content-Type": "application/json"}
    try:
        resp = httpx.post(
            f"{base}/chat/findContacts/{instancia}", headers=headers, json={}, timeout=15
        )
        resp.raise_for_status()
        contactos = resp.json()
    except Exception as exc:
        print(f"[LID RESOLVE ERROR] {exc}", flush=True)
        return None
    if not isinstance(contactos, list):
        return None

    def _pic(c: dict) -> str:
        return (c.get("profilePicUrl") or "").split("?")[0]

    lid_c = next((c for c in contactos if c.get("remoteJid") == lid_jid), None)
    if not lid_c:
        return None
    pic = _pic(lid_c)
    nombre = lid_c.get("pushName")

    telefonos = [
        c.get("remoteJid", "").split("@")[0]
        for c in contactos
        if c.get("remoteJid", "").endswith("@s.whatsapp.net")
    ]
    # 1) Match por foto de perfil (lo más confiable).
    if pic:
        for c in contactos:
            if c.get("remoteJid", "").endswith("@s.whatsapp.net") and _pic(c) == pic:
                tel = c["remoteJid"].split("@")[0]
                _LID_CACHE[lid_jid] = tel
                return tel
    # 2) Respaldo: nombre único entre los contactos con teléfono real.
    if nombre:
        candidatos = [
            c["remoteJid"].split("@")[0]
            for c in contactos
            if c.get("remoteJid", "").endswith("@s.whatsapp.net")
            and c.get("pushName") == nombre
        ]
        if len(candidatos) == 1:
            _LID_CACHE[lid_jid] = candidatos[0]
            return candidatos[0]
    return None


def enviar_whatsapp(instancia: str | None, telefono: str, texto: str) -> bool:
    """Envía un texto por WhatsApp. Devuelve True si se entregó al gateway."""
    numero = normalizar_telefono(telefono)
    if not numero:
        return False

    if not settings.evolution_api_url or not instancia:
        print(f"[WHATSAPP DEV] instancia={instancia} para={numero}: {texto}", flush=True)
        return True

    url = f"{settings.evolution_api_url.rstrip('/')}/message/sendText/{instancia}"
    try:
        resp = httpx.post(
            url,
            headers={"apikey": settings.evolution_api_key},
            json={"number": numero, "text": texto},
            timeout=15,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        print(f"[WHATSAPP ERROR] {exc}", flush=True)
        return False
