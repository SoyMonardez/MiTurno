from datetime import date as date_type
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_admin
from app.api.deps import get_db
from app.core.config import settings
from app.models.catalogo import Servicio
from app.models.cliente import Cliente
from app.models.enums import EstadoReserva, RolUsuario, SegmentoCliente
from app.models.negocio import Negocio, RegistroAcceso, Usuario
from app.models.profesional import Profesional
from app.models.resena import Resena
from app.models.reserva import Reserva, ReservaItem
from app.schemas.admin import (
    AccesoOut,
    AsistenciaIn,
    ClienteAdminOut,
    DashboardOut,
    EstadisticaDiaOut,
    EstadisticasOut,
    ReservaAdminOut,
    ServicioSugerido,
    SugerenciaIn,
    SugerenciaOut,
    SugerenciaTextoOut,
    TextoIn,
    SugerenciaCategoriasOut,
)
from app.schemas.reserva import ReservaAdminCreate, ReservaOut
from app.schemas.negocio import NegocioUpdate, NegocioOut
from app.services.gestion_reservas import cancelar_por_admin, marcar_asistencia
from app.services.reservas import crear_reserva_admin

router = APIRouter(prefix="/admin", tags=["admin"])

# Servicios comunes de barbería/salón (fallback sin API key)
_SERVICIOS_POR_TIPO: dict[str, list[str]] = {
    "barbería": [
        "Corte de cabello",
        "Arreglo de barba",
        "Afeitado clásico",
        "Corte + barba",
        "Coloración",
        "Mechas",
        "Alisado",
        "Tratamiento capilar",
        "Diseño de barba",
        "Keratina",
    ],
    "salón de belleza": [
        "Corte de cabello",
        "Coloración",
        "Mechas",
        "Alisado keratina",
        "Manicura",
        "Pedicura",
        "Depilación facial",
        "Maquillaje",
        "Tratamiento capilar",
        "Tinte",
    ],
    "peluquería": [
        "Corte de cabello",
        "Coloración",
        "Mechas",
        "Permanente",
        "Alisado",
        "Keratina",
        "Tratamiento hidratante",
        "Corte + peinado",
        "Tinte raíces",
        "Recorte de puntas",
    ],
    "spa": [
        "Masaje relajante",
        "Masaje descontracturante",
        "Facial hidratante",
        "Limpieza de cutis",
        "Exfoliación corporal",
        "Aromaterapia",
        "Reflexología",
        "Manicura spa",
        "Pedicura spa",
        "Envoltura corporal",
    ],
    "default": [
        "Consulta",
        "Servicio básico",
        "Servicio premium",
        "Asesoramiento",
        "Mantenimiento",
        "Tratamiento express",
        "Paquete completo",
        "Servicio a domicilio",
        "Revisión",
        "Seguimiento",
    ],
}


def _normalizar(s: str) -> str:
    reemplazos = str.maketrans("áéíóúüñ", "aeiouun")
    return s.lower().translate(reemplazos)


def _servicios_fallback(tipo: str) -> list[str]:
    tipo_n = _normalizar(tipo)
    for key in _SERVICIOS_POR_TIPO:
        if key == "default":
            continue
        key_n = _normalizar(key)
        if key_n in tipo_n or tipo_n in key_n:
            return _SERVICIOS_POR_TIPO[key]
    return _SERVICIOS_POR_TIPO["default"]


