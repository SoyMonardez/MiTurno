from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import crear_token, decodificar_token, verify_password
from app.models.enums import RolUsuario
from app.models.negocio import RegistroAcceso, Usuario

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=True)


class LoginRequest(BaseModel):
    username: str
    dni: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    nombre: str
    negocio_id: int | None
    rol: RolUsuario


@router.post("/login", response_model=TokenOut)
def login(data: LoginRequest, db: Session = Depends(get_db)) -> TokenOut:
    # Limpiamos espacios y caracteres invisibles para que el login no sea sensible a ellos.
    username = data.username.strip()
    dni = data.dni.strip()
    password = data.password.strip()

    usuario = db.scalar(select(Usuario).where(Usuario.username == username))
    credenciales_ok = (
        usuario is not None
        and usuario.activo
        and usuario.password_hash is not None
        and usuario.dni == dni
        and verify_password(password, usuario.password_hash)
    )
    if not credenciales_ok:
        raise HTTPException(401, "Usuario, DNI o contraseña incorrectos")

    usuario.ultimo_login_en = datetime.now(ZoneInfo("UTC"))
    db.add(RegistroAcceso(usuario_id=usuario.id, negocio_id=usuario.negocio_id))
    db.commit()

    return TokenOut(
        access_token=crear_token(usuario.id, usuario.negocio_id),
        nombre=usuario.nombre,
        negocio_id=usuario.negocio_id,
        rol=usuario.rol,
    )


def get_current_admin(
    cred: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    try:
        payload = decodificar_token(cred.credentials)
        usuario_id = int(payload["sub"])
    except Exception:
        raise HTTPException(401, "Token inválido o expirado")

    usuario = db.get(Usuario, usuario_id)
    if not usuario or not usuario.activo:
        raise HTTPException(401, "Usuario no válido")
    if usuario.rol not in (RolUsuario.admin, RolUsuario.super_admin):
        raise HTTPException(403, "Se requiere rol de administrador")
    return usuario


def get_current_super_admin(
    cred: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    try:
        payload = decodificar_token(cred.credentials)
        usuario_id = int(payload["sub"])
    except Exception:
        raise HTTPException(401, "Token inválido o expirado")

    usuario = db.get(Usuario, usuario_id)
    if not usuario or not usuario.activo:
        raise HTTPException(401, "Usuario no válido")
    if usuario.rol != RolUsuario.super_admin:
        raise HTTPException(403, "Se requiere rol de super-admin")
    return usuario
