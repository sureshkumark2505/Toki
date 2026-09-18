from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    database_url: str = "sqlite:///./coach.db"
    cors_origins: str = "http://localhost:3000"
    app_env: str = "development"

settings = Settings()