def _serializar_reservas(reservas, db: Session) -> list[ReservaAdminOut]:
    """Serializa una lista de reservas con pocas queries (evita N+1)."""
    reservas = list(reservas)
    if not reservas:
        return []

    cliente_ids = {r.cliente_id for r in reservas if r.cliente_id}
    profesional_ids = {r.profesional_id for r in reservas if r.profesional_id}
    reserva_ids = [r.id for r in reservas]

    clientes = (
        {c.id: c for c in db.scalars(select(Cliente).where(Cliente.id.in_(cliente_ids)))}
        if cliente_ids else {}
    )
    profesionales = (
        {p.id: p for p in db.scalars(select(Profesional).where(Profesional.id.in_(profesional_ids)))}
        if profesional_ids else {}
    )

    # Nombres de servicios de todas las reservas en una sola query.
    servicios_por_reserva: dict[int, list[str]] = {rid: [] for rid in reserva_ids}
    filas = db.execute(
        select(ReservaItem.reserva_id, Servicio.nombre)
        .join(Servicio, Servicio.id == ReservaItem.servicio_id)
        .where(ReservaItem.reserva_id.in_(reserva_ids))
        .order_by(ReservaItem.reserva_id, ReservaItem.orden)
    ).all()
    for rid, nombre in filas:
        servicios_por_reserva.setdefault(rid, []).append(nombre)

    salida = []
    for r in reservas:
        cliente = clientes.get(r.cliente_id)
        profesional = profesionales.get(r.profesional_id)
        salida.append(
            ReservaAdminOut(
                id=r.id,
                inicio=r.inicio,
                fin=r.fin,
                estado=r.estado,
                total_precio=r.total_precio,
                total_duracion=r.total_duracion,
                cliente_nombre=cliente.nombre if cliente else "—",
                cliente_email=cliente.email if cliente else "",
                cliente_telefono=cliente.telefono if cliente else None,
                profesional_nombre=profesional.nombre if profesional else "—",
                servicios=servicios_por_reserva.get(r.id, []),
            )
        )
    return salida


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    admin: Usuario = Depends(get_current_admin), db: Session = Depends(get_db)
) -> DashboardOut:
    negocio = db.get(Negocio, admin.negocio_id)
    tz = ZoneInfo(negocio.zona_horaria)
    ahora_local = datetime.now(tz)
    hoy = ahora_local.date()

    inicio_hoy = datetime.combine(hoy, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))
    fin_hoy = datetime.combine(hoy + timedelta(days=1), time.min, tzinfo=tz).astimezone(
        ZoneInfo("UTC")
    )
    fin_semana = datetime.combine(
        hoy + timedelta(days=7), time.min, tzinfo=tz
    ).astimezone(ZoneInfo("UTC"))

    # Contamos turnos reales del período: confirmados + completados
    # (los completados también "cuentan" como turnos del día/semana).
    estados_activos = [EstadoReserva.confirmada, EstadoReserva.completada]

    def _contar(desde, hasta):
        return db.scalar(
            select(func.count(Reserva.id)).where(
                Reserva.negocio_id == negocio.id,
                Reserva.estado.in_(estados_activos),
                Reserva.inicio >= desde,
                Reserva.inicio < hasta,
            )
        )

    # Turnos de hoy (confirmados y completados), ordenados por hora.
    turnos_hoy_lista = db.scalars(
        select(Reserva)
        .where(
            Reserva.negocio_id == negocio.id,
            Reserva.estado.in_(estados_activos),
            Reserva.inicio >= inicio_hoy,
            Reserva.inicio < fin_hoy,
        )
        .order_by(Reserva.inicio)
    )

    # Próximos turnos confirmados (de hoy en adelante).
    proximas = db.scalars(
        select(Reserva)
        .where(
            Reserva.negocio_id == negocio.id,
            Reserva.estado == EstadoReserva.confirmada,
            Reserva.inicio >= inicio_hoy,
        )
        .order_by(Reserva.inicio)
        .limit(10)
    )

    # Solo accesos de usuarios que pertenecen a esta sucursal. Excluimos al
    # super-admin y a admins de otros negocios (que en su momento pudieron
    # quedar registrados con este negocio_id).
    accesos = db.execute(
        select(Usuario.nombre, Usuario.dni, RegistroAcceso.ingreso_en)
        .join(Usuario, Usuario.id == RegistroAcceso.usuario_id)
        .where(
            RegistroAcceso.negocio_id == negocio.id,
            Usuario.negocio_id == negocio.id,
            Usuario.rol != RolUsuario.super_admin,
        )
        .order_by(RegistroAcceso.ingreso_en.desc())
        .limit(10)
    ).all()

    return DashboardOut(
        turnos_hoy=_contar(inicio_hoy, fin_hoy),
        turnos_semana=_contar(inicio_hoy, fin_semana),
        hoy=_serializar_reservas(turnos_hoy_lista, db),
        proximos=_serializar_reservas(proximas, db),
        accesos_recientes=[
            AccesoOut(usuario_nombre=n, usuario_dni=d, ingreso_en=i) for n, d, i in accesos
        ],
    )


