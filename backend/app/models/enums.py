import enum


class RolUsuario(str, enum.Enum):
    cliente = "cliente"
    admin = "admin"
    super_admin = "super_admin"
    profesional = "profesional"


class TipoComision(str, enum.Enum):
    """Regla financiera del profesional: % por corte o sueldo fijo del local."""
    porcentaje_corte = "porcentaje_corte"
    fijo_local = "fijo_local"


class MetodoPago(str, enum.Enum):
    efectivo = "efectivo"
    transferencia = "transferencia"
    mercado_pago = "mercado_pago"


class BloqueHorario(str, enum.Enum):
    manana = "manana"
    tarde = "tarde"


class EstadoListaEspera(str, enum.Enum):
    pendiente = "pendiente"      # anotado, esperando que se libere un lugar
    notificado = "notificado"    # se le ofreció un turno liberado por WhatsApp
    confirmado = "confirmado"    # respondió "SÍ" y se creó la reserva
    expirado = "expirado"        # la oferta venció o el día pasó
    cancelado = "cancelado"


class BadgeServicio(str, enum.Enum):
    ninguno = "ninguno"
    recomendado = "recomendado"
    popular = "popular"
    nuevo = "nuevo"
    hot = "hot"


class SegmentoCliente(str, enum.Enum):
    nuevo = "nuevo"
    regular = "regular"
    fiel = "fiel"
    en_riesgo = "en_riesgo"


class EstadoReserva(str, enum.Enum):
    confirmada = "confirmada"
    cancelada = "cancelada"
    completada = "completada"
    no_show = "no_show"


class TipoExcepcion(str, enum.Enum):
    no_disponible = "no_disponible"
    horario_especial = "horario_especial"


class TipoRecordatorio(str, enum.Enum):
    frecuencia = "frecuencia"
    inasistencia = "inasistencia"
    turno_proximo = "turno_proximo"


class EstadoRecordatorio(str, enum.Enum):
    pendiente = "pendiente"
    enviado = "enviado"
    cancelado = "cancelado"


class TipoNotificacion(str, enum.Enum):
    confirmacion_cliente = "confirmacion_cliente"
    aviso_admin = "aviso_admin"
    recordatorio_frecuencia = "recordatorio_frecuencia"
    sugerencia_inasistencia = "sugerencia_inasistencia"
    recordatorio_turno = "recordatorio_turno"
    opinion_cliente = "opinion_cliente"


class EstadoNotificacion(str, enum.Enum):
    pendiente = "pendiente"
    enviado = "enviado"
    fallido = "fallido"
