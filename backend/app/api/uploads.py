import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile

from app.api.auth import get_current_admin
from app.models.negocio import Usuario

router = APIRouter(prefix="/admin", tags=["uploads"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

EXTENSIONES_OK = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/upload")
async def subir_imagen(
    request: Request,
    file: UploadFile,
    admin: Usuario = Depends(get_current_admin),
) -> dict:
    if file.content_type not in EXTENSIONES_OK:
        raise HTTPException(400, "Formato no permitido. Usá JPG, PNG, WEBP o GIF.")

    contenido = await file.read()
    if len(contenido) > MAX_BYTES:
        raise HTTPException(400, "La imagen supera los 5 MB.")

    ext = EXTENSIONES_OK[file.content_type]
    nombre = f"{secrets.token_hex(16)}{ext}"
    destino = UPLOAD_DIR / nombre
    destino.write_bytes(contenido)

    # URL absoluta para que el frontend pueda mostrarla directo
    base = str(request.base_url).rstrip("/")
    return {"url": f"{base}/uploads/{nombre}"}
