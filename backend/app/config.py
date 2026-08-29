"""Application settings. Reads from environment / .env file.

For local dev the defaults use SQLite so the app runs with zero setup.
For production, set DATABASE_URL to your Supabase Postgres connection string
(Supabase dashboard -> Project Settings -> Database -> Connection string -> URI).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Database ---
    # SQLite default for instant local run. Swap to Supabase in .env:
    # DATABASE_URL=postgresql+psycopg2://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
    DATABASE_URL: str = "postgresql+psycopg2://postgres.ysgzpkpggpkmhumpidmy:Hire%40001122334455@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

    # --- Auth ---
    JWT_SECRET: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # --- Email (SMTP). If EMAIL_ENABLED is False, emails are printed to console. ---
    EMAIL_ENABLED: bool = True
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "gmadhudatascientist@gmail.com"
    SMTP_PASSWORD: str = "zupgkxthbtlqrkgu"
    EMAIL_FROM: str = "gmadhudatascientist@gmail.com"

    # --- AI (Groq) ---
    # Get a free key at https://console.groq.com/keys
    AI_ENABLED: bool = True
    GROQ_API_KEY: str = ""
    # Model IDs change over time. Check what YOUR key supports:
    #   GET /api/ai/models   (or console.groq.com/docs/models)
    GROQ_MODEL: str = "openai/gpt-oss-20b"

    # --- App ---
    APP_NAME: str = "Hire"
    FRONTEND_URL: str = "http://localhost:5173"
    # The institute all voluntary self-registrations are attached to (per user story).
    DEFAULT_INSTITUTE_NAME: str = "Coco Soft Institute"

    @property
    def cors_list(self) -> list[str]:
        origins = {self.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"}
        origins.update(o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip())
        return sorted(o for o in origins if o)
    # The institute all voluntary self-registrations are attached to (per user story).
    DEFAULT_INSTITUTE_NAME: str = "Coco Soft Institute"


settings = Settings()
