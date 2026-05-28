# MiTurno — Plan del Sistema (versión final)

Sistema de turnos web, tipo SaaS multi-negocio, responsive para PC y celular.
Este documento es la guía completa para construir el proyecto. Pensado para un equipo de 2 personas.

---

## 1. Resumen del proyecto

MiTurno es una plataforma donde cada negocio tiene su propia página pública de reservas. Un cliente entra, elige uno o varios servicios, elige un profesional (o "cualquiera"), elige fecha y horario, y confirma. La reserva se registra en un panel de administración y se envían correos de confirmación por Gmail al cliente y al admin. Además incluye reseñas, recordatorios de rebooking y segmentación de clientes.

---

## 2. Decisiones definitivas

| Tema | Decisión |
|---|---|
| Alcance | SaaS: varios negocios sobre la misma plataforma |
| Reserva del cliente | Sin registro obligatorio; opcional login con Google |
| Pagos | No se cobra online, pero sí se muestran precios |
| Servicios por turno | Varios servicios en una misma reserva (carrito) |
| Profesional | Un único profesional por reserva, aunque tenga varios servicios |
| Datos del cliente | Antes de confirmar: nombre, teléfono y email obligatorios |
| Reseñas | Sistema completo: del negocio y de cada profesional |
| Profesionales (acceso) | No tienen login; son registros que gestiona el admin |
| Confirmación | Automática: la reserva queda confirmada al instante |
| Cancelación | Cliente y admin pueden cancelar; mínimo 20 min de anticipación |
| Recordatorios | Por frecuencia elegida por el cliente y por inasistencia |
| Segmentación | El admin ve clientes nuevos, regulares, fieles y en riesgo |
| Notificación por Gmail | Confirmación al admin y al cliente |
| Onboarding de negocios | Solo el super-admin da de alta los negocios |
| Diseño | Unificado; branding por negocio se evalúa más adelante |
| Stack | FastAPI (Python) + React, PostgreSQL, desplegado en VPS de 16 GB |

---

## 3. Arquitectura general

Modelo **multi-tenant con base de datos compartida**: una sola DB, cada registro lleva un `negocio_id` que aísla los datos de cada negocio.

```
Navegador (React SPA)
        │  HTTPS
        ▼
   Nginx (reverse proxy + sirve el frontend estático)
        │
        ▼
   API Backend (FastAPI)  ──►  PostgreSQL
        │                ──►  Redis (cache + cola de tareas)
        ▼
   Worker + Scheduler (emails y recordatorios programados)
        │
        ▼
   Gmail API
```

Cada negocio tiene su URL pública: `miturno.com/nombre-del-negocio`.

---

## 4. Roles y permisos

| Rol | Qué puede hacer |
|---|---|
| **Cliente** | Reservar, cancelar su propia reserva (hasta 20 min antes), dejar reseña |
| **Profesional** | No accede al sistema; es un registro administrado por el admin |
| **Admin del negocio** | Gestiona servicios, categorías, profesionales, horarios, portafolio; ve y cancela turnos; marca asistencia; ve reseñas y clientes con su segmento |
| **Super-admin** | Da de alta los negocios y sus admins; ve métricas globales |

---

## 5. Modelo de datos

**Negocio** — `id`, `nombre`, `slug`, `descripcion`, `direccion`, `zona_horaria`, `email_notificaciones`, `logo`, `redes`, `activo`

**Usuario** — `id`, `negocio_id` (nulo para clientes/super-admin), `email`, `nombre`, `telefono`, `rol`, `google_id` (nulo)

**Categoria** — `id`, `negocio_id`, `nombre`, `orden`

**Servicio** — `id`, `negocio_id`, `categoria_id`, `nombre`, `descripcion`, `duracion_min`, `buffer_min`, `precio`, `imagen`, `badge` (`ninguno`/`recomendado`/`popular`/`nuevo`), `activo`

**Profesional** — `id`, `negocio_id`, `nombre`, `foto`, `bio`, `calificacion_promedio` (calculada)

**ProfesionalServicio** — relación N:N: qué servicios ofrece cada profesional

**HorarioRecurrente** — `id`, `profesional_id`, `dia_semana`, `hora_inicio`, `hora_fin`

**ExcepcionAgenda** — `id`, `profesional_id`, `fecha`, `tipo` (`no_disponible`/`horario_especial`), `hora_inicio`, `hora_fin`

**Cliente** — `id`, `negocio_id`, `nombre`, `email`, `telefono`, `usuario_id` (nulo si reservó como invitado), `turnos_completados`, `turnos_cancelados`, `no_shows`, `primera_visita`, `ultima_visita`, `segmento` (`nuevo`/`regular`/`fiel`/`en_riesgo`). Se identifica por email dentro de cada negocio; se crea o actualiza en cada reserva.

