from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import require_role, hash_password, generate_password
from ..email_utils import send_credentials_email
from .. import banner_service

router = APIRouter(prefix="/api/admin", tags=["admin"],
                   dependencies=[Depends(require_role(models.ROLE_ADMIN))])


def _create_user(db: Session, email: str, role: str) -> tuple[models.User, str]:
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
    password = generate_password()
    user = models.User(email=email, password_hash=hash_password(password),
                       role=role, must_change_password=True)
    db.add(user)
    db.flush()
    return user, password


# ---------------- Institutes ----------------
@router.get("/institutes", response_model=list[schemas.InstituteOut])
def list_institutes(db: Session = Depends(get_db)):
    return db.query(models.Institute).order_by(models.Institute.created_at.desc()).all()


@router.post("/institutes", response_model=schemas.CredentialResult)
def add_institute(body: schemas.InstituteBase, db: Session = Depends(get_db)):
    user, password = _create_user(db, body.email, models.ROLE_INSTITUTE)
    inst = models.Institute(user_id=user.id, **body.model_dump())
    db.add(inst)
    db.commit()
    res = send_credentials_email(body.email, body.name, body.email, password)
    return schemas.CredentialResult(email=body.email, user_id=body.email, password=password,
                                    status="Institute registered successfully",
                                    email_sent=res["ok"], email_status=res["status"],
                                    email_error=res.get("error"))


@router.put("/institutes/{institute_id}", response_model=schemas.InstituteOut)
def edit_institute(institute_id: int, body: schemas.InstituteBase, db: Session = Depends(get_db)):
    inst = db.query(models.Institute).get(institute_id)
    if not inst:
        raise HTTPException(404, "Institute not found.")
    for k, v in body.model_dump(exclude={"email"}).items():
        setattr(inst, k, v)
    db.commit()
    db.refresh(inst)
    return inst


@router.post("/institutes/{institute_id}/reset-password", response_model=schemas.CredentialResult)
def reset_institute_password(institute_id: int, db: Session = Depends(get_db)):
    inst = db.query(models.Institute).get(institute_id)
    if not inst:
        raise HTTPException(404, "Institute not found.")
    password = generate_password()
    inst.user.password_hash = hash_password(password)
    inst.user.must_change_password = True
    db.commit()
    res = send_credentials_email(inst.email, inst.name, inst.email, password)
    return schemas.CredentialResult(email=inst.email, user_id=inst.email, password=password,
                                    status="Password reset",
                                    email_sent=res["ok"], email_status=res["status"],
                                    email_error=res.get("error"))


# ---------------- Enterprises ----------------
@router.get("/enterprises", response_model=list[schemas.EnterpriseOut])
def list_enterprises(db: Session = Depends(get_db)):
    return db.query(models.Enterprise).order_by(models.Enterprise.created_at.desc()).all()


@router.post("/enterprises", response_model=schemas.CredentialResult)
def add_enterprise(body: schemas.EnterpriseBase, db: Session = Depends(get_db)):
    user, password = _create_user(db, body.email, models.ROLE_ENTERPRISE)
    ent = models.Enterprise(user_id=user.id, **body.model_dump())
    db.add(ent)
    db.commit()
    res = send_credentials_email(body.email, body.name, body.email, password)
    return schemas.CredentialResult(email=body.email, user_id=body.email, password=password,
                                    status="Employer registered successfully",
                                    email_sent=res["ok"], email_status=res["status"],
                                    email_error=res.get("error"))


@router.put("/enterprises/{enterprise_id}", response_model=schemas.EnterpriseOut)
def edit_enterprise(enterprise_id: int, body: schemas.EnterpriseBase, db: Session = Depends(get_db)):
    ent = db.query(models.Enterprise).get(enterprise_id)
    if not ent:
        raise HTTPException(404, "Enterprise not found.")
    for k, v in body.model_dump(exclude={"email"}).items():
        setattr(ent, k, v)
    db.commit()
    db.refresh(ent)
    return ent


# ---------------- Job seekers ----------------
@router.get("/jobseekers", response_model=list[schemas.JobSeekerOut])
def list_jobseekers(db: Session = Depends(get_db)):
    return db.query(models.JobSeeker).order_by(models.JobSeeker.created_at.desc()).all()


@router.post("/jobseekers", response_model=schemas.CredentialResult)
def add_jobseeker(body: schemas.JobSeekerBase, db: Session = Depends(get_db)):
    user, password = _create_user(db, body.email, models.ROLE_JOBSEEKER)
    data = body.model_dump()
    data["education"] = [e for e in (data.get("education") or [])]
    data["experience"] = [e for e in (data.get("experience") or [])]
    seeker = models.JobSeeker(user_id=user.id, **data)
    db.add(seeker)
    db.commit()
    name = f"{body.first_name or ''} {body.last_name or ''}".strip() or body.email
    res = send_credentials_email(body.email, name, body.email, password)
    return schemas.CredentialResult(email=body.email, user_id=body.email, password=password,
                                    status=f"{name} added successfully",
                                    email_sent=res["ok"], email_status=res["status"],
                                    email_error=res.get("error"))


