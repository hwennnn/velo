"""
Application configuration using Pydantic Settings.
Loads environment variables and provides type-safe configuration.
"""

from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """

    # Application settings
    app_name: str = "Velo Travel Expense Tracker"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: str = Field(
        default="development",
        description="Environment: development, staging, or production",
    )

    # API settings
    api_prefix: str = "/api"

    # Supabase configuration
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_anon_key: str = Field(..., description="Supabase anonymous public key")
    supabase_service_role_key: str = Field(
        ..., description="Supabase service role key (backend only)"
    )

    # Database configuration
    database_url: str = Field(..., description="PostgreSQL connection URL")
    db_echo: bool = Field(default=False, description="Echo SQL queries to console")
    db_pool_size: int = Field(default=20, description="Database connection pool size")
    db_max_overflow: int = Field(default=40, description="Max overflow connections")

    # JWT configuration
    jwt_secret: str = Field(..., description="Secret key for JWT verification")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")

    # CORS settings
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        description="Allowed CORS origins (comma-separated)",
    )

    # External API configuration
    currency_api_key: Optional[str] = Field(
        default=None, description="Currency exchange API key"
    )
    currency_api_url: str = Field(
        default="https://api.exchangerate-api.com/v4/latest/USD",
        description="Currency exchange API endpoint",
    )
    currency_cache_ttl: int = Field(
        default=3600, description="Currency cache TTL in seconds (1 hour)"
    )

    # Pagination defaults
    default_page_size: int = Field(default=20, description="Default items per page")
    max_page_size: int = Field(default=100, description="Maximum items per page")

    # Server configuration
    uvicorn_workers: int = Field(
        default=4, description="Number of uvicorn worker processes"
    )
    uvicorn_limit_concurrency: int = Field(
        default=1000, description="Maximum concurrent connections"
    )
    uvicorn_backlog: int = Field(default=2048, description="Maximum queued connections")

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Validate environment value."""
        allowed = ["development", "staging", "production"]
        if v.lower() not in allowed:
            raise ValueError(f"Environment must be one of: {', '.join(allowed)}")
        return v.lower()

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if isinstance(self.cors_origins, str):
            return [
                origin.strip()
                for origin in self.cors_origins.split(",")
                if origin.strip()
            ]
        return self.cors_origins

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"


# Global settings instance
settings = Settings()
