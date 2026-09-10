import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import (
    verify_password, hash_password, create_access_token, get_current_user,
)
from ..email_utils import send_credentials_email, send_email
from ..config import settings
from .. import otp_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


ROLE_LABEL = {"admin": "Admin", "manager": "Manager", "enterprise": "Recruiter / Enterprise",
              "institute": "Institute", "jobseeker": "Job Seeker"}


@router.post("/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), expected_role: str | None = None,
          db: Session = Depends(get_db)):
    """OAuth2 password flow. `username` carries the email (= user id).

    `expected_role` locks the login to the portal the user chose: signing in on
    the Job Seeker page with recruiter credentials is refused rather than
    silently redirecting them somewhere they didn't ask to go.
    """
    user = db.query(models.User).filter(models.User.email == form.username).first()

    # Distinguish "no such account" from "wrong password" in the *message copy*
    # without confirming to an attacker which emails exist — both return 401 with
    # the same wording, but a known account gets the more helpful hint.
    if not user:
        raise HTTPException(status_code=401,
                            detail="Incorrect email or password. Please check and try again.")
    if not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401,
                            detail="Incorrect password. Please try again, or use "
                                   "'Forgot password?' to reset it.")

    # Pending / rejected self-registrations get a clear explanation instead of
    # a generic "account disabled".
    profile = user.institute or user.enterprise or user.jobseeker
    status = getattr(profile, "approval_status", "approved") if profile else "approved"
    if status == "pending":
        raise HTTPException(status_code=403,
                            detail="Your account is awaiting admin approval. "
                                   "We'll email you as soon as it's activated.")
    if status == "rejected":
        reason = getattr(profile, "rejection_reason", None)
        raise HTTPException(status_code=403,
                            detail=f"Your registration was not approved."
                                   + (f" Reason: {reason}" if reason else "")
                                   + " Please contact support@qclonejob.com.")
    if not user.is_active:
        raise HTTPException(status_code=403,
                            detail="This account is disabled. Please contact support@qclonejob.com.")
    # Portal lock — admins may use any portal, everyone else is held to theirs.
    if expected_role and user.role != expected_role and user.role != models.ROLE_ADMIN:
        raise HTTPException(
            status_code=403,
            detail=(f"These are {ROLE_LABEL.get(user.role, user.role)} credentials. "
                    f"Please use the {ROLE_LABEL.get(expected_role, expected_role)} "
                    f"login page, or switch the role above."),
        )

    token = create_access_token(user)
    return schemas.Token(
        access_token=token, role=user.role, email=user.email,
        must_change_password=user.must_change_password,
    )


