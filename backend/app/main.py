from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import catalogo, disponibilidad, negocios, profesionales, reservas
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(negocios.router)
app.include_router(catalogo.router)
app.include_router(profesionales.router)
app.include_router(disponibilidad.router)
app.include_router(reservas.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