@router.get("/estadisticas", response_model=EstadisticasOut)
def estadisticas(
    dias: int = Query(30, ge=7, le=90),
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> EstadisticasOut:
    negocio = db.get(Negocio, admin.negocio_id)
    tz_name = negocio.zona_horaria
    tz = ZoneInfo(tz_name)
    hoy = datetime.now(tz).date()
    primer_dia = hoy - timedelta(days=dias - 1)
    desde_utc = datetime.combine(primer_dia, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))

    # Una sola query: cuenta los turnos por día, convertidos a la zona
    # horaria del negocio (antes eran ~30 queries en un loop).
    dia_local = func.date(func.timezone(tz_name, Reserva.inicio))
    filas = db.execute(
        select(dia_local.label("dia"), func.count(Reserva.id))
        .where(
            Reserva.negocio_id == negocio.id,
            Reserva.estado.in_([EstadoReserva.confirmada, EstadoReserva.completada]),
            Reserva.inicio >= desde_utc,
        )
        .group_by(dia_local)
    ).all()
    conteo = {fila[0]: fila[1] for fila in filas}

    resultado = []
    for i in range(dias - 1, -1, -1):
        dia = hoy - timedelta(days=i)
        resultado.append(EstadisticaDiaOut(fecha=dia, turnos=conteo.get(dia, 0)))

    return EstadisticasOut(datos=resultado)


_PROMPT_SISTEMA = """\
Sos un asistente experto en negocios de servicios (barberías, salones de belleza, spas, etc.).
Tu tarea es ayudar al dueño de un negocio a armar el catálogo de servicios de su sistema de turnos online.

Cuando el usuario describa su negocio o pida ideas, respondé con:
1. Un párrafo corto de asesoramiento (máximo 2 oraciones, tono amigable y directo).
2. Entre 4 y 8 servicios sugeridos, cada uno con nombre, descripción breve, duración estimada en minutos y precio sugerido en pesos argentinos.

Respondé SIEMPRE en este formato JSON (sin markdown, sin texto fuera del JSON):
{
  "respuesta": "texto de asesoramiento",
  "servicios": [
    {"nombre": "...", "descripcion": "...", "duracion_min": 30, "precio_sugerido": 5000},
    ...
  ]
}

Precios de referencia para Argentina (2025): servicios básicos $3000-$8000, intermedios $8000-$20000, premium $20000+.
Si el usuario ya dio información antes, usala para ser más específico. Sé creativo pero realista.
"""


