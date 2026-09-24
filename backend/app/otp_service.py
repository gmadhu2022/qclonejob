"""One-time passcodes for mobile and email verification.

SMS goes through Twilio when configured. If it isn't, the code is logged to the
server console instead of being sent — so the whole registration flow still works
in development without an SMS bill, and the difference is always visible in the
response (`delivery: "console"` vs `"sms"`).

Codes are stored as bcrypt hashes, never in plain text.
"""
import logging
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from . import models
from .auth import hash_password, verify_password
from .config import settings
from .email_utils import send_email

logger = logging.getLogger("qclonejob.otp")

CODE_TTL_MINUTES = 10
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 30


class OtpError(Exception):
    """Raised with a message safe to show the user."""


def _generate() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _recent(db: Session, target: str) -> models.OtpCode | None:
    return (db.query(models.OtpCode)
            .filter(models.OtpCode.target == target)
            .order_by(models.OtpCode.created_at.desc()).first())


def _send_via_sms8(to_number: str, body: str) -> dict:
    """SMS8.io gateway.

    Two modes, both hitting the same endpoint:
      - Android gateway: your own phone relays the SMS. Needs SMS8_DEVICE_ID
        and costs nothing beyond your normal SMS plan.
      - Credits: SMS8's own routes, using the free starting credits.

    Chosen over Twilio because Twilio trial accounts can only message numbers
    you have pre-verified, which makes real signup testing impossible.
    """
    import json
    import urllib.parse
    import urllib.request

    params = {"key": getattr(settings, "SMS8_API_KEY", ""), "number": to_number, "message": body}
    if getattr(settings, "SMS8_DEVICE_ID", ""):
        params["devices"] = settings.SMS8_DEVICE_ID
        params["type"] = "sms"
        params["prioritize"] = "1"
    else:
        params["type"] = "credits"
    if getattr(settings, "SMS8_SENDER_ID", ""):
        params["sender"] = settings.SMS8_SENDER_ID

    base = getattr(settings, "SMS8_BASE_URL", "https://app.sms8.io/services/send.php")
    url = f"{base}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            raw = r.read().decode("utf-8", "replace")
    except Exception as e:
        logger.error("SMS8 request failed: %s", e)
        return {"ok": False, "delivery": "failed", "error": f"SMS gateway unreachable: {e}"}

    # SMS8 returns JSON, but error pages come back as HTML — don't assume.
    try:
        data = json.loads(raw)
    except ValueError:
        logger.error("SMS8 returned non-JSON: %s", raw[:200])
        return {"ok": False, "delivery": "failed", "error": "SMS gateway returned an unexpected response."}

    if data.get("success"):
        return {"ok": True, "delivery": "sms", "provider": "sms8"}
    err = (data.get("error") or {}).get("message") if isinstance(data.get("error"), dict) else data.get("error")
    logger.error("SMS8 rejected the message: %s", err)
    return {"ok": False, "delivery": "failed", "error": str(err or "SMS could not be sent.")}


def _send_via_twilio(to_number: str, body: str) -> dict:
    """Kept as a fallback so existing Twilio deployments keep working."""
    try:
        from twilio.rest import Client
    except ImportError:
        return {"ok": False, "delivery": "failed",
                "error": "Twilio isn't installed on the server (pip install twilio)."}
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(to=to_number, from_=settings.TWILIO_FROM_NUMBER, body=body)
        return {"ok": True, "delivery": "sms", "provider": "twilio"}
    except Exception as e:
        logger.error("Twilio send failed: %s", e)
        msg = str(e)
        if "unverified" in msg.lower():
            msg = ("Twilio trial accounts can only text verified numbers. "
                   "Verify the number in your Twilio console, or upgrade the account.")
        return {"ok": False, "delivery": "failed", "error": msg}


def send_sms(to_number: str, body: str) -> dict:
    """Send an SMS via the configured provider, falling back to the console.

    Console mode is not a failure path — it's how development works without
    credentials, and the OTP is printed so signup can still be tested.
    """
    # getattr with defaults, not settings.X: a config file that predates these
    # fields should fall back to console mode, not raise AttributeError and
    # return a 500 in the middle of someone's signup.
    provider = (getattr(settings, "SMS_PROVIDER", "console") or "console").lower()

    if provider == "sms8" and getattr(settings, "SMS8_API_KEY", ""):
        return _send_via_sms8(to_number, body)
    if provider == "twilio" and getattr(settings, "TWILIO_ACCOUNT_SID", "") \
            and getattr(settings, "TWILIO_AUTH_TOKEN", ""):
        return _send_via_twilio(to_number, body)

    print("\n" + "=" * 66)
    print(f"[SMS - console mode]  To: {to_number}")
    print(body)
    print("=" * 66 + "\n", flush=True)
    return {"ok": True, "delivery": "console"}


