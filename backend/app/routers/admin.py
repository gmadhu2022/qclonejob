from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import require_role, hash_password, generate_password, get_current_user
from ..email_utils import send_credentials_email
from .. import banner_service, plans
from datetime import datetime
from ..notifications import notify, notify_matching_seekers

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
def list_institutes(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    """Paginated. `.all()` here used to load every institute into memory and
    serialise the lot — fine at 50 rows, tens of megabytes at 100k."""
    return (db.query(models.Institute).order_by(models.Institute.created_at.desc())
            .offset(max(0, offset)).limit(min(max(1, limit), 500)).all())


@router.post("/institutes", response_model=schemas.CredentialResult)
def add_institute(body: schemas.InstituteRegister, db: Session = Depends(get_db)):
    """Admin-created institute.

    Uses InstituteRegister, not InstituteBase, so `logo_url` from the shared
    registration form is stored instead of being silently dropped by Pydantic.
    Note the edit endpoint below deliberately keeps InstituteBase, so a profile
    save that omits logo_url can't wipe an existing logo.
    """
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
    return db.query(models.Enterprise).order_by(models.Enterprise.created_at.desc()).limit(500).all()


@router.post("/enterprises", response_model=schemas.CredentialResult)
def add_enterprise(body: schemas.EnterpriseRegister, db: Session = Depends(get_db)):
    """Admin-created employer. EnterpriseRegister for the same logo_url reason."""
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
    return db.query(models.JobSeeker).order_by(models.JobSeeker.created_at.desc()).limit(500).all()


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


# ---------------- Job approval queue ----------------
#
# Recruiter postings land as "pending" and are invisible to seekers until an
# admin clears them. Candidate alerts fire HERE, on approval, not at creation:
# a notification cannot be recalled, so alerting everyone first and reviewing
# afterwards would send thousands of people to a job that gets rejected.
@router.get("/jobs/pending")
def list_pending_jobs(current: models.User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    """Jobs waiting for review, oldest first — a queue, not a feed.

    Oldest first on purpose: newest-first means a busy queue starves the
    recruiter who has been waiting longest, which is the one complaint a job
    board cannot answer.
    """
    rows = (db.query(models.Job)
            .filter(models.Job.approval_status == "pending")
            .order_by(models.Job.created_at.asc()).all())
    out = []
    for j in rows:
        ent = db.query(models.Enterprise).filter_by(id=j.enterprise_id).first()
        out.append({
            "id": j.id, "title": j.title, "location": j.location,
            "category": j.category, "salary": j.salary,
            "no_of_positions": j.no_of_positions,
            "shift": getattr(j, "shift", None),
            "description": j.description,
            "key_skills": j.key_skills or [],
            "created_at": j.created_at,
            "expires_at": j.expires_at,
            "company": ent.name if ent else None,
            "company_id": ent.id if ent else None,
        })
    return out


@router.post("/jobs/{job_id}/approve")
def approve_job(job_id: int, current: models.User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """Publish a posting and alert every matching seeker."""
    job = db.query(models.Job).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    if job.approval_status == "approved":
        return {"message": "This job is already live.", "id": job.id}

    job.approval_status = "approved"
    job.approved_at = datetime.utcnow()
    job.approved_by_user_id = current.id
    job.approval_note = None
    # Restart the clock at approval. A job that sat in the queue for four days
    # would otherwise go live with four of its fifteen days already burnt,
    # which the recruiter paid for and did not use.
    job.expires_at = plans.job_expiry(None)
    db.flush()

    notify_matching_seekers(db, job)
    if job.posted_by_user_id:
        notify(db, job.posted_by_user_id, "system", "Your job is live",
               f'"{job.title}" has been approved and is now visible to candidates.',
               "/enterprise/manage-jobs")
    db.commit()
    return {"message": f'"{job.title}" is now live.', "id": job.id,
            "expires_at": job.expires_at}


@router.post("/jobs/{job_id}/reject")
def reject_job(job_id: int, body: dict, current: models.User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """Turn a posting down, with a reason the recruiter can act on."""
    job = db.query(models.Job).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    reason = (body.get("note") or "").strip()
    if not reason:
        # A bare rejection produces a support ticket instead of a fixed posting.
        raise HTTPException(400, "Please give a reason — the recruiter sees it "
                                 "and needs to know what to change.")
    job.approval_status = "rejected"
    job.approval_note = reason
    job.approved_at = datetime.utcnow()
    job.approved_by_user_id = current.id
    db.flush()
    if job.posted_by_user_id:
        notify(db, job.posted_by_user_id, "system", "Job not approved",
               f'"{job.title}" was not approved: {reason}',
               "/enterprise/manage-jobs")
    db.commit()
    return {"message": "Job rejected and the recruiter has been told why.", "id": job.id}