**Reserva** — `id`, `negocio_id`, `cliente_id`, `profesional_id`, `estado`, `total_precio`, `total_duracion`, `inicio`, `fin`, `frecuencia_recordatorio_dias` (nulo si no quiere), `token_cancelacion`, `notas`, `creado_en`

**ReservaItem** — `id`, `reserva_id`, `servicio_id`, `orden`. Los servicios del carrito; todos comparten el profesional y el horario de la reserva.

**Resena** — `id`, `negocio_id`, `reserva_id`, `profesional_id` (nulo si es solo del negocio), `cliente_id`, `puntuacion` (1–5), `comentario`, `creado_en`

**PortafolioImagen** — `id`, `negocio_id`, `url`, `orden`

**RecordatorioProgramado** — `id`, `reserva_id`, `cliente_id`, `tipo` (`frecuencia`/`inasistencia`), `enviar_en`, `estado` (`pendiente`/`enviado`/`cancelado`)

**NotificacionLog** — `id`, `reserva_id`, `tipo`, `destinatario`, `enviado_en`, `estado`

Estados de la reserva: `confirmada`, `cancelada`, `completada`, `no_show`.

**Restricción clave:** índice único sobre `(profesional_id, inicio)` + transacciones, para que un profesional no quede con dos reservas en el mismo horario.

---

## 6. Carrito de varios servicios

- El cliente agrega varios servicios a una misma reserva; cada uno es un **ReservaItem**.
- Toda la reserva se atiende con **un único profesional**, en un bloque horario continuo.
- La **duración total** es la suma de los servicios (+ buffer) y el **precio total** la suma de los precios.
- El sistema busca un hueco continuo de esa duración total en la agenda del profesional.

---

## 7. Lógica de disponibilidad

1. Toma el **HorarioRecurrente** del profesional para ese día de la semana.
2. Aplica las **ExcepcionAgenda** de esa fecha (vacaciones, feriados, horario especial).
3. Divide la ventana en *slots* del tamaño de la duración total de la reserva (+ buffer).
4. Descarta los slots ocupados por otra reserva activa.
5. Agrupa los horarios en franjas: **Mañana** (antes de 12), **Tarde** (12–18), **Noche** (después de 18).

**"Cualquier profesional":** se calcula para todos los profesionales que ofrecen los servicios del carrito y se asigna uno disponible al confirmar.

Todo se guarda en **UTC** y se muestra en la zona horaria del negocio. La concurrencia (dos clientes reservando el mismo slot) se resuelve con el índice único y una transacción.

---

## 8. Confirmación y cancelación

- **Confirmación automática:** al terminar la reserva queda en estado `confirmada` y se disparan los emails.
- **Cancelación:**
  - El **admin** puede cancelar cualquier reserva desde el panel.
  - El **cliente** puede cancelar la suya hasta **20 minutos antes** del horario:
    - Si entró con Google: desde "Mis turnos".
    - Si reservó como invitado: con un enlace seguro (`token_cancelacion`) incluido en el email de confirmación.
  - Al cancelar, el slot se libera y se cancela cualquier recordatorio programado de esa reserva.
- **Asistencia:** pasado el horario, el admin marca la reserva como `completada` o `no_show` desde el calendario. Esto alimenta la segmentación y los recordatorios.

---

## 9. Recordatorios y rebooking

Función de retención, con dos disparadores:

1. **Por frecuencia (cliente que asistió):** en el último paso de la reserva se le pregunta, de forma opcional, cada cuánto suele querer volver. Opciones: **2 semanas, 3 semanas, 1 mes, 2 meses, o "no, gracias"**. Al marcarse la reserva como `completada`, se programa un email para `fecha del turno + frecuencia` invitándolo a reservar de nuevo.
2. **Por inasistencia (cliente `no_show`):** si el admin marca la reserva como `no_show`, se le envía igualmente una sugerencia para que vuelva a reservar.

Si el cliente reserva de nuevo antes de la fecha programada, el recordatorio pendiente se cancela para no duplicar avisos.

---

## 10. Segmentación de clientes

Cada cliente —registrado o invitado— se identifica por su email dentro del negocio y acumula historial: turnos completados, cancelaciones e inasistencias. El sistema le asigna un **segmento**, visible para el admin:

- **Nuevo** — 0 o 1 turnos completados.
- **Regular** — entre 2 y 4 turnos completados con buena asistencia.
- **Fiel** — 5 o más turnos completados y menos del 15% de fallas (cancelaciones + inasistencias).
- **En riesgo** — más del 30% de cancelaciones o inasistencias sobre el total de sus reservas.