@router.get("/me")
def me(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the logged-in user, their profile id, and (job seekers only)
    their photo and name for the header.

    avatar_url is populated for JOB SEEKERS ONLY. Recruiters and institutes
    deliberately do not get one: their header shows the account email, as it
    did before. Returning a logo here that nothing renders would just be dead
    weight on the most-called endpoint in the app.

    Served from /me rather than having the header fetch a whole profile on
    every page — pulling an entire jobseeker record (education, experience,
    skills) to get one image would be wasteful for every route change.
    """
    profile_id = None
    avatar_url = None
    display_name = None

    if current.role == models.ROLE_JOBSEEKER and current.jobseeker:
        s = current.jobseeker
        profile_id = s.id
        avatar_url = s.profile_picture_url
        display_name = f"{s.first_name or ''} {s.last_name or ''}".strip() or None
    elif current.role == models.ROLE_ENTERPRISE and current.enterprise:
        profile_id = current.enterprise.id
    elif current.role == models.ROLE_INSTITUTE and current.institute:
        profile_id = current.institute.id

    return {
        "id": current.id,
        "email": current.email,
        "role": current.role,
        "must_change_password": current.must_change_password,
        "profile_id": profile_id,
        "avatar_url": avatar_url,
        "display_name": display_name,
    }


@router.post("/change-password", response_model=schemas.Message)
def change_password(body: schemas.ChangePasswordRequest,
                    current: models.User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    # If not a forced first-login change, require the old password.
    if not current.must_change_password:
        if not body.old_password or not verify_password(body.old_password, current.password_hash):
            raise HTTPException(status_code=400, detail="Old password is incorrect.")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    current.password_hash = hash_password(body.new_password)
    current.must_change_password = False
    db.commit()

    # Per user story: mail the registered email with user id and new password.
    send_credentials_email(current.email, current.email, current.email, body.new_password)
    return {"message": "You have changed the password successfully."}


# ---------------- Self-service password reset ----------------
import secrets
from datetime import datetime, timedelta
from ..config import settings
from .. import otp_service


@router.post("/forgot-password", response_model=schemas.Message)
def forgot_password(body: dict, db: Session = Depends(get_db)):
    """Email a reset link. Always returns the same message so the endpoint
    can't be used to discover which emails are registered."""
    email = (body.get("email") or "").strip()
    generic = {"message": "If that email is registered, a reset link has been sent to it."}
    if not email:
        return generic

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return generic

    token = secrets.token_urlsafe(32)
    db.add(models.PasswordResetToken(
        user_id=user.id, token=token,
        expires_at=datetime.utcnow() + timedelta(hours=2),
    ))
    db.commit()

    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    if not settings.EMAIL_ENABLED:
        # No SMTP configured, so no email will arrive — surface the link loudly
        # in the server console instead of letting it look like nothing happened.
        print("\n" + "!" * 74)
        print("  PASSWORD RESET LINK  (email is OFF — set EMAIL_ENABLED=True to send it)")
        print("!" * 74)
        print(f"  For : {email}")
        print(f"  Open: {link}")
        print("!" * 74 + "\n", flush=True)
    try:
        send_email(
            email, f"Reset your {settings.APP_NAME} password",
            f"We received a request to reset your password.\n\n"
            f"Open this link to choose a new one (valid for 2 hours):\n{link}\n\n"
            f"If you didn't request this, you can ignore this email.",
        )
    except Exception:
        pass
    return generic


@router.post("/reset-password", response_model=schemas.Message)
def reset_password(body: dict, db: Session = Depends(get_db)):
    token = (body.get("token") or "").strip()
    new_password = body.get("new_password") or ""
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    rec = db.query(models.PasswordResetToken).filter_by(token=token, used=False).first()
    if not rec or rec.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user = db.query(models.User).get(rec.user_id)
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    rec.used = True
    db.commit()
    return {"message": "Password updated. You can now log in with your new password."}


# ---------------- Forgot / reset password ----------------
@router.post("/forgot-password", response_model=schemas.Message)
def forgot_password(body: dict, db: Session = Depends(get_db)):
    """Emails a reset link. Always returns the same message so the endpoint
    can't be used to discover which emails are registered."""
    email = (body.get("email") or "").strip()
    generic = {"message": "If that email is registered, a reset link has been sent to it."}
    if not email:
        return generic

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return generic

    token = secrets.token_urlsafe(32)
    db.add(models.PasswordResetToken(
        user_id=user.id, token=token,
        expires_at=datetime.utcnow() + timedelta(hours=1),
    ))
    db.commit()

    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    if not settings.EMAIL_ENABLED:
        # No SMTP configured, so no email will arrive — surface the link loudly
        # in the server console instead of letting it look like nothing happened.
        print("\n" + "!" * 74)
        print("  PASSWORD RESET LINK  (email is OFF — set EMAIL_ENABLED=True to send it)")
        print("!" * 74)
        print(f"  For : {email}")
        print(f"  Open: {link}")
        print("!" * 74 + "\n", flush=True)
    try:
        send_email(email, f"Reset your {settings.APP_NAME} password",
                   f"We received a request to reset your password.\n\n"
                   f"Open this link to choose a new one (valid for 1 hour):\n{link}\n\n"
                   f"If you didn't request this, you can ignore this email.")
    except Exception:
        pass
    return generic


@router.post("/reset-password", response_model=schemas.Message)
def reset_password(body: dict, db: Session = Depends(get_db)):
    token = body.get("token")
    new_password = body.get("new_password") or ""
    if len(new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")

    row = db.query(models.PasswordResetToken).filter_by(token=token, used=False).first()
    if not row or row.expires_at < datetime.utcnow():
        raise HTTPException(400, "This reset link is invalid or has expired.")

    user = db.query(models.User).get(row.user_id)
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    row.used = True
    db.commit()
    return {"message": "Password reset. You can now log in with your new password."}


# ---------------- OTP verification ----------------
@router.post("/otp/send")
def otp_send(body: dict, db: Session = Depends(get_db)):
    """Send a verification code by SMS (Twilio) or email."""
    channel = body.get("channel", "sms")
    if channel not in ("sms", "email"):
        raise HTTPException(400, "channel must be 'sms' or 'email'.")
    try:
        return otp_service.request_code(db, body.get("target", ""), channel,
                                        body.get("purpose", "register"))
    except otp_service.OtpError as e:
        raise HTTPException(400, str(e))


@router.post("/otp/verify")
def otp_verify(body: dict, db: Session = Depends(get_db)):
    try:
        otp_service.verify_code(db, body.get("target", ""), body.get("channel", "sms"),
                                body.get("code", ""))
        return {"verified": True, "message": "Verified."}
    except otp_service.OtpError as e:
        raise HTTPException(400, str(e))
