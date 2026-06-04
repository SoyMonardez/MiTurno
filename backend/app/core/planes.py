"""Lógica central de planes: niveles, límites y verificación de features."""
from fastapi import HTTPException

# Jerarquía de planes
PLAN_NIVEL = {"basico": 0, "pro": 1, "premium": 2}
PLAN_LABEL = {"basico": "Básico", "pro": "Pro", "premium": "Premium"}

# Límite de profesionales por plan (None = ilimitado)
LIMITE_PROFESIONALES = {"basico": 1, "pro": 5, "premium": None}


def nivel(plan: str | None) -> int:
    return PLAN_NIVEL.get(plan or "pro", 1)


def requiere_plan(plan: str | None, minimo: str, feature: str) -> None:
    """Lanza 403 si el plan del negocio es inferior al mínimo requerido."""
    if nivel(plan) < PLAN_NIVEL[minimo]:
        raise HTTPException(
            403,
            f"{feature} está disponible desde el plan {PLAN_LABEL[minimo]}. "
            f"Actualizá el plan para usarlo.",
        )