Los umbrales quedan como constantes configurables del sistema. El segmento se recalcula tras cada cambio de estado de una reserva.

En el panel admin, la sección **Clientes** lista a todos con nombre, contacto, segmento, última visita y estadísticas, y permite filtrar por segmento.

---

## 11. Flujo del cliente (pantallas)

1. **Página del negocio** — logo, descripción, dirección, calificación, pestañas Servicios / Detalles / Reseñas.
2. **Elegir servicios** — lista con imagen, badge, precio y duración; buscador y filtro por categoría; carrito.
3. **Carrito** — resumen de servicios, precio y duración total.
4. **Elegir profesional** — tarjetas con foto y calificación + "Cualquier profesional – Máxima disponibilidad".
5. **Elegir fecha y horario** — calendario y slots agrupados en Mañana / Tarde / Noche.
6. **Datos de contacto + frecuencia** — obligatorio antes de confirmar:
   - Con Google: nombre y email vienen cargados; se pide el teléfono.
   - Como invitado: completar nombre, teléfono y email.
   - Luego, la pregunta opcional de frecuencia de visita.
7. **Confirmación** — resumen, emails enviados, reserva registrada en el admin.
8. **Post-turno** — al completarse, se invita a dejar una reseña.

---

## 12. Panel de administración

- **Dashboard** — turnos de hoy y de la semana.
- **Categorías y servicios** — alta/baja/edición, precio, duración, badge, imagen.
- **Profesionales** — alta/baja, foto, bio, qué servicios ofrece.
- **Agenda por profesional** — horario semanal y excepciones.
- **Calendario de turnos** — ver, crear y cancelar reservas; marcar asistencia.
- **Clientes** — lista con historial, segmento y filtros.
- **Reseñas** — ver y, opcionalmente, responder.
- **Portafolio** — subir y ordenar imágenes.
- **Configuración del negocio** — datos, redes, zona horaria, email de notificaciones.
- **Super-admin** — alta de negocios y sus admins, métricas globales.

---

## 13. Sistema de reseñas

- Tras completarse una reserva, el cliente puede dejar una reseña con **puntuación (1–5)** y comentario.
- Se asocia al negocio y/o al profesional que lo atendió.
- En la página del negocio se muestra: promedio general, distribución por estrellas y lista de comentarios.
- Cada profesional muestra su calificación promedio.
- Fase futura: resumen automático de reseñas con IA.

---

## 14. Integración con Gmail

Cuatro tipos de correo, enviados por el **worker en segundo plano**:

1. **Confirmación al cliente** — servicios, profesional, fecha, hora, precio total, dirección y enlace de cancelación. Se puede adjuntar un `.ics`.
2. **Aviso al admin** — nueva reserva con los datos del cliente.
3. **Recordatorio de frecuencia** — invitación a volver a reservar.
4. **Sugerencia tras inasistencia** — invitación a reagendar.

Envío vía **Gmail API** con OAuth (o SMTP como alternativa simple). Límite de Gmail: ~500 envíos/día en cuenta normal, ~2.000 en Workspace; si crece, migrar a un servicio transaccional (Resend, SendGrid, Amazon SES) sin tocar el resto.

---

## 15. Stack técnico

- **Frontend:** React + Vite + Tailwind. SPA responsive servida por Nginx.
- **Backend:** FastAPI (Python) + SQLAlchemy + Alembic para migraciones.
- **Base de datos:** PostgreSQL.
- **Cola y scheduler:** Redis + Celery para emails y recordatorios programados.
- **Auth:** OAuth de Google + sesión propia para invitados. Tokens JWT.
- **Imágenes:** carpeta en el VPS servida por Nginx.
- **Infra:** todo en Docker Compose (Nginx, backend, worker, scheduler, Postgres, Redis) en el VPS.
- **Extras:** HTTPS con Let's Encrypt, backups diarios de Postgres, Git con CI básico.

---

## 16. Estructura del proyecto

