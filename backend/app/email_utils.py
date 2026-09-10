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
import queue
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from .config import settings

logger = logging.getLogger("qclonejob.email")


# Email log rows are buffered and written by a background worker.
#
# Writing them inline opened a SECOND database connection while the caller's
# transaction was still open. On SQLite that deadlocks ("database is locked")
# and could abort a whole bulk upload; on Postgres it wastes a connection from
# a small pool. Buffering keeps logging completely off the request path.
_log_queue: "queue.Queue[dict]" = queue.Queue(maxsize=1000)
_worker_started = False
_worker_lock = threading.Lock()


def _drain_queue() -> None:
    from .database import SessionLocal
    from . import models
    while True:
        item = _log_queue.get()
        try:
            db = SessionLocal()
            try:
                db.add(models.EmailLog(**item))
                db.commit()
            finally:
                db.close()
        except Exception as e:                   # pragma: no cover
            logger.warning("Could not write email log: %s", e)
        finally:
            _log_queue.task_done()


def _ensure_worker() -> None:
    global _worker_started
    if _worker_started:
        return
    with _worker_lock:
        if _worker_started:
            return
        threading.Thread(target=_drain_queue, daemon=True, name="email-log").start()
        _worker_started = True


def _log(to_email: str, subject: str, kind: str, status: str, error: str | None = None) -> None:
    """Queue the attempt for background writing. Never blocks or fails the caller."""
    try:
        _ensure_worker()
        _log_queue.put_nowait({
            "to_email": to_email, "subject": subject[:250], "kind": kind, "status": status,
            "error": (error or "")[:1000] or None,
            "provider": settings.SMTP_HOST if settings.EMAIL_ENABLED else "console",
        })
    except queue.Full:                           # pragma: no cover
        logger.warning("Email log queue full; dropping entry for %s", to_email)
    except Exception as e:                       # pragma: no cover
        logger.warning("Could not queue email log: %s", e)


def _send_via_brevo(to_email: str, subject: str, body: str) -> dict:
    """Brevo transactional email — 300/day free, forever, no card.

    WHY NOT THE CAMPAIGN API
    ------------------------
    The Brevo sample you may have seen uses EmailCampaignsApi /
    create_email_campaign. That is the wrong tool here. Campaigns are marketing
    sends: they go to saved contact LISTS (listIds), are scheduled rather than
    immediate, and are subject to marketing unsubscribe handling. An OTP or a
    set of login credentials is a one-to-one transactional message that must
    arrive in seconds, addressed to someone who may not be in any list.

    Brevo's own name for the right endpoint is "Transactional emails":
        POST https://api.brevo.com/v3/smtp/email
    which is exactly what TransactionalEmailsApi.send_transac_email calls.

    WHY PLAIN HTTPS AND NOT sib_api_v3_sdk
    --------------------------------------
    The SDK is a thin wrapper over this same endpoint. Calling it directly
    keeps the deployment free of an extra dependency (the SDK pulls in its own
    pinned urllib3/certifi, which is a common source of install conflicts on
    Render). No functionality is lost — the payload below is what the SDK
    would send. If you would rather use the SDK, install sib-api-v3-sdk and
    swap this function body; nothing else changes.
    """
    import json
    import urllib.error
    import urllib.request

    sender_email = (getattr(settings, "BREVO_SENDER_EMAIL", "")
                    or settings.EMAIL_FROM or "no-reply@qclonejob.com")
    payload = json.dumps({
        "sender": {"name": getattr(settings, "BREVO_SENDER_NAME", "QCloneJob"),
                   "email": sender_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": body,
    }).encode()

    req = urllib.request.Request(
        getattr(settings, "BREVO_BASE_URL", "https://api.brevo.com/v3/smtp/email"),
        data=payload, method="POST",
        headers={"api-key": getattr(settings, "BREVO_API_KEY", ""),
                 "accept": "application/json",
                 "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            json.loads(r.read().decode("utf-8", "replace") or "{}")
        logger.info("Email sent to %s via Brevo (%s)", to_email, subject)
        return {"ok": True, "status": "sent"}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        # Turn the two failures that actually happen on first run into advice
        # rather than a bare status code.
        if e.code == 401:
            detail = ("Brevo rejected the API key. Check BREVO_API_KEY — it must be a "
                      "v3 API key from Brevo -> SMTP & API -> API Keys, not your "
                      "account password. Server said: " + detail)
        elif e.code == 400 and "sender" in detail.lower():
            detail = (f"Brevo refused the sender '{sender_email}'. Verify that address "
                      "under Senders, Domains & Dedicated IPs -> Senders first. "
                      "Server said: " + detail)
        logger.error("Brevo send failed (%s): %s", e.code, detail)
        return {"ok": False, "status": "failed", "error": detail}
    except Exception as e:
        logger.error("Brevo send failed: %s", e)
        return {"ok": False, "status": "failed", "error": f"Email provider unreachable: {e}"}


def _send_via_resend(to_email: str, subject: str, body: str) -> dict:
    """Resend transactional email over HTTPS.

    MailerSend is a drop-in alternative if you prefer it — same shape, change
    the URL to https://api.mailersend.com/v1/email and rename `from`/`to` to
    MailerSend's nested objects.
    """
    import json
    import urllib.error
    import urllib.request

    payload = json.dumps({
        "from": settings.EMAIL_FROM or "no-reply@qclonejob.com",
        "to": [to_email],
        "subject": subject,
        "text": body,
    }).encode()
    req = urllib.request.Request(
        getattr(settings, "RESEND_BASE_URL", "https://api.resend.com/emails"),
        data=payload, method="POST",
        headers={"Authorization": f"Bearer {getattr(settings, 'RESEND_API_KEY', '')}",
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            json.loads(r.read().decode("utf-8", "replace"))
        logger.info("Email sent to %s via Resend (%s)", to_email, subject)
        return {"ok": True, "status": "sent"}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        # The most common first-run failure is an unverified sender domain, so
        # say that instead of surfacing a bare 403.
        if e.code in (401, 403):
            detail = ("Resend rejected the request. Check RESEND_API_KEY, and that "
                      f"EMAIL_FROM ('{settings.EMAIL_FROM}') uses a domain you have "
                      "verified in Resend. Server said: " + detail)
        logger.error("Resend send failed (%s): %s", e.code, detail)
        return {"ok": False, "status": "failed", "error": detail}
    except Exception as e:
        logger.error("Resend send failed: %s", e)
        return {"ok": False, "status": "failed", "error": f"Email provider unreachable: {e}"}


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

    # --- Resend first (HTTPS API, 3,000 emails/month free, no card) ---------
    # Preferred over SMTP because outbound port 25/465/587 is blocked on many
    # PaaS hosts, which is the usual reason "email silently doesn't work" in
    # production while it works locally.
    provider = (getattr(settings, "EMAIL_PROVIDER", "smtp") or "smtp").lower()
    if provider == "brevo" and getattr(settings, "BREVO_API_KEY", ""):
        r = _send_via_brevo(to_email, subject, body)
        _log(to_email, subject, kind, "sent" if r["ok"] else "failed", r.get("error"))
        return r
    if provider == "resend" and getattr(settings, "RESEND_API_KEY", ""):
        r = _send_via_resend(to_email, subject, body)
        _log(to_email, subject, kind, "sent" if r["ok"] else "failed", r.get("error"))
        return r

    if not (settings.SMTP_USER and settings.SMTP_PASSWORD):
        err = ("No email provider is configured. Set BREVO_API_KEY "
               "(EMAIL_PROVIDER=brevo), RESEND_API_KEY, or SMTP_USER / SMTP_PASSWORD.")
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