def _fallback_servicios_estructurados(tipo: str) -> SugerenciaOut:
    mapa = {
        "barberia": [
            ServicioSugerido(nombre="Corte de cabello", descripcion="Corte clásico o moderno con tijera y máquina.", duracion_min=30, precio_sugerido=5000),
            ServicioSugerido(nombre="Arreglo de barba", descripcion="Perfilado y recorte de barba con navaja.", duracion_min=20, precio_sugerido=3500),
            ServicioSugerido(nombre="Afeitado clásico", descripcion="Afeitado tradicional con toalla caliente y navaja.", duracion_min=30, precio_sugerido=4000),
            ServicioSugerido(nombre="Corte + barba", descripcion="Combo completo: corte y arreglo de barba.", duracion_min=50, precio_sugerido=7500),
            ServicioSugerido(nombre="Coloración", descripcion="Tinte completo con productos profesionales.", duracion_min=60, precio_sugerido=12000),
            ServicioSugerido(nombre="Keratina", descripcion="Tratamiento alisador de larga duración.", duracion_min=90, precio_sugerido=18000),
        ],
        "salon": [
            ServicioSugerido(nombre="Corte de cabello", descripcion="Corte personalizado según el estilo del cliente.", duracion_min=40, precio_sugerido=6000),
            ServicioSugerido(nombre="Coloración completa", descripcion="Tinte de raíces a puntas con productos premium.", duracion_min=90, precio_sugerido=15000),
            ServicioSugerido(nombre="Manicura", descripcion="Limpieza, lima y esmaltado de uñas.", duracion_min=40, precio_sugerido=4000),
            ServicioSugerido(nombre="Pedicura", descripcion="Tratamiento completo de pies con esmaltado.", duracion_min=50, precio_sugerido=5000),
            ServicioSugerido(nombre="Alisado keratina", descripcion="Alisado profesional de larga duración.", duracion_min=120, precio_sugerido=22000),
        ],
        "spa": [
            ServicioSugerido(nombre="Masaje relajante", descripcion="Masaje de cuerpo completo con aceites esenciales.", duracion_min=60, precio_sugerido=12000),
            ServicioSugerido(nombre="Facial hidratante", descripcion="Limpieza profunda e hidratación del rostro.", duracion_min=60, precio_sugerido=10000),
            ServicioSugerido(nombre="Exfoliación corporal", descripcion="Tratamiento exfoliante con sales minerales.", duracion_min=45, precio_sugerido=9000),
            ServicioSugerido(nombre="Masaje descontracturante", descripcion="Masaje enfocado en nodos de tensión muscular.", duracion_min=60, precio_sugerido=14000),
        ],
    }
    tipo_n = _normalizar(tipo)
    for key, servicios in mapa.items():
        if key in tipo_n:
            return SugerenciaOut(respuesta=f"Acá van algunos servicios típicos para tu negocio.", servicios=servicios)
    servicios_default = [
        ServicioSugerido(nombre="Consulta inicial", descripcion="Primera consulta y evaluación del cliente.", duracion_min=30, precio_sugerido=3000),
        ServicioSugerido(nombre="Servicio básico", descripcion="Servicio estándar del negocio.", duracion_min=30, precio_sugerido=5000),
        ServicioSugerido(nombre="Servicio premium", descripcion="Versión completa y premium del servicio.", duracion_min=60, precio_sugerido=10000),
        ServicioSugerido(nombre="Pack completo", descripcion="Combinación de todos los servicios principales.", duracion_min=90, precio_sugerido=15000),
    ]
    return SugerenciaOut(respuesta="Describí tu negocio para recibir sugerencias más específicas.", servicios=servicios_default)


def _llamar_ia(mensaje: str) -> SugerenciaOut:
    import json as _json

    # Prioridad 1: Groq (llama3 rápido y gratuito)
    if settings.groq_api_key:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=1024,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _PROMPT_SISTEMA},
                {"role": "user", "content": mensaje},
            ],
        )
        texto = resp.choices[0].message.content.strip()
        datos = _json.loads(texto)
        servicios = [ServicioSugerido(**s) for s in datos.get("servicios", [])]
        return SugerenciaOut(respuesta=datos.get("respuesta", ""), servicios=servicios)

    # Prioridad 2: Anthropic Claude Haiku
    if settings.anthropic_api_key:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=_PROMPT_SISTEMA,
            messages=[{"role": "user", "content": mensaje}],
        )
        texto = resp.content[0].text.strip()
        datos = _json.loads(texto)
        servicios = [ServicioSugerido(**s) for s in datos.get("servicios", [])]
        return SugerenciaOut(respuesta=datos.get("respuesta", ""), servicios=servicios)

    raise ValueError("Sin API key configurada")


@router.post("/ia/sugerencias-servicio", response_model=SugerenciaOut)
def sugerencias_servicio(
    data: SugerenciaIn,
    admin: Usuario = Depends(get_current_admin),
) -> SugerenciaOut:
    if not settings.groq_api_key and not settings.anthropic_api_key:
        return _fallback_servicios_estructurados(data.tipo_negocio or data.mensaje)
    try:
        return _llamar_ia(data.mensaje)
    except Exception as exc:
        print(f"[IA ERROR] {exc}", flush=True)
        return _fallback_servicios_estructurados(data.tipo_negocio or data.mensaje)


