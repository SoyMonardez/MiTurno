"""Gestión de instancias de Evolution API.

Permite que cada negocio conecte su propio WhatsApp desde su panel de MiTurno
(crear instancia, obtener el QR, ver el estado, desconectar) sin necesidad de
acceder al Evolution Manager. La plataforma usa la API key a nivel sistema.
"""
import httpx

from app.core.config import settings


def disponible() -> bool:
    return bool(settings.evolution_api_url and settings.evolution_api_key)


def _base() -> str:
    return settings.evolution_api_url.rstrip("/")


def _headers() -> dict:
    return {"apikey": settings.evolution_api_key, "Content-Type": "application/json"}


def asegurar_instancia(nombre: str) -> None:
    """Crea la instancia si no existe y le configura el webhook hacia el backend.

    Idempotente: si ya existe, Evolution responde 403/409 y lo ignoramos.
    """
    try:
        httpx.post(
            f"{_base()}/instance/create",
            headers=_headers(),
            json={"instanceName": nombre, "integration": "WHATSAPP-BAILEYS", "qrcode": True},
            timeout=20,
        )
    except Exception as exc:
        print(f"[EVOLUTION] crear instancia {nombre}: {exc}", flush=True)
    # Webhook por instancia (la deduplicación del backend evita respuestas dobles).
    try:
        httpx.post(
            f"{_base()}/webhook/set/{nombre}",
            headers=_headers(),
            json={
                "webhook": {
                    "enabled": True,
                    "url": settings.evolution_webhook_url,
                    "webhookByEvents": False,
                    "events": ["MESSAGES_UPSERT"],
                }
            },
            timeout=20,
        )
    except Exception as exc:
        print(f"[EVOLUTION] set webhook {nombre}: {exc}", flush=True)


def estado(nombre: str) -> str:
    """Devuelve 'open' | 'connecting' | 'close' | 'sin_instancia'."""
    try:
        r = httpx.get(
            f"{_base()}/instance/connectionState/{nombre}", headers=_headers(), timeout=15
        )
        if r.status_code == 404:
            return "sin_instancia"
        r.raise_for_status()
        return (r.json().get("instance") or {}).get("state") or "close"
    except Exception as exc:
        print(f"[EVOLUTION] estado {nombre}: {exc}", flush=True)
        return "sin_instancia"


def obtener_qr(nombre: str) -> str | None:
    """Devuelve el QR como data-URI base64 para mostrar en el panel, o None."""
    try:
        r = httpx.get(
            f"{_base()}/instance/connect/{nombre}", headers=_headers(), timeout=20
        )
        r.raise_for_status()
        b64 = r.json().get("base64")
        if not b64:
            return None
        # Evolution a veces devuelve el base64 sin el prefijo data-URI.
        return b64 if b64.startswith("data:") else f"data:image/png;base64,{b64}"
    except Exception as exc:
        print(f"[EVOLUTION] qr {nombre}: {exc}", flush=True)
        return None


def desconectar(nombre: str) -> None:
    """Cierra la sesión de WhatsApp de la instancia (no la elimina)."""
    try:
        httpx.delete(f"{_base()}/instance/logout/{nombre}", headers=_headers(), timeout=20)
    except Exception as exc:
        print(f"[EVOLUTION] logout {nombre}: {exc}", flush=True)
