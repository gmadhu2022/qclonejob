import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import (auth, admin, enterprise, institute, jobseeker, public,
                      chat, health, uploads, notifications, ai, admin_extra)
from .migrate import sync_schema

# Create tables on startup (for production use Alembic migrations instead).
try:
    Base.metadata.create_all(bind=engine)
    sync_schema()   # add any columns missing from an existing database
except Exception as exc:                                  # pragma: no cover
    raise RuntimeError(
        "\n\nCould not connect to the database.\n\n"
        f"  {type(exc).__name__}: {str(exc).splitlines()[0][:200]}\n\n"
        "Run this for a plain-English diagnosis and the exact fix:\n"
        "    python check_db.py\n"
    ) from None   # add any columns missing from an existing database

def _cors_origins() -> list[str]:
    """Origins allowed to call this API.

    Computed here (not read from a Settings property) so the app still boots if
    config.py is an older revision — a mismatched deploy shouldn't take the API down.
    """
    origins = {
        getattr(settings, "FRONTEND_URL", "") or "",
        "http://localhost:5173",
        "http://localhost:3000",
    }
    extra = os.environ.get("CORS_ORIGINS") or getattr(settings, "CORS_ORIGINS", "") or ""
    origins.update(o.strip().rstrip("/") for o in extra.split(",") if o.strip())
    return sorted(o for o in origins if o)


app = FastAPI(title=f"{settings.APP_NAME} API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    # Allow Render preview/subdomain URLs too (e.g. https://qclonejob-web-abc.onrender.com)
    allow_origin_regex=r"https://.*\.onrender\.com|https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(public.router)
app.include_router(admin.router)
app.include_router(enterprise.router)
app.include_router(institute.router)
app.include_router(jobseeker.router)
app.include_router(chat.router)
app.include_router(health.router)
app.include_router(notifications.router)
app.include_router(uploads.router)
app.include_router(ai.router)
app.include_router(admin_extra.router)

# Serve uploaded images (swap for Supabase Storage in production)
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.on_event("startup")
def _startup_checks() -> None:
    """Warn about configuration that silently breaks in production."""
    import os
    on_render = bool(os.environ.get("RENDER"))
    if on_render:
        if settings.DATABASE_URL.startswith("sqlite"):
            print("\n" + "!" * 72)
            print("  WARNING: running on Render with SQLite.")
            print("  Render's disk is EPHEMERAL — every deploy wipes the database.")
            print("  Set DATABASE_URL to your Supabase connection string.")
            print("!" * 72 + "\n", flush=True)
        print("[startup] Uploaded files are stored on local disk and are LOST on each "
              "deploy. Move _store() in app/routers/uploads.py to Supabase Storage "
              "before real users rely on it.", flush=True)
    print(f"[startup] CORS allows: {_cors_origins()}", flush=True)


APP_REVISION = "2026.08.28-r2"   # bump when shipping; surfaced by /healthz


@app.get("/healthz")
def healthz():
    """Health check for Render. Also reports what's actually deployed, so a
    partial upload (new main.py + old config.py) is obvious immediately."""
    return {
        "status": "ok",
        "revision": APP_REVISION,
        "database": "postgres" if not settings.DATABASE_URL.startswith("sqlite") else "sqlite",
        "cors_origins": _cors_origins(),
        "ai_enabled": bool(getattr(settings, "AI_ENABLED", False) and getattr(settings, "GROQ_API_KEY", "")),
        "email_enabled": bool(getattr(settings, "EMAIL_ENABLED", False)),
    }


@app.get("/")
def root():
    return {"app": settings.APP_NAME, "status": "ok", "docs": "/docs"}
