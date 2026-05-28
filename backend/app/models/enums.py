import enum


class RolUsuario(str, enum.Enum):
    cliente = "cliente"
    admin = "admin"
    super_admin = "super_admin"


class BadgeServicio(str, enum.Enum):
    ninguno = "ninguno"
    recomendado = "recomendado"
    popular = "popular"
    nuevo = "nuevo"


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


class EstadoRecordatorio(str, enum.Enum):
    pendiente = "pendiente"
    enviado = "enviado"
    cancelado = "cancelado"


class TipoNotificacion(str, enum.Enum):
    confirmacion_cliente = "confirmacion_cliente"
    aviso_admin = "aviso_admin"
    recordatorio_frecuencia = "recordatorio_frecuencia"
    sugerencia_inasistencia = "sugerencia_inasistencia"


class EstadoNotificacion(str, enum.Enum):
    pendiente = "pendiente"
    enviado = "enviado"
    fallido = "fallido"
