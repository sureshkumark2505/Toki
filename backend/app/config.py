import re
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_live_model: str = "gemini-2.5-flash-native-audio-latest"
    database_url: str = "sqlite:///./coach.db"
    cors_origins: str = "*"
    app_env: str = "development"
    streak_min_meaningful_turns: int = 4
    streak_min_spoken_words: int = 40
    app_timezone: str = "Asia/Kolkata"

    @field_validator("database_url", mode="after")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if not v:
            return "sqlite:///./coach.db"
        v = v.strip().strip("'").strip('"')
        if v.startswith("//"):
            v = "postgresql+psycopg2:" + v
        elif v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg2://", 1)
        elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
            v = v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

settings = Settings()

