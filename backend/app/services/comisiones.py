"""Cálculo del split financiero entre el profesional y el local (plan Premium)."""
from decimal import Decimal

from app.models.enums import TipoComision
from app.models.profesional import Profesional


def calcular_split(precio: Decimal | float, profesional: Profesional) -> dict[str, Decimal]:
    """Divide el precio de un turno según la regla de comisión del profesional.

    - porcentaje_corte: el profesional cobra su % y el resto queda para el local.
    - fijo_local: el local retiene todo (el profesional se liquida por sueldo fijo).
    """
    centavo = Decimal("0.01")
    precio = Decimal(str(precio))
    if profesional.tipo_comision == TipoComision.porcentaje_corte:
        porcentaje = Decimal(str(profesional.valor_comision or 0)) / Decimal("100")
        pago_profesional = (precio * porcentaje).quantize(centavo)
        pago_local = precio - pago_profesional
    else:  # fijo_local
        pago_profesional = Decimal("0.00")
        pago_local = precio
    # Siempre con 2 decimales, para guardar y mostrar consistente.
    return {
        "profesional": pago_profesional.quantize(centavo),
        "local": pago_local.quantize(centavo),
    }
