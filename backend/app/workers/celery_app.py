from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "miturno",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "enviar-recordatorios-vencidos": {
            "task": "app.workers.tasks.enviar_recordatorios_vencidos",
            "schedule": 60.0,  # cada minuto revisa recordatorios vencidos
        },
    },
)

# Importa las tareas para que Celery las registre.
import app.workers.tasks  # noqa: E402,F401