def _ia_texto(prompt: str, max_tokens: int = 200) -> str | None:
    """Llamada simple a la IA que devuelve texto plano. None si no hay IA o falla."""
    try:
        if settings.groq_api_key:
            from groq import Groq
            client = Groq(api_key=settings.groq_api_key)
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content.strip()
        if settings.anthropic_api_key:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text.strip()
    except Exception as exc:
        print(f"[IA ERROR] {exc}", flush=True)
    return None


@router.post("/ia/descripcion-servicio", response_model=SugerenciaTextoOut)
def descripcion_servicio(
    data: TextoIn,
    admin: Usuario = Depends(get_current_admin),
) -> SugerenciaTextoOut:
    nombre = (data.texto or "").strip()
    if not nombre:
        return SugerenciaTextoOut(texto="")
    prompt = (
        f"Escribí una descripción breve y atractiva (máximo 18 palabras, en español rioplatense, "
        f"sin comillas) para el servicio de un negocio llamado '{nombre}'. "
        "Respondé SOLO con la descripción, sin texto adicional."
    )
    texto = _ia_texto(prompt, max_tokens=80)
    if not texto:
        texto = f"{nombre} a cargo de profesionales con productos de primera calidad."
    # Limpieza: quitar comillas envolventes
    texto = texto.strip().strip('"').strip()
    return SugerenciaTextoOut(texto=texto)


@router.get("/reservas", response_model=list[ReservaAdminOut])
def listar_reservas(
    desde: date_type,
    hasta: date_type,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[ReservaAdminOut]:
    negocio = db.get(Negocio, admin.negocio_id)
    tz = ZoneInfo(negocio.zona_horaria)
    desde_utc = datetime.combine(desde, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))
    hasta_utc = datetime.combine(
        hasta + timedelta(days=1), time.min, tzinfo=tz
    ).astimezone(ZoneInfo("UTC"))

    reservas = db.scalars(
        select(Reserva)
        .where(
            Reserva.negocio_id == negocio.id,
            Reserva.inicio >= desde_utc,
            Reserva.inicio < hasta_utc,
        )
        .order_by(Reserva.inicio)
    )
    return _serializar_reservas(reservas, db)


