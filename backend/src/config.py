"""Configuración; solo la clave de mapas web se entrega al navegador."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    database_url: SecretStr = SecretStr("")
    cors_origins: Annotated[list[str], NoDecode] = []
    apisperu_token: SecretStr = SecretStr("")
    apisperu_base_url: str = "https://dniruc.apisperu.com/api/v1"
    google_maps_browser_key: str = ""
    google_geocoding_api_key: SecretStr = SecretStr("")
    geoapify_api_key: SecretStr = SecretStr("")
    external_api_timeout_seconds: float = 8
    session_hours: int = 12
    cookie_secure: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
