from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "MiTurno API"
    environment: str = "development"

    database_url: str = "postgresql+psycopg2://miturno:miturno@db:5432/miturno"
    redis_url: str = "redis://redis:6379/0"

    # CORS: orígenes permitidos del frontend, separados por coma.
    cors_origins: str = "http://localhost:5173"

    # Email (SMTP). Si smtp_host queda vacío, los correos se imprimen en consola.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "MiTurno <no-reply@miturno.local>"
    smtp_tls: bool = True

    # URL pública del frontend, para armar enlaces (cancelación, etc.).
    frontend_url: str = "http://localhost:5173"

    # Seguridad / JWT.
    secret_key: str = "cambiar-esta-clave-en-produccion"
    token_exp_minutes: int = 60 * 24 * 30  # 30 días: sesión persistente

    # Regla de negocio: anticipación mínima para cancelar (minutos).
    cancelacion_min_anticipacion: int = 20

    # IA: Groq tiene prioridad si está configurado, luego Anthropic, luego fallback local.
    groq_api_key: str = ""
    anthropic_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # WhatsApp Gateway (Evolution API auto-hospedada en Docker). Si la URL queda
    # vacía, los mensajes de WhatsApp se imprimen en consola (modo desarrollo).
    evolution_api_url: str = ""
    evolution_api_key: str = ""
    # URL del webhook del backend que Evolution invoca por cada mensaje entrante.
    evolution_webhook_url: str = "http://backend:8000/webhook/whatsapp"
    # Horas que dura la oferta de un turno liberado antes de pasar al siguiente.
    lista_espera_oferta_horas: int = 2

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
