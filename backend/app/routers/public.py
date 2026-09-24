from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, plans
from ..database import get_db
from ..auth import hash_password, generate_password
from ..email_utils import send_credentials_email, send_email
from ..notify_service import notify
from ..config import settings
from ..job_taxonomy import taxonomy_payload, skills_for_sector, ALL_SKILLS, SKILLS_BY_SECTOR
from .. import banner_service, otp_service

from .auth import EMAIL_RE          # one email shape across the whole API

router = APIRouter(prefix="/api/public", tags=["public"])


@router.post("/register/enterprise", response_model=schemas.CredentialResult)
def register_enterprise(body: schemas.EnterpriseRegister, db: Session = Depends(get_db)):
    """Employer self-registration. When OTP_REQUIRED is on, the mobile number and
    email must have been verified first via /api/auth/otp/verify."""
    if settings.OTP_REQUIRED:
        if body.phone and not otp_service.is_verified(db, body.phone, "sms"):
            raise HTTPException(400, "Please verify your mobile number first.")
        if not otp_service.is_verified(db, body.email, "email"):
            raise HTTPException(400, "Please verify your email address first.")
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(400, "A user with this email already exists.")
    password = generate_password()
    user = models.User(email=body.email, password_hash=hash_password(password),
                       role=models.ROLE_ENTERPRISE, must_change_password=True,
                       is_active=False)          # activated on approval
    db.add(user)
    db.flush()
    ent = models.Enterprise(user_id=user.id, approval_status="pending",
                            registration_source="self", **body.model_dump())
    db.add(ent)
    db.commit()
    res = send_credentials_email(body.email, body.name, body.email, password)
    for admin in db.query(models.User).filter(models.User.role == models.ROLE_ADMIN).all():
        notify(db, admin.id, "system", "New employer awaiting approval",
               f"{body.name} registered and needs review.", "/admin/approvals", commit=False)
    db.commit()
    return schemas.CredentialResult(email=body.email, user_id=body.email, password=password,
                                    status="Registered — your account is pending admin approval",
                                    email_sent=res["ok"], email_status=res["status"],
                                    email_error=res.get("error"))