# ---------------- Reports ----------------
@router.get("/reports/summary")
def reports_summary(db: Session = Depends(get_db)):
    """Simple aggregate report. Extend with the SQL-query report form from the user stories."""
    return {
        "institutes": db.query(models.Institute).count(),
        "enterprises": db.query(models.Enterprise).count(),
        "jobseekers": db.query(models.JobSeeker).count(),
        "jobs": db.query(models.Job).count(),
        "applications": db.query(models.Application).count(),
    }


# ==================== v2: richer reports + CSV export ====================
import csv
import io as _io
from datetime import datetime, timedelta
from fastapi.responses import StreamingResponse


@router.get("/reports/detailed")
def detailed_report(days: int = 30, db: Session = Depends(get_db)):
    """Platform activity over a window, plus breakdowns for charts."""
    since = datetime.utcnow() - timedelta(days=days)

    status_rows = {}
    for a in db.query(models.Application).all():
        status_rows[a.status] = status_rows.get(a.status, 0) + 1

    by_city = {}
    for s in db.query(models.JobSeeker).all():
        key = (s.location or "Not specified").strip() or "Not specified"
        by_city[key] = by_city.get(key, 0) + 1
    top_cities = sorted(by_city.items(), key=lambda kv: kv[1], reverse=True)[:8]

    skill_count = {}
    for s in db.query(models.JobSeeker).all():
        for k in (s.key_skills or []):
            k = (k or "").strip()
            if k:
                skill_count[k] = skill_count.get(k, 0) + 1
    top_skills = sorted(skill_count.items(), key=lambda kv: kv[1], reverse=True)[:10]

    return {
        "window_days": days,
        "totals": {
            "institutes": db.query(models.Institute).count(),
            "enterprises": db.query(models.Enterprise).count(),
            "jobseekers": db.query(models.JobSeeker).count(),
            "jobs": db.query(models.Job).count(),
            "active_jobs": db.query(models.Job).filter_by(status="active").count(),
            "applications": db.query(models.Application).count(),
            "profile_views": db.query(models.ProfileView).count(),
            "messages": db.query(models.Message).count(),
        },
        "recent": {
            "new_jobseekers": db.query(models.JobSeeker).filter(models.JobSeeker.created_at >= since).count(),
            "new_jobs": db.query(models.Job).filter(models.Job.created_at >= since).count(),
            "new_applications": db.query(models.Application).filter(models.Application.applied_on >= since).count(),
        },
        "applications_by_status": status_rows,
        "top_locations": [{"name": k, "count": v} for k, v in top_cities],
        "top_skills": [{"name": k, "count": v} for k, v in top_skills],
    }


@router.get("/reports/export")
def export_csv(entity: str = "jobseekers", db: Session = Depends(get_db)):
    """Download a CSV of jobseekers | enterprises | institutes | applications."""
    buf = _io.StringIO()
    w = csv.writer(buf)

    if entity == "jobseekers":
        w.writerow(["ID", "First name", "Last name", "Email", "Phone", "Location",
                    "Key skills", "Template", "Created"])
        for s in db.query(models.JobSeeker).all():
            w.writerow([s.id, s.first_name, s.last_name, s.email, s.phone, s.location,
                        "; ".join(s.key_skills or []), s.resume_template, s.created_at])
    elif entity == "enterprises":
        w.writerow(["ID", "Name", "Email", "Phone", "City", "State", "GST", "PAN", "Created"])
        for e in db.query(models.Enterprise).all():
            w.writerow([e.id, e.name, e.email, e.phone, e.city, e.state, e.gst_no, e.pan_no, e.created_at])
    elif entity == "institutes":
        w.writerow(["ID", "Name", "Email", "Phone", "City", "State", "Courses", "Strength", "Created"])
        for i in db.query(models.Institute).all():
            w.writerow([i.id, i.name, i.email, i.phone, i.city, i.state,
                        "; ".join(i.courses or []), i.present_strength, i.created_at])
    elif entity == "applications":
        w.writerow(["ID", "Candidate", "Email", "Job", "Status", "Applied on"])
        for a in db.query(models.Application).all():
            s = a.jobseeker
            w.writerow([a.id, f"{s.first_name or ''} {s.last_name or ''}".strip(), s.email,
                        a.job.title if a.job else "", a.status, a.applied_on])
    else:
        raise HTTPException(400, "entity must be jobseekers, enterprises, institutes or applications.")

    buf.seek(0)
    return StreamingResponse(
        _io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=hire_{entity}.csv"},
    )


@router.get("/banners/analytics")
def all_banner_analytics(days: int = 14, db: Session = Depends(get_db)):
    """Platform-wide banner performance across every advertiser."""
    rows = db.query(models.Banner).all()
    return banner_service.analytics(db, rows, days=days)
