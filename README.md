# MiTurno

SaaS propio de gestión de turnos para negocios de servicios (barberías, peluquerías, profesionales independientes). Multi-tenant: un solo sistema atiende a múltiples negocios, cada uno con sus propios datos aislados (RLS forzado en PostgreSQL).

## El problema

Los negocios chicos de servicios suelen agendar turnos a mano: WhatsApp, agenda de papel o planillas sueltas. Eso trae problemas conocidos: dobles reservas, clientes que no se enteran de una cancelación, nadie que avise un recordatorio, y cero visibilidad sobre cuánto factura cada empleado o qué horarios quedan vacíos.

## La solución

Una plataforma que el negocio puede usar de punta a punta sin depender de un técnico:

- **Reservas online + panel admin**: el cliente reserva solo desde una página pública; el negocio gestiona disponibilidad, profesionales, servicios y categorías.
- **Bot de WhatsApp 24/7** (Evolution API + IA con Groq/Llama): agenda turnos por chat de forma conversacional, responde precios/horarios/dirección al instante, detecta quejas y las deriva, y reconoce al cliente por su historial. Anti-alucinación: solo responde con datos reales del negocio (sin RAG con vectores — innecesario para el volumen de datos de una PyME).
- **Recordatorios automáticos** por email o WhatsApp (turno próximo, frecuencia, inasistencia), para bajar el ausentismo.
- **Lista de espera inteligente**: si un día está lleno, ofrece el lugar automáticamente por WhatsApp cuando se libera un turno.
- **Plan Premium con panel individual por profesional**: cada empleado ve solo sus turnos, su comisión (% o fijo) y el historial de cada cliente, sin acceso a la caja completa del negocio.
- **Reportes**: caja diaria por método de pago, horas muertas por franja horaria, rendimiento por profesional.
- **Segmentación de clientes** (nuevo/regular/fiel/en riesgo) para que el negocio sepa a quién recontactar.
- **PWA**: se instala como app en el celular, tanto para el negocio como para sus profesionales.

## Impacto

- Le da a un negocio chico una herramienta de gestión que normalmente solo tienen cadenas grandes, sin costo de desarrollo propio.
- El bot de WhatsApp reemplaza la atención manual de consultas repetitivas, liberando tiempo real del dueño o recepcionista.
- Los recordatorios y la lista de espera reducen turnos perdidos por inasistencia o cancelación tardía.
- Las comisiones automáticas y los reportes le dan al dueño visibilidad que antes le llevaba horas de planilla.

## Stack

- **Backend:** FastAPI (Python) + PostgreSQL + Celery/Redis (recordatorios y tareas en segundo plano)
- **Frontend:** React + Vite + Tailwind (SPA)
- **IA:** Groq (Llama 3) para el bot conversacional
- **WhatsApp:** Evolution API (self-hosted) — cada negocio conecta su propio número escaneando un QR desde su panel
- **Infraestructura:** Docker Compose

## Levantar el entorno

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- API (docs): http://localhost:8000/docs
- API health: http://localhost:8000/health

### WhatsApp Gateway (Evolution API)

```bash
docker compose exec db psql -U miturno -c "CREATE DATABASE evolution;"
docker compose --profile whatsapp up -d evolution
```

Escanear el QR en `http://localhost:8080/manager` (API key = `EVOLUTION_API_KEY` del `.env`) y cargar el nombre de la instancia en el panel admin → Gestión → Negocio.

Variables nuevas en `.env`: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `GROQ_API_KEY`.

## Estructura

```
miturno/
├── backend/          # API FastAPI
│   └── app/
│       ├── core/      # config y reglas de negocio (planes, etc.)
│       ├── db/        # sesión SQLAlchemy
│       ├── models/    # modelos
│       ├── schemas/   # Pydantic
│       ├── api/       # routers
│       ├── services/  # lógica de negocio (bot, comisiones, etc.)
│       └── workers/   # tareas Celery
├── frontend/         # SPA React + Vite + Tailwind
└── docker-compose.yml
```

---

Proyecto propio (SaaS), desarrollado de punta a punta: arquitectura multi-tenant, backend, frontend, bot de WhatsApp con IA y despliegue.
