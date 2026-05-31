from pathlib import Path

from fastapi import FastAPI, Request
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
    superadmin,
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


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    # Cabeceras básicas de seguridad
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"

    # Content Security Policy (CSP)
    # Si es ruta de documentación, permitimos jsdelivr para recursos de Swagger UI.
    if path in ("/docs", "/redoc", "/openapi.json"):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "connect-src 'self';"
        )
    else:
        # CSP estricto para APIs
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; sandbox;"

    # Permissions Policy
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    )

    return response


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
app.include_router(superadmin.router)
app.include_router(seo.router)

# Archivos subidos (imágenes de servicios / profesionales)
Path("uploads").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
