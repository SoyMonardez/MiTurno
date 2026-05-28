import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import jwt

from app.core.config import settings

_ITERACIONES = 200_000


def hash_password(password: str) -> str:
    """Hashea con PBKDF2-HMAC-SHA256 (stdlib, sin dependencias nativas)."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITERACIONES)
    return f"pbkdf2_sha256${_ITERACIONES}${salt}${dk.hex()}"


def verify_password(password: str, almacenado: str) -> bool:
    try:
        _algo, iteraciones, salt, hash_hex = almacenado.split("$")
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(iteraciones)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False


def crear_token(usuario_id: int, negocio_id: int | None) -> str:
    ahora = datetime.now(ZoneInfo("UTC"))
    payload = {
        "sub": str(usuario_id),
        "negocio_id": negocio_id,
        "exp": ahora + timedelta(minutes=settings.token_exp_minutes),
        "iat": ahora,
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decodificar_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
