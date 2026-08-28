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
    DATABASE_URL: str = "sqlite:///./hire.db"

    # --- Auth ---
    JWT_SECRET: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # --- Email (SMTP). If EMAIL_ENABLED is False, emails are printed to console. ---
    EMAIL_ENABLED: bool = False
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "no-reply@qclonejob.com"

    # --- AI (Groq) ---
    # Get a free key at https://console.groq.com/keys
    AI_ENABLED: bool = False
    GROQ_API_KEY: str = ""
    # Model IDs change over time. Check what YOUR key supports:
    #   GET /api/ai/models   (or console.groq.com/docs/models)
    GROQ_MODEL: str = "openai/gpt-oss-20b"

    # --- App ---
    APP_NAME: str = "QCloneJob"
    FRONTEND_URL: str = "http://localhost:5173"
    # Extra origins allowed to call the API, comma-separated.
    # On Render set this to your static site URL, e.g. https://qclonejob-web.onrender.com
    CORS_ORIGINS: str = ""

    @property
    def cors_list(self) -> list[str]:
        origins = {self.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"}
        origins.update(o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip())
        return sorted(o for o in origins if o)
    # The institute all voluntary self-registrations are attached to (per user story).
    DEFAULT_INSTITUTE_NAME: str = "Coco Soft Institute"


settings = Settings()
