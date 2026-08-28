"""Email sending with delivery logging.

Every attempt is recorded in the `email_logs` table with its real outcome, so a
silent failure is impossible to miss: Admin > Reports shows exactly what was sent,
what failed, and why.

When EMAIL_ENABLED is False the message is printed to the console and logged with
status "console" — useful in development, and clearly distinguished from a real send.

Gmail needs an App Password (2-Step Verification must be on). Easiest setup:
    python setup_email.py
"""
import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from .config import settings

logger = logging.getLogger("qclonejob.email")


def _log(to_email: str, subject: str, kind: str, status: str, error: str | None = None) -> None:
    """Record the attempt. Never let logging break the calling flow."""
    try:
        from .database import SessionLocal
        from . import models
        db = SessionLocal()
        try:
            db.add(models.EmailLog(
                to_email=to_email, subject=subject[:250], kind=kind, status=status,
                error=(error or "")[:1000] or None,
                provider=settings.SMTP_HOST if settings.EMAIL_ENABLED else "console",
            ))
            db.commit()
        finally:
            db.close()
    except Exception as e:                       # pragma: no cover
        logger.warning("Could not write email log: %s", e)


def send_email(to_email: str, subject: str, body: str, kind: str = "other") -> dict:
    """Send one email.

    Returns {"ok": bool, "status": ..., "error": ...} instead of raising, so callers
    can tell the user the truth about delivery. Nothing is swallowed silently.
    """
    if not settings.EMAIL_ENABLED:
        print("\n" + "=" * 70)
        print(f"[EMAIL - console mode]  To: {to_email}")
        print(f"Subject: {subject}")
        print("-" * 70)
        print(body)
        print("=" * 70 + "\n", flush=True)
        _log(to_email, subject, kind, "console")
        return {"ok": True, "status": "console",
                "message": "Email is switched off, so it was printed to the server console. "
                           "Run `python setup_email.py` to send real emails."}

    if not (settings.SMTP_USER and settings.SMTP_PASSWORD):
        err = "SMTP_USER / SMTP_PASSWORD are not set."
        _log(to_email, subject, kind, "failed", err)
        return {"ok": False, "status": "failed", "error": err}

    msg = MIMEMultipart()
    msg["From"] = settings.EMAIL_FROM or settings.SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        ctx = ssl.create_default_context()
        if int(settings.SMTP_PORT) == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, int(settings.SMTP_PORT),
                                  context=ctx, timeout=25) as s:
                s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                s.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, int(settings.SMTP_PORT), timeout=25) as s:
                s.ehlo(); s.starttls(context=ctx); s.ehlo()
                s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                s.send_message(msg)
        logger.info("Email sent to %s (%s)", to_email, subject)
        _log(to_email, subject, kind, "sent")
        return {"ok": True, "status": "sent"}

    except smtplib.SMTPAuthenticationError as e:
        err = ("SMTP login was rejected. For Gmail you need a 16-character App Password "
               "(2-Step Verification must be on). For Brevo/Mailjet use the SMTP key, "
               f"not the account password. Server said: {e}")
    except smtplib.SMTPSenderRefused as e:
        err = (f"The sender address '{settings.EMAIL_FROM}' was refused — it must be "
               f"verified with your email provider first. Server said: {e}")
    except smtplib.SMTPRecipientsRefused as e:
        err = f"The recipient address was refused: {e}"
    except (smtplib.SMTPConnectError, OSError, TimeoutError) as e:
        err = (f"Could not reach {settings.SMTP_HOST}:{settings.SMTP_PORT}. The port may be "
               f"blocked by your network or host. Detail: {e}")
    except Exception as e:
        err = f"{type(e).__name__}: {e}"

    logger.error("Email FAILED to %s: %s", to_email, err)
    _log(to_email, subject, kind, "failed", err)
    return {"ok": False, "status": "failed", "error": err}


def send_credentials_email(to_email: str, name: str, user_id: str, password: str) -> dict:
    subject = f"Your {settings.APP_NAME} login credentials"
    body = (
        f"Dear {name},\n\n"
        f"An account has been created for you on {settings.APP_NAME}.\n\n"
        f"  User ID  : {user_id}\n"
        f"  Password : {password}\n\n"
        f"These credentials work on both the web and mobile apps.\n"
        f"Please log in and change your password.\n\n"
        f"Login here: {settings.FRONTEND_URL}\n\n"
        f"Regards,\n{settings.APP_NAME} Team"
    )
    return send_email(to_email, subject, body, kind="credentials")


def send_application_email(recruiter_email: str, candidate_name: str, position: str,
                           job_code: str, location: str, education: str,
                           experience: str, key_skills: str) -> dict:
    subject = f'{candidate_name} - Application for "{position}", Job Code: {job_code}'
    body = (
        f"A new application has been received.\n\n"
        f"  Candidate name : {candidate_name}\n"
        f"  Position       : {position}\n"
        f"  Location       : {location}\n"
        f"  Education      : {education}\n"
        f"  Experience     : {experience}\n"
        f"  Key Skills     : {key_skills}\n\n"
        f"Log in to {settings.APP_NAME} to view the full resume.\n"
    )
    return send_email(recruiter_email, subject, body, kind="alert")
