import re
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    database_url: str = "sqlite:///./coach.db"
    cors_origins: str = "http://localhost:3000"
    app_env: str = "development"

    @field_validator("database_url", mode="after")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if not v:
            return "sqlite:///./coach.db"
        # Supabase and Heroku often provide postgres:// instead of postgresql://
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg2://", 1)
        elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
            v = v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

settings = Settings()