@router.post("/register/jobseeker", response_model=schemas.CredentialResult)
def register_jobseeker(body: schemas.JobSeekerSelfRegister, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(400, "A user with this email already exists.")
    password = generate_password()
    user = models.User(email=body.email, password_hash=hash_password(password),
                       role=models.ROLE_JOBSEEKER, must_change_password=True)
    db.add(user)
    db.flush()

    # Per user story: voluntary registrations are attached to the default institute.
    default_inst = db.query(models.Institute).filter(
        models.Institute.name == settings.DEFAULT_INSTITUTE_NAME).first()

    data = body.model_dump()
    data["education"] = [e for e in (data.get("education") or [])]
    data["experience"] = [e for e in (data.get("experience") or [])]
    seeker = models.JobSeeker(user_id=user.id, approval_status="pending",
                              registration_source="self",
                              institute_id=default_inst.id if default_inst else None, **data)
    db.add(seeker)
    db.commit()
    name = f"{body.first_name or ''} {body.last_name or ''}".strip() or body.email
    res = send_credentials_email(body.email, name, body.email, password)
    for admin in db.query(models.User).filter(models.User.role == models.ROLE_ADMIN).all():
        notify(db, admin.id, "system", "New job seeker awaiting approval",
               f"{name} registered voluntarily and needs review.", "/admin/approvals", commit=False)
    db.commit()
    return schemas.CredentialResult(email=body.email, user_id=body.email, password=password,
                                    status="Registered — your account is pending admin approval",
                                    email_sent=res["ok"], email_status=res["status"],
                                    email_error=res.get("error"))


@router.get("/email-available")
def email_available(email: str, db: Session = Depends(get_db)):
    """Is this address free to register with? (requirement 5)

    Called as soon as the email field is filled in, so a duplicate is caught
    BEFORE an OTP is sent — otherwise the institute verifies a code, fills in
    the whole form, and only then learns the address is taken.
    """
    email = (email or "").strip().lower()
    if not EMAIL_RE.match(email):
        return {"valid": False, "available": False,
                "message": "Enter a valid email address, e.g. name@institute.edu"}
    taken = db.query(models.User).filter(models.User.email == email).first() is not None
    return {
        "valid": True,
        "available": not taken,
        "message": ("An account already exists with this email. Use another address, "
                    "or log in with this one." if taken else "Email looks good."),
    }


@router.post("/register/institute", response_model=schemas.CredentialResult)
def register_institute(body: schemas.InstituteRegister, db: Session = Depends(get_db)):
    """Institute registration form.

    The institute verifies its email by OTP, then sets its OWN password on the
    form (requirements 9-10), so the account is usable the moment registration
    succeeds — no generated password, no forced change on first login, and the
    Login button on the success screen actually works.

    Set INSTITUTE_SELF_APPROVE=false to go back to holding new institutes at
    "pending" until an admin approves them; admins are notified either way.
    """
    email = (body.email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address, e.g. name@institute.edu")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(400, "An account already exists with this email. "
                                 "Use another address, or log in with this one.")

    # The email must be the one that was actually verified — otherwise the OTP
    # step can be passed with one address and the account opened on another.
    if not otp_service.is_verified(db, email, "email"):
        raise HTTPException(400, "Please verify your email address with the OTP first.")

    chosen = (body.password or "").strip()
    if chosen and len(chosen) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    password = chosen or generate_password()

    self_approve = bool(getattr(settings, "INSTITUTE_SELF_APPROVE", True))
    user = models.User(email=email, password_hash=hash_password(password),
                       role=models.ROLE_INSTITUTE,
                       # They chose it, so don't force a change on first login.
                       must_change_password=not chosen,
                       is_active=self_approve)
    db.add(user)
    db.flush()

    data = body.model_dump(exclude={"password"})
    data["email"] = email
    # present_strength is the legacy name the bulk-upload capacity check reads.
    # Keep it in step with the new current_strength field so a sheet upload is
    # measured against the number the institute actually entered.
    if data.get("current_strength") is not None:
        data["present_strength"] = data["current_strength"]
    inst = models.Institute(user_id=user.id,
                            approval_status="approved" if self_approve else "pending",
                            registration_source="self", **data)
    db.add(inst)
    db.flush()

    # Seed the head office as the primary location so "Add new location" has
    # something to be additional TO, and the profile's location list is never
    # empty on a brand-new account.
    db.add(models.InstituteLocation(
        institute_id=inst.id, name="Main campus", is_primary=True,
        address1=inst.address1, address2=inst.address2, city=inst.city,
        district=inst.district, state=inst.state, country=inst.country or "INDIA",
        pincode=inst.pincode, contact_person=inst.authorised_person_name,
        contact_email=inst.authorised_person_email or email,
        contact_phone=inst.authorised_person_phone or inst.phone,
    ))
    db.commit()

    for admin in db.query(models.User).filter(models.User.role == models.ROLE_ADMIN).all():
        notify(db, admin.id, "system",
               "New institute registered" if self_approve else "New institute awaiting approval",
               f"{body.name} registered on the platform.", "/admin/approvals", commit=False)
    db.commit()

    if chosen:
        res = send_email(email, "Welcome to QCloneJob",
                         f"Thank you for registering {body.name} on QCloneJob.\n\n"
                         f"  User ID  : {email}\n"
                         f"  Password : the one you chose during registration\n\n"
                         f"Log in here: {settings.FRONTEND_URL}\n", kind="credentials")
    else:
        res = send_credentials_email(email, body.name, email, password)

    return schemas.CredentialResult(
        email=email, user_id=email,
        # Never echo a password the institute typed back into the browser.
        password="" if chosen else password,
        status=("Registration Successful" if self_approve
                else "Registration received — your account is pending admin approval"),
        email_sent=res["ok"], email_status=res["status"], email_error=res.get("error"))


@router.get("/taxonomy")
def taxonomy():
    """Every sector and role the platform covers — daily wage through postgraduate."""
    return taxonomy_payload()


@router.get("/skills")
def skills(sector: str | None = None, q: str | None = None, limit: int = 400):
    """Skills for a sector (or all), optionally filtered as the user types."""
    pool = skills_for_sector(sector) if sector else ALL_SKILLS
    if q:
        ql = q.lower()
        starts = [s for s in pool if s.lower().startswith(ql)]
        contains = [s for s in pool if ql in s.lower() and s not in starts]
        pool = starts + contains          # prefix matches first — feels faster to type against
    return {"skills": pool[:limit], "total": len(pool),
            "sector": sector, "sectors": sorted(SKILLS_BY_SECTOR.keys())}


@router.get("/banners")
def active_banners(audience: str = "jobseekers", slot: str = "default",
                   db: Session = Depends(get_db)):
    """Return exactly ONE banner for this page slot.

    Different slots get different banners while the pool allows, so a user never
    sees the same ad twice as they move around the app.
    """
    b = banner_service.pick_for_slot(db, audience, slot)
    if not b:
        return {"banner": None}
    banner_service.record(db, b, slot, "impression")
    return {"banner": banner_service.serialise(b), "slot": slot}


@router.post("/banners/{banner_id}/click")
def banner_click(banner_id: int, slot: str = "default", db: Session = Depends(get_db)):
    b = db.query(models.Banner).get(banner_id)
    if b:
        banner_service.record(db, b, slot, "click")
    return {"ok": True}


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    """Headline counts shown on the home page."""
    return {
        "jobs": plans.live_jobs(db.query(models.Job)).count(),
        "jobseekers": db.query(models.JobSeeker).count(),
        "enterprises": db.query(models.Enterprise).count(),
        "institutes": db.query(models.Institute).count(),
    }


@router.get("/jobs")
def public_jobs(limit: int = 6, db: Session = Depends(get_db)):
    """A few latest jobs to showcase on the home page (no login required)."""
    rows = plans.live_jobs(db.query(models.Job)).order_by(
        models.Job.created_at.desc()).limit(limit).all()
    return [{"id": j.id, "title": j.title, "location": j.location, "category": j.category,
             "experience": j.experience, "key_skills": j.key_skills} for j in rows]
