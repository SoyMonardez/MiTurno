from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import (
    admin,
    auth,
    catalogo,
    disponibilidad,
    negocios,
    portafolio,
    profesionales,
    resenas,
    reservas,
    seo,
    uploads,
)
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(negocios.router)
app.include_router(catalogo.router)
app.include_router(profesionales.router)
app.include_router(disponibilidad.router)
app.include_router(reservas.router)
app.include_router(resenas.router)
app.include_router(portafolio.router)
app.include_router(admin.router)
app.include_router(uploads.router)
app.include_router(seo.router)

# Archivos subidos (imágenes de servicios / profesionales)
Path("uploads").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