```
miturno/
├── backend/
│   ├── app/
│   │   ├── main.py            # arranque de FastAPI
│   │   ├── core/              # configuración, seguridad, dependencias
│   │   ├── models/            # modelos SQLAlchemy (sección 5)
│   │   ├── schemas/           # esquemas Pydantic (entrada/salida)
│   │   ├── api/               # routers por recurso (negocios, reservas...)
│   │   ├── services/          # lógica: disponibilidad, reservas, segmentación
│   │   ├── workers/           # tareas Celery: emails, recordatorios
│   │   └── db/                # sesión de base de datos
│   ├── alembic/               # migraciones
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/             # páginas: negocio, reserva, panel admin
│   │   ├── components/        # componentes reutilizables
│   │   ├── features/          # lógica por dominio
│   │   ├── api/               # cliente HTTP hacia el backend
│   │   ├── hooks/
│   │   └── App.jsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 17. División del trabajo (equipo de 2)

La forma más limpia de repartir es **uno en backend, otro en frontend**, con el contrato de la API como punto de acuerdo.

**Persona A — Backend e infraestructura**
- Modelo de datos y migraciones (PostgreSQL + Alembic).
- API REST con FastAPI: endpoints por recurso.
- Lógica de disponibilidad, reservas y segmentación de clientes.
- Autenticación: Google OAuth + sesión de invitados.
- Worker y scheduler: envío de emails por Gmail y recordatorios programados.
- Docker Compose, despliegue en el VPS, HTTPS y backups.

**Persona B — Frontend**
- SPA en React (Vite + Tailwind), responsive PC y celular.
- Flujo de reserva completo (las 8 pantallas de la sección 11).
- Panel de administración (todas las secciones del punto 12).
- Integración con la API del backend.

**Trabajo conjunto al inicio (hacerlo juntos antes de dividirse)**
- Acordar el modelo de datos definitivo (sección 5).
- Acordar el contrato de la API: endpoints, nombres y formato de los JSON. FastAPI genera documentación OpenAPI automática — úsenla como fuente de verdad compartida.
- Definir el repositorio (se sugiere un monorepo con las carpetas `backend/` y `frontend/`), el flujo de ramas de Git y convenciones de código.
- Levantar el `docker-compose.yml` base para que ambos trabajen en el mismo entorno.

Consejo: mientras el backend construye un endpoint, el frontend puede avanzar contra datos simulados (mocks) y reemplazarlos cuando el endpoint real esté listo. Así nadie queda bloqueado.

---

## 18. Roadmap por fases con tareas

**Fase 0 — Setup (juntos)**
- Crear el repositorio y la estructura de carpetas.
- Configurar Docker Compose (Postgres, Redis, backend, frontend).
- Desplegar un "hola mundo" en el VPS para validar la infraestructura.

**Fase 1 — MVP**
- [Backend] Modelo de datos y migraciones; API de negocios, categorías, servicios, profesionales y horarios.
- [Backend] Lógica de disponibilidad y creación de reservas con confirmación automática.
- [Backend] Envío del email de confirmación por Gmail.
- [Frontend] Página del negocio y flujo de reserva como invitado (servicios, carrito, profesional, fecha/hora, datos, confirmación).
- Resultado: un negocio funcionando de punta a punta.

**Fase 2 — Funciones completas**
- [Backend] Google OAuth; cancelación con regla de 20 min; marcado de asistencia; segmentación de clientes; recordatorios por frecuencia e inasistencia (worker + scheduler).
- [Backend] API de reseñas y portafolio.
- [Frontend] Panel de administración completo (servicios, profesionales, agenda, calendario, clientes, reseñas, portafolio).
- [Frontend] Login con Google, "Mis turnos", reseñas, "cualquier profesional".

**Fase 3 — SaaS**
- [Backend] Panel super-admin: alta de negocios y admins; métricas globales.
- [Frontend] Pantallas de super-admin y reportes.

**Fase 4 — Mejoras**
- Resumen de reseñas con IA, lista de espera, branding por negocio, integración con Google Calendar.

---

## 19. Riesgos y buenas prácticas

- **Zona horaria:** guardar siempre en UTC y convertir solo al mostrar. Es la fuente más común de bugs en sistemas de turnos.
- **Reservas duplicadas:** confiar en el índice único de base de datos, no solo en una validación previa.
- **Deliverability de Gmail:** vigilar el límite diario; tener lista la migración a un servicio transaccional.
- **Aislamiento entre negocios:** filtrar SIEMPRE por `negocio_id` en cada consulta; un descuido acá expone datos de otro negocio.
- **Backups:** automatizar el respaldo diario de PostgreSQL desde el primer día.
- **Variables sensibles:** credenciales y claves en variables de entorno, nunca en el repositorio.

---

## 20. Auditoría de avance (estado real)

Revisión del código contra el plan. Leyenda: ✅ hecho · 🟡 parcial · ❌ falta.

### Fase 0 — Setup
- ✅ Monorepo `backend/` + `frontend/`, estructura de carpetas.
- ✅ Docker Compose: db (Postgres), redis, backend, frontend, worker, scheduler.
- ❌ Despliegue en VPS (todo corre local por ahora).

### Fase 1 — MVP
- ✅ Modelo de datos completo (todas las tablas de la sección 5) + Alembic.
- ✅ API de negocios, categorías, servicios, profesionales, horarios.
- ✅ Lógica de disponibilidad (recurrencia + excepciones + franjas mañana/tarde/noche, UTC).
- ✅ Creación de reservas con carrito multi-servicio + confirmación automática.
- ✅ Índice único `(profesional_id, inicio)` anti doble-reserva.
- ✅ Email de confirmación al cliente por Gmail (SMTP).
- ✅ Página del negocio + flujo de reserva como invitado (todas las pantallas).

### Fase 2 — Funciones completas
- ✅ Cancelación (admin + cliente por token, regla 20 min).
- ✅ Marcado de asistencia (completada / no_show).
- ✅ Segmentación de clientes (nuevo / regular / fiel / en riesgo).
- ✅ Recordatorios por frecuencia e inasistencia (Celery worker + scheduler).
- ✅ API de reseñas + reseñas públicas (del negocio y por profesional) con formulario en la web.
- ✅ Panel admin: Dashboard, Turnos, Clientes, Reseñas, Gestión (servicios, profesionales, portafolio).
- ✅ "Cualquier profesional".
- ✅ Auth admin con usuario + DNI + contraseña y registro de accesos (auditoría).
- ❌ **Login con Google (OAuth) + "Mis turnos"** — no implementado.
- ❌ **Agenda por profesional desde el panel** (horario semanal + excepciones) — hoy solo se carga por seed/DB.
- ❌ **Gestión de categorías desde el panel** y **filtro por categoría** en la web pública.
- ❌ **Configuración del negocio** desde el panel (nombre, dirección, redes, zona horaria, email de notificaciones, logo).

### Fase 3 — SaaS
- ❌ Panel super-admin (alta de negocios/admins, métricas globales) — solo existe el rol en el modelo.

### Extras ya hechos (no estaban en el plan o eran fase futura)
- ✅ **Subida de imágenes** con drag & drop / explorador (servicios, profesionales, portafolio).
- ✅ **Asistente IA** (Groq/Llama): sugerencia de servicios y generación de descripciones.
- ✅ Rediseño editorial (barbería negra) en web pública y panel admin.
- ✅ Panel admin responsive con **navegación inferior tipo app** en celular.
- ✅ Auto-refresco del panel ("en vivo") cada 12–15s.

### Diferencias respecto al plan (decisiones tomadas en el camino)
- El **aviso por email al admin** se quitó a pedido: el admin ve todo en el panel (con refresco en vivo).
- Email por **SMTP de Gmail**, no Gmail API con OAuth (el plan lo aceptaba como alternativa).

---

## 21. Pendientes por hacer (priorizado)

**Alta prioridad (completar el producto para uso real)**
1. **Configuración del negocio en el panel** — editar nombre, dirección, zona horaria, email de notificaciones, logo y redes. (Backend: `PATCH /negocios/{id}`; Frontend: pestaña "Configuración".)
2. **Agenda por profesional en el panel** — definir horario semanal y excepciones (vacaciones/feriados) sin tocar la base de datos.
3. **Mostrar el portafolio en la página pública** — hoy se cargan fotos pero no se ven; agregar la galería en la pestaña Detalles o una sección propia.
4. **Gestión de categorías + filtro por categoría** en la web (el modelo ya lo soporta).

**Media prioridad (retención y experiencia)**
5. **Login con Google + "Mis turnos"** — requiere credenciales de Google Cloud; permite al cliente ver/cancelar sus turnos sin el link del email.
6. **Distribución de reseñas por estrellas** (histograma) y **responder reseñas** desde el panel.
7. **Adjuntar `.ics`** (archivo de calendario) en el email de confirmación.
8. **Recordatorio de turno próximo** (ej. 24 h antes) — además de los de rebooking.

**SaaS (Fase 3)**
9. **Panel super-admin** — alta de negocios y sus admins, métricas globales, activar/desactivar negocios.
10. **Onboarding de negocios** — flujo para crear un negocio nuevo con su admin y slug.

**Infraestructura / producción**
11. **Despliegue en VPS** con Nginx + HTTPS (Let's Encrypt).
12. **Backups diarios** automáticos de PostgreSQL.
13. **Tests** (pytest backend, al menos disponibilidad y reservas).
14. **CI básico** en Git.

**Fase 4 — Mejoras futuras**
15. Resumen automático de reseñas con IA.
16. Lista de espera, branding por negocio, integración con Google Calendar.
