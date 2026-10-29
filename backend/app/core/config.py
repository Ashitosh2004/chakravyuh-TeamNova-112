"""Environment-based configuration. No credentials are ever hardcoded."""

from __future__ import annotations

import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
_SECRET_FILE = BACKEND_DIR / ".session_secret"


def _dev_secret() -> str:
    """Development-only fallback: persist a random secret in a local file.

    Production (ENVIRONMENT=production) requires SESSION_SECRET to be set.
    """
    if _SECRET_FILE.exists():
        return _SECRET_FILE.read_text(encoding="utf-8").strip()
    value = secrets.token_urlsafe(48)
    try:
        _SECRET_FILE.write_text(value, encoding="utf-8")
    except OSError:
        pass
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    APP_NAME: str = "CHAKRAVYUH"
    ENVIRONMENT: str = "development"  # development | production
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # HTTP
    API_HOST: str = "127.0.0.1"
    API_PORT: int = 8000
    CORS_ORIGINS: str = "http://127.0.0.1:5173,http://localhost:5173"
    REQUEST_BODY_LIMIT_BYTES: int = 256 * 1024  # strict limit; code submissions stay well below it

    # MongoDB
    MONGODB_URI: str = "mongodb://127.0.0.1:27017"
    MONGODB_DB: str = "chakravyuh"

    # Sessions / auth
    SESSION_SECRET: str = ""
    SESSION_TTL_MINUTES: int = 720       # 12 h access (cookie) lifetime
    REFRESH_TTL_DAYS: int = 14
    COOKIE_SECURE: str = "auto"          # auto | true | false
    BCRYPT_ROUNDS: int = 12

    # Rate limiting (requests per minute per key)
    RATE_LIMIT_AUTH_PER_MIN: int = 10
    RATE_LIMIT_AI_PER_MIN: int = 30

    # AI provider (never shipped to the client)
    AI_PROVIDER: str = ""                # "" (unset) | openai | openai_compatible | anthropic
    AI_API_KEY: str = ""
    AI_BASE_URL: str = ""                # optional override; provider default otherwise
    AI_MODEL: str = ""
    AI_TIMEOUT_SECONDS: int = 60
    AI_MAX_OUTPUT_TOKENS: int = 1500
    AI_MAX_HISTORY_MESSAGES: int = 20

    # Optional email delivery for password reset (standard SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_TLS: bool = True

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def cookie_secure(self) -> bool:
        if self.COOKIE_SECURE.lower() == "true":
            return True
        if self.COOKIE_SECURE.lower() == "false":
            return False
        return self.is_production  # auto

    @property
    def secret_key(self) -> str:
        if self.SESSION_SECRET:
            return self.SESSION_SECRET
        if self.is_production:
            raise RuntimeError("SESSION_SECRET must be configured in production.")
        return _dev_secret()

    @property
    def ai_configured(self) -> bool:
        return bool(self.AI_PROVIDER and self.AI_API_KEY and self.AI_MODEL)

    def validate_environment(self) -> list[str]:
        """Return actionable configuration warnings (never secret values)."""
        problems: list[str] = []
        if self.is_production:
            if not self.SESSION_SECRET:
                problems.append("SESSION_SECRET is required in production.")
            if self.COOKIE_SECURE == "false":
                problems.append("COOKIE_SECURE=false is not safe for production (HTTPS required).")
            if self.AI_PROVIDER and self.AI_PROVIDER not in ("openai", "openai_compatible", "anthropic"):
                problems.append(f"AI_PROVIDER '{self.AI_PROVIDER}' is not supported (openai, openai_compatible, anthropic).")
        return problems


settings = Settings()
