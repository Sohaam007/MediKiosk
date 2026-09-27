"""Application configuration management.

All configuration is read from environment variables (or .env file in development).
Sensitive fields use pydantic SecretStr to prevent accidental logging.

Usage:
    from medikiosk.adapters.config import get_settings
    settings = get_settings()
    api_key = settings.gemini_api_key.get_secret_value()

NEVER call settings.gemini_api_key directly in a log statement.
NEVER store the result of .get_secret_value() in a variable that could be logged.
"""

from __future__ import annotations

from enum import Enum
from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMProvider(str, Enum):
    """Supported LLM provider backends."""

    GEMINI = "gemini"
    OPENAI = "openai"


class LogLevel(str, Enum):
    """Supported log levels."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All sensitive fields are SecretStr to prevent accidental logging.
    Call .get_secret_value() only at the point of use (e.g. inside an adapter).

    Attributes:
        llm_provider: Which LLM backend to use (gemini or openai).
        gemini_api_key: Google Gemini API key.
        openai_api_key: OpenAI API key.
        database_url: SQLAlchemy async database URL.
        redis_url: Redis connection URL (optional).
        abdm_api_url: ABDM gateway base URL.
        abdm_client_id: ABDM OAuth client ID.
        abdm_client_secret: ABDM OAuth client secret.
        cors_origins: Comma-separated allowed CORS origins.
        api_key: Internal API key for kiosk-to-backend authentication.
        debug: Enable debug mode (never True in production).
        session_ttl_seconds: Session expiry in seconds.
        log_level: Logging verbosity.
        storage_base_path: Base path for local file storage.
        max_upload_size_bytes: Maximum allowed upload size.
        llm_max_input_tokens: Hard token ceiling for LLM input.
        llm_max_output_tokens: Hard token ceiling for LLM output.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM Provider ──────────────────────────────────────────────────────
    llm_provider: LLMProvider = Field(
        default=LLMProvider.GEMINI,
        description="LLM backend to use.",
    )
    gemini_api_key: SecretStr = Field(
        default=SecretStr(""),
        description="Google Gemini API key. Required when llm_provider=gemini.",
    )
    openai_api_key: SecretStr = Field(
        default=SecretStr(""),
        description="OpenAI API key. Required when llm_provider=openai.",
    )
    gemini_model: str = Field(
        default="gemini-1.5-flash",
        description="Gemini model name.",
    )
    openai_model: str = Field(
        default="gpt-4o-mini",
        description="OpenAI model name.",
    )

    # ── Database ──────────────────────────────────────────────────────────
    database_url: str = Field(
        default="sqlite+aiosqlite:///./medikiosk.db",
        description="SQLAlchemy async database URL. Use asyncpg for PostgreSQL in production.",
    )

    # ── Cache ─────────────────────────────────────────────────────────────
    redis_url: str | None = Field(
        default=None,
        description="Redis connection URL. Optional — falls back to in-memory cache if absent.",
    )

    # ── ABDM Gateway ──────────────────────────────────────────────────────
    abdm_api_url: str = Field(
        default="https://dev.abdm.gov.in",
        description="ABDM gateway base URL.",
    )
    abdm_client_id: str = Field(
        default="",
        description="ABDM OAuth 2.0 client ID.",
    )
    abdm_client_secret: SecretStr = Field(
        default=SecretStr(""),
        description="ABDM OAuth 2.0 client secret.",
    )

    # ── API & Security ────────────────────────────────────────────────────
    cors_origins: str = Field(
        default="http://localhost:3000",
        description="Comma-separated list of allowed CORS origins.",
    )
    api_key: SecretStr = Field(
        default=SecretStr(""),
        description="Internal API key for kiosk-to-backend authentication.",
    )

    # ── Application ───────────────────────────────────────────────────────
    debug: bool = Field(
        default=False,
        description="Enable debug mode. MUST be False in production.",
    )
    session_ttl_seconds: int = Field(
        default=3600,
        gt=0,
        description="Session TTL in seconds. Default: 1 hour.",
    )
    log_level: LogLevel = Field(
        default=LogLevel.INFO,
        description="Log verbosity level.",
    )

    # ── Storage ───────────────────────────────────────────────────────────
    storage_base_path: str = Field(
        default="./storage",
        description="Base directory for local file storage (audio, scans).",
    )
    max_upload_size_bytes: int = Field(
        default=10 * 1024 * 1024,  # 10 MB
        gt=0,
        description="Maximum allowed file upload size in bytes.",
    )

    # ── LLM Safety ────────────────────────────────────────────────────────
    llm_max_input_tokens: int = Field(
        default=8192,
        gt=0,
        description="Hard token ceiling for LLM input. Prevents token-bomb DoS.",
    )
    llm_max_output_tokens: int = Field(
        default=4096,
        gt=0,
        description="Hard token ceiling for LLM output.",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse cors_origins string into a list of origins.

        Returns:
            List of stripped, non-empty origin strings.
        """
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        """True if running in production mode (debug=False)."""
        return not self.debug


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached application settings.

    Uses lru_cache so environment variables are read only once per process.
    In tests, call get_settings.cache_clear() to reset between test cases.

    Returns:
        Cached Settings instance.
    """
    return Settings()
