# MiTurno

Sistema de turnos web SaaS multi-negocio. FastAPI + React + PostgreSQL.

## Requisitos

- Docker + Docker Compose

## Levantar el entorno

```bash
cp .env.example .env
docker compose up --build
```

Servicios:

- Frontend: http://localhost:5173
- API (docs): http://localhost:8000/docs
- API health: http://localhost:8000/health
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Estructura

```
miturno/
├── backend/          # API FastAPI
│   └── app/
│       ├── main.py
│       ├── core/     # config
│       ├── db/       # sesión SQLAlchemy
│       ├── models/   # modelos
│       ├── schemas/  # Pydantic
│       ├── api/      # routers
│       ├── services/ # lógica de negocio
│       └── workers/  # tareas Celery
├── frontend/         # SPA React + Vite + Tailwind
└── docker-compose.yml
```
