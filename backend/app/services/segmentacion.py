from app.models.cliente import Cliente
from app.models.enums import SegmentoCliente

# Umbrales configurables del sistema (sección 10 del plan).
FIEL_MIN_COMPLETADOS = 5
FIEL_MAX_FALLAS_PCT = 0.15
EN_RIESGO_FALLAS_PCT = 0.30
REGULAR_MIN_COMPLETADOS = 2


def calcular_segmento(cliente: Cliente) -> SegmentoCliente:
    completados = cliente.turnos_completados
    fallas = cliente.turnos_cancelados + cliente.no_shows
    total = completados + fallas

    pct_fallas = (fallas / total) if total > 0 else 0.0

    if total > 0 and pct_fallas > EN_RIESGO_FALLAS_PCT:
        return SegmentoCliente.en_riesgo
    if completados >= FIEL_MIN_COMPLETADOS and pct_fallas < FIEL_MAX_FALLAS_PCT:
        return SegmentoCliente.fiel
    if completados >= REGULAR_MIN_COMPLETADOS:
        return SegmentoCliente.regular
    return SegmentoCliente.nuevo


def recalcular_segmento(cliente: Cliente) -> None:
    cliente.segmento = calcular_segmento(cliente)
