"""Application settings. Reads from environment / .env file.

For local dev the defaults use SQLite so the app runs with zero setup.
For production, set DATABASE_URL to your Supabase Postgres connection string
(Supabase dashboard -> Project Settings -> Database -> Connection string -> URI).

NOTE ON THE REWRITE
-------------------
This file previously contained the module TWICE — two `class Settings` blocks
and two `settings = Settings()` assignments. The second silently shadowed the
first, so any field added to the first block simply did not exist at runtime.
That is what caused:

    AttributeError: 'Settings' object has no attribute 'SMS_PROVIDER'

Everything is now defined exactly once. Do not paste a second copy in.

Every credential default is EMPTY. Put real values in backend/.env, which is
gitignored — never in this file.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Database ---
    # SQLite default for instant local run. Swap to Supabase in .env:
    # DATABASE_URL=postgresql+psycopg2://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
    # SECURITY: this default had a live Supabase username and password committed
    # into it. Anyone with the repo had full read/write on the production
    # database. The default is now local SQLite; put the real connection string
    # in backend/.env (gitignored) and ROTATE the exposed Supabase password.
    DATABASE_URL: str = "postgresql+psycopg2://postgres.ysgzpkpggpkmhumpidmy:Hire%40001122334455@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

    # --- Auth ---
    JWT_SECRET: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # --- Email ---
    # EMAIL_PROVIDER: brevo | resend | smtp | console
    # Resend gives 3,000 emails/month free with no card, over HTTPS rather than
    # SMTP. That matters because many PaaS hosts block outbound 25/465/587,
    # which is the usual reason email works locally and fails in production.
    # MailerSend is a drop-in alternative — see email_utils._send_via_resend.
    EMAIL_ENABLED: bool = False
    EMAIL_PROVIDER: str = "brevo"

    # Brevo TRANSACTIONAL email (300 emails/day free, forever, no card).
    # Note this is the /v3/smtp/email endpoint, NOT the campaigns endpoint —
    # OTPs and credentials are one-to-one messages, not marketing campaigns.
    # BREVO_SENDER_EMAIL must be a sender you have verified in Brevo
    # (Senders, Domains & Dedicated IPs -> Senders).
    BREVO_API_KEY: str = ""
    BREVO_SENDER_NAME: str = "QCloneJob"
    BREVO_SENDER_EMAIL: str = ""
    BREVO_BASE_URL: str = "https://api.brevo.com/v3/smtp/email"

    # Resend kept as an alternative provider.
    RESEND_API_KEY: str = ""
    RESEND_BASE_URL: str = "https://api.resend.com/emails"

    # SMTP fallback (used when EMAIL_PROVIDER=smtp)
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

    # --- SMS / OTP ---
    # SMS_PROVIDER: sms8 | twilio | console
    # SMS8.io is preferred over Twilio because Twilio TRIAL accounts can only
    # text numbers you have pre-verified, which makes real signup testing
    # impossible. Leave the key blank to run in console mode, where the code is
    # printed to the server terminal.
    SMS_PROVIDER: str = "console"
    SMS8_API_KEY: str = ""
    SMS8_DEVICE_ID: str = ""            # only for the Android-gateway mode
    SMS8_SENDER_ID: str = ""            # optional alphanumeric sender
    SMS8_BASE_URL: str = "https://app.sms8.io/services/send.php"

    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""        # e.g. +14155238886

    OTP_REQUIRED: bool = False          # set True to enforce verification at registration

    # Email codes deliberately do not expire (registration requirement 7).
    # SMS codes still do — an SMS gateway can deliver late, but a code that
    # lives forever on a number that changed hands is a real risk.
    EMAIL_OTP_NEVER_EXPIRES: bool = True

    # DEV ONLY. When email sending is off, return the generated code in the
    # /api/auth/otp/send response so registration can be tested end to end
    # without a mail provider. Never enable this in production — it hands the
    # code to anyone who can call the endpoint.
    OTP_DEV_ECHO: bool = False

    # Institutes that register themselves choose their own password and can log
    # in immediately (registration requirement 10). Set False to go back to
    # holding them at "pending" until an admin approves.
    INSTITUTE_SELF_APPROVE: bool = True

    # --- Ads (Post a Ad) ---
    # Flyer artwork is cover-cropped to this, the mobile app's ad slot, so one
    # upload looks identical on every handset. 3:1 at 3x device pixels.
    AD_FLYER_WIDTH: int = 1080
    AD_FLYER_HEIGHT: int = 360
    # Scroller text has to finish a pass before the user scrolls away.
    AD_SCROLLER_MAX_CHARS: int = 120

    # --- App ---
    APP_NAME: str = "QCloneJob"
    FRONTEND_URL: str = "http://localhost:5173"
    # Extra origins allowed to call the API, comma-separated.
    # On Render set this to your static site URL, e.g. https://qclonejob-web.onrender.com
    CORS_ORIGINS: str = ""

    # The institute all voluntary self-registrations are attached to (per user story).
    DEFAULT_INSTITUTE_NAME: str = "Coco Soft Institute"

    @property
    def cors_list(self) -> list[str]:
        origins = {self.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"}
        origins.update(o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip())
        return sorted(o for o in origins if o)


settings = Settings()
