# MiTurno

SaaS propio de gestión de turnos para negocios de servicios (barberías, peluquerías, profesionales independientes). Multi-tenant: un solo sistema atiende a múltiples negocios, cada uno con sus propios datos aislados (RLS forzado en PostgreSQL).

**Demo en vivo:** [miturno.alejomonardez.com/miturno](https://miturno.alejomonardez.com/miturno)

En mi [portafolio personal](https://alejomonardez.com) están las demos del resto de mis proyectos.

## El problema

Los negocios chicos de servicios suelen agendar turnos a mano: WhatsApp, agenda de papel o planillas sueltas. Eso trae problemas conocidos: dobles reservas, clientes que no se enteran de una cancelación, nadie que avise un recordatorio, y cero visibilidad sobre cuánto factura cada empleado o qué horarios quedan vacíos.

## La solución

Una plataforma que el negocio puede usar de punta a punta sin depender de un técnico:

- **Reservas online + panel admin**: el cliente reserva solo desde una página pública; el negocio gestiona disponibilidad, profesionales, servicios y categorías.
- **Bot de WhatsApp 24/7** (Evolution API + IA con Groq/Llama): agenda turnos por chat de forma conversacional, responde precios/horarios/dirección al instante, detecta quejas y las deriva, y reconoce al cliente por su historial. Responde solo con datos reales del negocio (base de conocimiento propia + reglas anti-alucinación), nunca inventa información.
- **Recordatorios automáticos** por email o WhatsApp (turno próximo, frecuencia, inasistencia), para bajar el ausentismo.
- **Lista de espera inteligente**: si un día está lleno, ofrece el lugar automáticamente por WhatsApp cuando se libera un turno.
- **Plan Premium con panel individual por profesional**: cada empleado ve solo sus turnos, su comisión (% o fijo) y el historial de cada cliente, sin acceso a la caja completa del negocio.
- **Reportes**: caja diaria por método de pago, horas muertas por franja horaria, rendimiento por profesional.
- **Segmentación de clientes** (nuevo/regular/fiel/en riesgo) para que el negocio sepa a quién recontactar.
- **PWA**: se instala como app en el celular, tanto para el negocio como para sus profesionales.

## Flujo de uso

1. El negocio se da de alta y configura sus servicios, profesionales y horarios desde el panel admin.
2. El cliente reserva un turno desde la página pública o escribiendo directo por WhatsApp ("quiero un turno para corte el viernes a las 16").
3. El bot agenda la reserva conversando, valida disponibilidad y confirma con el nombre del cliente.
4. El sistema manda recordatorios automáticos antes del turno (email o WhatsApp).
5. Si el cliente no puede ir, cancela y el cupo se ofrece automáticamente al primero en la lista de espera.
6. Al finalizar el servicio, el profesional marca la asistencia y el método de pago; el sistema calcula la comisión y la registra en la caja del día.
7. El negocio revisa reportes (caja diaria, horas muertas, rendimiento por profesional) y decide ajustes desde el panel, sin tocar código.

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