@router.post("/reservas", response_model=ReservaOut, status_code=201)
def crear_reserva_manual(
    data: ReservaAdminCreate,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ReservaOut:
    return crear_reserva_admin(admin.negocio_id, data, db)


@router.post("/reservas/{reserva_id}/cancelar", response_model=ReservaOut)
def cancelar(
    reserva_id: int,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ReservaOut:
    return cancelar_por_admin(reserva_id, admin.negocio_id, db)


@router.post("/reservas/{reserva_id}/asistencia", response_model=ReservaOut)
def asistencia(
    reserva_id: int,
    data: AsistenciaIn,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ReservaOut:
    return marcar_asistencia(reserva_id, admin.negocio_id, data.estado, db)


@router.delete("/resenas/{resena_id}", status_code=204)
def eliminar_resena(
    resena_id: int,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    from app.services.resenas import _recalcular_promedio_profesional

    resena = db.get(Resena, resena_id)
    if not resena or resena.negocio_id != admin.negocio_id:
        raise HTTPException(404, "Reseña no encontrada")

    profesional_id = resena.profesional_id
    db.delete(resena)
    db.flush()
    # Recalcular el promedio del profesional tras eliminar la reseña.
    if profesional_id:
        _recalcular_promedio_profesional(profesional_id, db)
    db.commit()


@router.get("/clientes", response_model=list[ClienteAdminOut])
def listar_clientes(
    segmento: SegmentoCliente | None = None,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[Cliente]:
    consulta = select(Cliente).where(Cliente.negocio_id == admin.negocio_id)
    if segmento is not None:
        consulta = consulta.where(Cliente.segmento == segmento)
    return list(db.scalars(consulta.order_by(Cliente.nombre)))


@router.get("/negocio", response_model=NegocioOut)
def obtener_negocio(
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> Negocio:
    negocio = db.get(Negocio, admin.negocio_id)
    if not negocio:
        from fastapi import HTTPException
        raise HTTPException(404, "Negocio no encontrado")
    return negocio


@router.patch("/negocio", response_model=NegocioOut)
def actualizar_negocio(
    data: NegocioUpdate,
    admin: Usuario = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> Negocio:
    negocio = db.get(Negocio, admin.negocio_id)
    if not negocio:
        from fastapi import HTTPException
        raise HTTPException(404, "Negocio no encontrado")

    if data.nombre is not None:
        negocio.nombre = data.nombre
    if data.descripcion is not None:
        negocio.descripcion = data.descripcion
    if data.direccion is not None:
        negocio.direccion = data.direccion
    if data.zona_horaria is not None:
        negocio.zona_horaria = data.zona_horaria
    if data.email_notificaciones is not None:
        negocio.email_notificaciones = data.email_notificaciones
    if data.logo is not None:
        negocio.logo = data.logo
    if data.icono is not None:
        negocio.icono = data.icono
    if data.redes is not None:
        negocio.redes = data.redes
    if data.mapa_url is not None:
        negocio.mapa_url = data.mapa_url

    db.commit()
    db.refresh(negocio)
    return negocio


@router.post("/ia/descripcion-negocio", response_model=SugerenciaTextoOut)
def descripcion_negocio(
    data: TextoIn,
    admin: Usuario = Depends(get_current_admin),
) -> SugerenciaTextoOut:
    nombre = (data.texto or "").strip()
    if not nombre:
        return SugerenciaTextoOut(texto="")
    prompt = (
        f"Escribí una descripción corta, elegante y comercial (máximo 25 palabras, en español rioplatense, "
        f"sin comillas) para la presentación de un negocio de servicios llamado '{nombre}'. "
        "Respondé SOLO con la descripción, sin texto adicional."
    )
    texto = _ia_texto(prompt, max_tokens=100)
    if not texto:
        texto = f"Bienvenidos a {nombre}, brindamos servicios de excelencia con la mejor atención y profesionales capacitados."
    texto = texto.strip().strip('"').strip()
    return SugerenciaTextoOut(texto=texto)


@router.post("/ia/sugerir-categorias", response_model=SugerenciaCategoriasOut)
def sugerir_categorias(
    data: TextoIn,
    admin: Usuario = Depends(get_current_admin),
) -> SugerenciaCategoriasOut:
    nombre = (data.texto or "").strip()
    if not nombre:
        return SugerenciaCategoriasOut(categorias=[])
    
    prompt = (
        f"Para un negocio de servicios llamado o descripto como '{nombre}', "
        f"sugerí entre 3 y 6 categorías de servicios adecuadas. "
        f"Ejemplos si es barbería: 'Cortes', 'Barba', 'Combos'. "
        f"Respondé únicamente con una lista de nombres de categorías separados por comas y nada más (ejemplo: Cortes, Barba, Combos)."
    )
    texto = _ia_texto(prompt, max_tokens=100)
    if not texto:
        nombre_lower = nombre.lower()
        if "barber" in nombre_lower or "peluquería" in nombre_lower or "corte" in nombre_lower:
            return SugerenciaCategoriasOut(categorias=["Cortes", "Barba", "Coloración", "Combos"])
        elif "spa" in nombre_lower or "estética" in nombre_lower or "facial" in nombre_lower:
            return SugerenciaCategoriasOut(categorias=["Masajes", "Faciales", "Corporales", "Combos"])
        else:
            return SugerenciaCategoriasOut(categorias=["Servicios", "Combos", "Especiales"])
    
    categorias = [c.strip().strip('"').strip() for c in texto.split(",") if c.strip()]
    vistas = set()
    categorias_limpias = []
    for c in categorias:
        if c.lower() not in vistas and c:
            vistas.add(c.lower())
            categorias_limpias.append(c)
    return SugerenciaCategoriasOut(categorias=categorias_limpias[:6])
