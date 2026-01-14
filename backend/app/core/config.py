"""Application configuration settings."""

import json
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import urlparse


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parse CORS_ORIGINS from JSON string or list."""
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                # If not valid JSON, treat as comma-separated
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v if isinstance(v, list) else []

    # Application
    APP_NAME: str = "BizPilot"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/bizpilot"

    # Redis (Optional - for caching and sessions when implemented)
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_set(cls, v: str) -> str:
        """Validate that SECRET_KEY is set and not empty."""
        if v == "" or len(v) < 16:
            raise ValueError(
                "SECRET_KEY must be set and at least 16 characters. "
                "Generate one with: openssl rand -hex 32"
            )
        return v

    @field_validator("COOKIE_DOMAIN", mode="before")
    @classmethod
    def parse_cookie_domain(cls, v: str) -> str:
        if not isinstance(v, str):
            return ""
        value = v.strip()
        if value == "":
            return ""
        parsed = urlparse(value)
        if parsed.scheme and parsed.netloc:
            value = parsed.netloc
        value = value.split("/")[0]
        return value

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    # Email
    EMAILS_ENABLED: bool = False
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TIMEOUT: int = 10
    SMTP_STARTTLS: bool = False
    EMAILS_FROM_EMAIL: str = "noreply@bizpilot.com"
    EMAILS_FROM_NAME: str = "BizPilot"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # OpenAI/Groq for AI Assistant
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # Paystack (South Africa Payment Gateway)
    PAYSTACK_SECRET_KEY: str = ""
    PAYSTACK_PUBLIC_KEY: str = ""
    
    # Frontend URL for callbacks
    FRONTEND_URL: str = "http://localhost:3000"

    # Cookie settings for web auth
    COOKIE_DOMAIN: str = ""  # Leave empty for localhost
    COOKIE_SECURE: bool = False  # Set to True in production (HTTPS)
    COOKIE_SAMESITE: str = "lax"  # 'lax' for same-origin, 'none' for cross-origin (requires Secure)

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
