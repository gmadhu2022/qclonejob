from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

# Values copied straight out of .env.example that were never replaced.
PLACEHOLDERS = ("abcdefghijklm", "YOURREF", "YOUR-PASSWORD", "YOURPASSWORD",
                "YourEncodedPassword", "[YOUR-PASSWORD]", "yourpassword",
                "<YOUR-PROJECT-REF>", "<YOUR-PASSWORD>", "<YOUR-POOLER-HOST>",
                "YOUR-PROJECT-REF", "YOUR-POOLER-HOST")


def _check_placeholders(url: str) -> None:
    hit = next((p for p in PLACEHOLDERS if p in url), None)
    if not hit:
        return
    raise RuntimeError(
        f"\n\nDATABASE_URL still contains the example placeholder '{hit}'.\n"
        "Open backend/.env and replace it with your real Supabase values.\n\n"
        "  Supabase > Connect > Connection string > URI (Session pooler)\n\n"
        "The user part must be  postgres.<your-project-ref>  — the ref is the random\n"
        "string in your project URL, e.g. https://supabase.com/dashboard/project/THIS-PART\n\n"
        "Then run:  python check_db.py\n"
    )


_check_placeholders(settings.DATABASE_URL)

# SQLite needs a special connect arg; Postgres (Supabase) does not.
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
