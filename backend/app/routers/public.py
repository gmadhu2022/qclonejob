from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import hash_password, generate_password
from ..email_utils import send_credentials_email, send_email
from ..notify_service import notify
from ..config import settings
from ..job_taxonomy import taxonomy_payload
from .. import banner_service

router = APIRouter(prefix="/api/public", tags=["public"])


@router.post("/register/enterprise", response_model=schemas.CredentialResult)
def register_enterprise(body: schemas.EnterpriseRegister, db: Session = Depends(get_db)):
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


@router.post("/register/institute", response_model=schemas.CredentialResult)
def register_institute(body: schemas.InstituteBase, db: Session = Depends(get_db)):
    """Institute registration form (requirement 1a).

    Self-registered institutes start as PENDING and cannot log in until an
    admin approves them.
    """
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(400, "A user with this email already exists.")
    password = generate_password()
    user = models.User(email=body.email, password_hash=hash_password(password),
                       role=models.ROLE_INSTITUTE, must_change_password=True,
                       is_active=False)          # activated on approval
    db.add(user)
    db.flush()
    inst = models.Institute(user_id=user.id, approval_status="pending",
                            registration_source="self", **body.model_dump())
    db.add(inst)
    db.commit()

    # Tell every admin there's something to review.
    for admin in db.query(models.User).filter(models.User.role == models.ROLE_ADMIN).all():
        notify(db, admin.id, "system", "New institute awaiting approval",
               f"{body.name} registered and needs review.", "/admin/approvals", commit=False)
    db.commit()

    res = send_email(body.email, "QCloneJob registration received",
                     f"Thank you for registering {body.name} on QCloneJob.\n\n"
                     f"Your account is being reviewed by our team. You'll receive your login "
                     f"details by email once it's approved.\n", kind="credentials")
    return schemas.CredentialResult(
        email=body.email, user_id=body.email, password=password,
        status="Registration received — your account is pending admin approval",
        email_sent=res["ok"], email_status=res["status"], email_error=res.get("error"))


@router.get("/taxonomy")
def taxonomy():
    """Every sector and role the platform covers — daily wage through postgraduate."""
    return taxonomy_payload()


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
        "jobs": db.query(models.Job).filter(models.Job.status == "active").count(),
        "jobseekers": db.query(models.JobSeeker).count(),
        "enterprises": db.query(models.Enterprise).count(),
        "institutes": db.query(models.Institute).count(),
    }


@router.get("/jobs")
def public_jobs(limit: int = 6, db: Session = Depends(get_db)):
    """A few latest jobs to showcase on the home page (no login required)."""
    rows = db.query(models.Job).filter(models.Job.status == "active").order_by(
        models.Job.created_at.desc()).limit(limit).all()
    return [{"id": j.id, "title": j.title, "location": j.location, "category": j.category,
             "experience": j.experience, "key_skills": j.key_skills} for j in rows]