def normalise_phone(raw: str) -> str:
    """Indian numbers: accept 10 digits and add +91; keep other +country formats."""
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())
    if not digits:
        raise OtpError("Enter a valid mobile number.")
    if (raw or "").strip().startswith("+"):
        return "+" + digits
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if len(digits) < 8:
        raise OtpError("That mobile number looks too short.")
    return f"+{digits}"


def request_code(db: Session, target: str, channel: str, purpose: str = "register") -> dict:
    if channel == "sms":
        target = normalise_phone(target)
    else:
        target = (target or "").strip().lower()
        if "@" not in target:
            raise OtpError("Enter a valid email address.")

    prev = _recent(db, target)
    if prev and (datetime.utcnow() - prev.created_at).total_seconds() < RESEND_COOLDOWN_SECONDS:
        wait = RESEND_COOLDOWN_SECONDS - int((datetime.utcnow() - prev.created_at).total_seconds())
        raise OtpError(f"Please wait {wait} seconds before requesting another code.")

    code = _generate()
    # Email codes are given a nominal far-future expiry so the NOT NULL column
    # is satisfied, and verify_code skips the expiry check for them entirely.
    # SMS codes keep the short TTL: a text can be delivered late, but a code
    # that never dies on a number which has changed hands is a real risk.
    email_forever = channel != "sms" and getattr(settings, "EMAIL_OTP_NEVER_EXPIRES", True)
    expires_at = (datetime.utcnow() + timedelta(days=3650) if email_forever
                  else datetime.utcnow() + timedelta(minutes=CODE_TTL_MINUTES))
    db.add(models.OtpCode(
        target=target, channel=channel, purpose=purpose,
        code_hash=hash_password(code),
        expires_at=expires_at,
    ))
    db.commit()

    if email_forever:
        text = f"{code} is your {settings.APP_NAME} verification code."
    else:
        text = (f"{code} is your {settings.APP_NAME} verification code. "
                f"It expires in {CODE_TTL_MINUTES} minutes.")

    if channel == "sms":
        res = send_sms(target, text)
    else:
        r = send_email(target, f"Your {settings.APP_NAME} verification code",
                       f"{text}\n\nIf you didn't request this, you can ignore this email.",
                       kind="otp")
        res = {"ok": r["ok"], "delivery": r["status"], "error": r.get("error")}

    if not res["ok"]:
        raise OtpError(res.get("error") or "Could not send the code. Please try again.")

    out = {"sent": True, "target": target, "delivery": res["delivery"],
           "expires_in_minutes": None if email_forever else CODE_TTL_MINUTES}
    # DEV ONLY: with no mail provider configured the code only exists in the
    # server console, which the person filling in the form cannot see. When
    # OTP_DEV_ECHO is on we hand it back so the flow is testable locally.
    if res["delivery"] == "console" and getattr(settings, "OTP_DEV_ECHO", False):
        out["dev_code"] = code
    return out


def verify_code(db: Session, target: str, channel: str, code: str) -> bool:
    target = normalise_phone(target) if channel == "sms" else (target or "").strip().lower()
    row = _recent(db, target)
    if not row:
        raise OtpError("Request a code first.")
    if row.verified:
        return True
    # Requirement 7: email codes do not expire. Only SMS is time-limited.
    email_forever = channel != "sms" and getattr(settings, "EMAIL_OTP_NEVER_EXPIRES", True)
    if not email_forever and row.expires_at < datetime.utcnow():
        raise OtpError("That code has expired. Please request a new one.")
    if (row.attempts or 0) >= MAX_ATTEMPTS:
        raise OtpError("Too many incorrect attempts. Please press Resend to get a new code.")

    if not (code or "").strip():
        raise OtpError("Enter the 6-digit code from your email.")

    row.attempts = (row.attempts or 0) + 1
    if not verify_password((code or "").strip(), row.code_hash):
        db.commit()
        left = MAX_ATTEMPTS - row.attempts
        raise OtpError(f"Incorrect OTP. Please check the code and try again — "
                       f"{left} attempt{'s' if left != 1 else ''} left.")

    row.verified = True
    db.commit()
    return True


def is_verified(db: Session, target: str, channel: str) -> bool:
    """Has this target been verified recently? Used at registration time."""
    try:
        target = normalise_phone(target) if channel == "sms" else (target or "").strip().lower()
    except OtpError:
        return False
    row = _recent(db, target)
    if not (row and row.verified):
        return False
    # Email codes don't expire (requirement 7), so a verification made an hour
    # into filling in the form is still good. SMS keeps the 2-hour window.
    if channel != "sms" and getattr(settings, "EMAIL_OTP_NEVER_EXPIRES", True):
        return True
    return (datetime.utcnow() - row.created_at) < timedelta(hours=2)
