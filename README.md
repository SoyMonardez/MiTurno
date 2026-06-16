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

## Módulos Premium

El plan **Premium** habilita (ver `planificacion_miturno_premium.pdf`):

- **Panel individual del profesional**: cada barbero entra con su propia cuenta
  (`/profesional`) y ve solo SUS turnos, comisiones y la ficha técnica de sus
  clientes. El admin crea las credenciales desde Gestión → Profesionales.
- **Comisiones automáticas**: por profesional se configura `% por corte` o
  `fijo del local`. Al completar un turno se calcula el split y queda
  registrado en la reserva (junto al método de pago).
- **Ficha técnica del cliente**: historial de notas de estilo consultable por
  el profesional antes de cada servicio.
- **Lista de espera inteligente**: si un día está lleno, el cliente se anota
  desde la página pública; al cancelarse un turno se le ofrece el lugar por
  WhatsApp y puede confirmarlo respondiendo **SÍ**.
- **Bot de WhatsApp 24 hs**: filtro de intenciones por RegEx (dirección,
  precios, horarios = respuesta instantánea gratis) y consultas libres con
  **Groq** (Llama 3). Webhook: `POST /webhook/whatsapp`.
- **Reporte de caja diaria**: arqueo por método de pago (efectivo /
  transferencia / Mercado Pago) con gráfico de torta en Reportes.
- **Horas muertas**: ocupación promedio por día y bloque; si baja del 20 %
  sugiere activar un descuento en esa franja.
- **PWA**: la web se instala como app en el celular (botón "Descargar App"),
  con actualizaciones automáticas. `manifest.json` + `service-worker.js`.

### WhatsApp Gateway (Evolution API)

```bash
# 1. Crear la base para Evolution (una sola vez)
docker compose exec db psql -U miturno -c "CREATE DATABASE evolution;"

# 2. Levantar el gateway
docker compose --profile whatsapp up -d evolution

# 3. Crear la instancia y escanear el QR en http://localhost:8080/manager
#    (API key = EVOLUTION_API_KEY del .env)

# 4. En el panel admin → Gestión → Negocio, cargar el nombre de la instancia.
```

Variables de entorno nuevas (`.env`): `EVOLUTION_API_URL` (ej:
`http://evolution:8080`), `EVOLUTION_API_KEY`, `GROQ_API_KEY`.

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
