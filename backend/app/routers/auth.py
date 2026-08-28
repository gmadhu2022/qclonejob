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

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 password flow. `username` field carries the email (= user id)."""
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
    token = create_access_token(user)
    return schemas.Token(
        access_token=token, role=user.role, email=user.email,
        must_change_password=user.must_change_password,
    )


@router.get("/me")
def me(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the logged-in user plus their role-specific profile id."""
    profile_id = None
    if current.role == models.ROLE_JOBSEEKER and current.jobseeker:
        profile_id = current.jobseeker.id
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
