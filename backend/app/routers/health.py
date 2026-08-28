from fastapi import APIRouter, Depends
from ..auth import require_role
from .. import models
from ..email_utils import send_email
from ..config import settings

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("/email-config")
def email_config(current: models.User = Depends(require_role(models.ROLE_ADMIN))):
    """Show the current email configuration (without exposing the password)."""
    return {
        "email_enabled": settings.EMAIL_ENABLED,
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_user": settings.SMTP_USER,
        "email_from": settings.EMAIL_FROM,
        "password_set": bool(settings.SMTP_PASSWORD),
    }


@router.post("/email-test")
def email_test(body: dict, current: models.User = Depends(require_role(models.ROLE_ADMIN))):
    """Send a test email to verify SMTP works. Body: {"to": "you@gmail.com"}.
    Returns the real error if it fails, so you can diagnose Gmail auth issues."""
    to = body.get("to")
    if not to:
        return {"ok": False, "error": "Provide a 'to' address."}
    try:
        send_email(to, f"{settings.APP_NAME} test email",
                   "This is a test email from your Hire backend. If you received it, SMTP works.")
        mode = "console (EMAIL_ENABLED is False)" if not settings.EMAIL_ENABLED else "SMTP"
        return {"ok": True, "sent_via": mode, "to": to}
    except Exception as e:
        return {"ok": False, "error": str(e)}
