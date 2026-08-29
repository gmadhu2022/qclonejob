from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import require_role, get_current_user
from ..notify_service import notify, notify_job_alert, match_score
from .. import banner_service
from ..notifications import notify, notify_matching_seekers

router = APIRouter(prefix="/api/enterprise", tags=["enterprise"],
                   dependencies=[Depends(require_role(models.ROLE_ENTERPRISE))])


def _enterprise(current: models.User, db: Session) -> models.Enterprise:
    ent = db.query(models.Enterprise).filter(models.Enterprise.user_id == current.id).first()
    if not ent:
        raise HTTPException(404, "Enterprise profile not found.")
    return ent


# ---------------- Profile ----------------
@router.get("/profile", response_model=schemas.EnterpriseOut)
def get_profile(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _enterprise(current, db)


@router.put("/profile", response_model=schemas.EnterpriseOut)
def update_profile(body: schemas.EnterpriseBase,
                   current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ent = _enterprise(current, db)
    for k, v in body.model_dump(exclude={"email"}).items():
        setattr(ent, k, v)
    db.commit()
    db.refresh(ent)
    return ent


# ---------------- Resume search ----------------
@router.get("/resumes", response_model=list[schemas.JobSeekerOut])
def resume_search(q: str | None = None, location: str | None = None,
                  education: str | None = None, branch: str | None = None,
                  year_from: str | None = None, year_to: str | None = None,
                  min_percentage: float | None = None,
                  institute: str | None = None,
                  db: Session = Depends(get_db)):
    """Advanced resume search — keywords, location, education level/degree, branch,
    year-of-passing range, minimum percentage and college name (per the Resume Search sheet)."""
    query = db.query(models.JobSeeker)
    if location:
        query = query.filter(models.JobSeeker.location.ilike(f"%{location}%"))
    results = query.order_by(models.JobSeeker.created_at.desc()).all()

    # Keyword & education are matched in Python because they live in JSON columns
    # (portable across SQLite and Postgres). On Supabase/Postgres you can push this
    # into a JSONB @> / ilike query for performance at scale.
    def _num(v):
        try:
            return float(str(v).strip().replace("%", ""))
        except (TypeError, ValueError):
            return None

    def matches(s: models.JobSeeker) -> bool:
        edu = s.education or []
        if q:
            hay = " ".join(s.key_skills or []).lower() + " " + (s.career_objective or "").lower() \
                  + " " + (s.additional_info or "").lower()
            # any keyword (comma separated) may match
            terms = [t.strip().lower() for t in q.split(",") if t.strip()]
            if terms and not any(t in hay for t in terms):
                return False
        if education:
            text = " ".join(f"{e.get('degree','')} {e.get('level','')}" for e in edu).lower()
            if education.lower() not in text:
                return False
        if branch:
            text = " ".join(str(e.get("branch", "")) for e in edu).lower()
            if branch.lower() not in text:
                return False
        if institute:
            text = " ".join(str(e.get("institute", "")) for e in edu).lower()
            if institute.lower() not in text:
                return False
        if year_from or year_to:
            years = [_num(e.get("year_of_passing")) for e in edu]
            years = [y for y in years if y is not None]
            if not years:
                return False
            lo, hi = _num(year_from) or 0, _num(year_to) or 9999
            if not any(lo <= y <= hi for y in years):
                return False
        if min_percentage is not None:
            pcts = [_num(e.get("percentage")) for e in edu]
            pcts = [p for p in pcts if p is not None]
            if not pcts or max(pcts) < min_percentage:
                return False
        return True

    return [s for s in results if matches(s)]


@router.get("/resumes/{jobseeker_id}", response_model=schemas.JobSeekerOut)
def view_resume(jobseeker_id: int, action: str = "Viewed",
                current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """View a full resume. Records a ProfileView so the seeker sees who viewed them."""
    seeker = db.query(models.JobSeeker).get(jobseeker_id)
    if not seeker:
        raise HTTPException(404, "Job seeker not found.")
    ent = _enterprise(current, db)

    act = "Downloaded" if action == "Downloaded" else "Viewed"

    # One record per (candidate, recruiter). Repeat views bump the count and the
    # timestamp instead of creating duplicate rows (item 6).
    existing = db.query(models.ProfileView).filter_by(
        jobseeker_id=seeker.id, viewer_user_id=current.id).first()
    if existing:
        existing.view_count = (existing.view_count or 1) + 1
        existing.viewed_at = datetime.utcnow()
        existing.company_name = ent.name
        existing.recruiter_name = ent.authorised_person_name or ent.promoter_name
        existing.contact_phone = ent.phone
        existing.contact_email = ent.email
        # "Downloaded" is the stronger signal — never downgrade it back to "Viewed".
        was_download = existing.action == "Downloaded"
        if act == "Downloaded":
            existing.action = act
        notify_now = act == "Downloaded" and not was_download
    else:
        db.add(models.ProfileView(
            jobseeker_id=seeker.id, viewer_user_id=current.id,
            company_name=ent.name, location=ent.city or ent.state,
            recruiter_name=ent.authorised_person_name or ent.promoter_name,
            contact_phone=ent.phone, contact_email=ent.email,
            action=act, view_count=1, first_viewed_at=datetime.utcnow(),
        ))
        notify_now = True

    # Only notify on the first view (or a first download), so repeat views don't spam.
    if notify_now:
        notify(db, seeker.user_id, "view",
               f"{ent.name} {act.lower()} your profile",
               f"{ent.name} just {act.lower()} your resume.", link="/jobseeker/views")
    db.commit()
    return seeker


# ---------------- Jobs ----------------
@router.get("/jobs")
def my_jobs(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Jobs with their applicant counts, so the cards can show pipeline at a glance."""
    ent = _enterprise(current, db)
    jobs = (db.query(models.Job).filter(models.Job.enterprise_id == ent.id)
            .order_by(models.Job.created_at.desc()).all())
    out = []
    for j in jobs:
        apps = j.applications
        by_status = {}
        for a in apps:
            by_status[a.status] = by_status.get(a.status, 0) + 1
        out.append({
            "id": j.id, "title": j.title, "job_code": j.job_code, "location": j.location,
            "category": j.category, "sector": j.sector, "experience": j.experience,
            "salary": j.salary, "wage_min": j.wage_min, "wage_max": j.wage_max,
            "wage_basis": j.wage_basis, "education_level": j.education_level,
            "key_skills": j.key_skills or [], "description": j.description,
            "no_of_positions": j.no_of_positions or 1, "status": j.status,
            "is_urgent": j.is_urgent, "created_at": j.created_at,
            "applicants": len(apps),
            "new_applicants": by_status.get("Applied", 0),
            "shortlisted": by_status.get("Shortlisted", 0),
            "hired": by_status.get("Hired", 0),
            "by_status": by_status,
        })
    return out


@router.get("/jobs/overview")
def jobs_overview(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Jobs with their pipeline counts, for the Manage jobs cards."""
    ent = _enterprise(current, db)
    jobs = (db.query(models.Job).filter_by(enterprise_id=ent.id)
            .order_by(models.Job.created_at.desc()).all())
    out = []
    for j in jobs:
        apps = j.applications
        by_status = {}
        for a in apps:
            by_status[a.status] = by_status.get(a.status, 0) + 1
        out.append({
            "id": j.id, "title": j.title, "job_code": j.job_code, "location": j.location,
            "category": j.category, "sector": j.sector, "status": j.status,
            "experience": j.experience, "wage_min": j.wage_min, "wage_max": j.wage_max,
            "wage_basis": j.wage_basis, "salary": j.salary,
            "no_of_positions": j.no_of_positions or 1, "key_skills": j.key_skills or [],
            "is_urgent": bool(j.is_urgent), "created_at": j.created_at,
            "applicants": len(apps),
            "shortlisted": sum(1 for a in apps if a.status == "Shortlisted"),
            "interviewing": sum(1 for a in apps if a.status.startswith("Interview")
                                or a.status == "Managerial Round"),
            "hired": sum(1 for a in apps if a.status == "Hired"),
            "by_status": by_status,
        })
    return out


@router.post("/jobs", response_model=schemas.JobOut)
def post_job(body: schemas.JobBase, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ent = _enterprise(current, db)
    job = models.Job(enterprise_id=ent.id, posted_by_user_id=current.id, **body.model_dump())
    db.add(job)
    db.flush()
    notify_matching_seekers(db, job)   # job alerts
    db.commit()
    db.refresh(job)
    return job


@router.put("/jobs/{job_id}", response_model=schemas.JobOut)
def edit_job(job_id: int, body: schemas.JobBase, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ent = _enterprise(current, db)
    job = db.query(models.Job).filter_by(id=job_id, enterprise_id=ent.id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    for k, v in body.model_dump().items():
        setattr(job, k, v)
    db.commit()
    db.refresh(job)
    return job


# ---------------- Applications (recruiter inbox) ----------------
@router.get("/statuses")
def pipeline_statuses(current: models.User = Depends(get_current_user)):
    """The full hiring pipeline the recruiter can move candidates through."""
    return {"statuses": models.APPLICATION_STATUSES, "active": models.ACTIVE_STATUSES}


@router.get("/applications")
def received_applications(status: str | None = None, job_id: int | None = None,
                          q: str | None = None,
                          current: models.User = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    ent = _enterprise(current, db)
    query = (db.query(models.Application).join(models.Job)
             .filter(models.Job.enterprise_id == ent.id))
    if status and status != "All":
        if status == "Active":
            query = query.filter(models.Application.status.in_(models.ACTIVE_STATUSES))
        else:
            query = query.filter(models.Application.status == status)
    if job_id:
        query = query.filter(models.Application.job_id == job_id)
    apps = query.order_by(models.Application.applied_on.desc()).all()
    if q:
        ql = q.lower()
        apps = [a for a in apps if ql in (
            f"{a.jobseeker.first_name or ''} {a.jobseeker.last_name or ''} "
            f"{a.jobseeker.email or ''} {' '.join(a.jobseeker.key_skills or [])}").lower()]
    out = []
    for a in apps:
        s = a.jobseeker
        score, matched = match_score(s, a.job)
        out.append({
            "application_id": a.id,
            "status": a.status,
            "applied_on": a.applied_on,
            "job_title": a.job.title,
            "job_id": a.job_id,
            "candidate_name": f"{s.first_name or ''} {s.last_name or ''}".strip() or s.email,
            "candidate_id": s.id,
            "candidate_user_id": s.user_id,
            "location": s.location,
            "headline": s.headline,
            "photo": s.profile_picture_url,
            "key_skills": s.key_skills,
            "education": [e.get("degree") for e in (s.education or []) if e.get("degree")],
            "match_score": score,
        })
    return out


@router.get("/pipeline")
def pipeline_counts(job_id: int | None = None,
                    current: models.User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """Counts per status so the recruiter can filter by stage (item 11)."""
    ent = _enterprise(current, db)
    query = (db.query(models.Application).join(models.Job)
             .filter(models.Job.enterprise_id == ent.id))
    if job_id:
        query = query.filter(models.Application.job_id == job_id)
    apps = query.all()
    counts = {st: 0 for st in models.APPLICATION_STATUSES}
    for a in apps:
        counts[a.status] = counts.get(a.status, 0) + 1
    return {"total": len(apps), "counts": counts,
            "active": sum(1 for a in apps if a.status in models.ACTIVE_STATUSES)}


@router.put("/applications/{application_id}/status", response_model=schemas.Message)
def update_status(application_id: int, body: schemas.ApplicationStatusUpdate,
                  current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.status not in models.APPLICATION_STATUSES:
        raise HTTPException(400, f"Status must be one of {models.APPLICATION_STATUSES}")
    ent = _enterprise(current, db)
    app = (db.query(models.Application).join(models.Job)
           .filter(models.Application.id == application_id, models.Job.enterprise_id == ent.id).first())
    if not app:
        raise HTTPException(404, "Application not found.")
    app.status = body.status
    notify(db, app.jobseeker.user_id, "application",
           f"Your application is now {body.status}",
           f'"{app.job.title}" at {ent.name} — status: {body.status}.',
           link="/jobseeker/applied",
           email_to=app.jobseeker.email)
    db.commit()
    return {"message": f"Application status updated to {body.status}."}


@router.put("/jobs/{job_id}/status", response_model=schemas.Message)
def set_job_status(job_id: int, body: dict, current: models.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """Close or reopen a job posting."""
    status = body.get("status")
    if status not in ("active", "closed"):
        raise HTTPException(400, "Status must be 'active' or 'closed'.")
    ent = _enterprise(current, db)
    job = db.query(models.Job).filter_by(id=job_id, enterprise_id=ent.id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    job.status = status
    db.commit()
    return {"message": f"Job {'reopened' if status == 'active' else 'closed'}."}


@router.get("/jobs/{job_id}/applicants")
def job_applicants(job_id: int, current: models.User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    ent = _enterprise(current, db)
    job = db.query(models.Job).filter_by(id=job_id, enterprise_id=ent.id).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    out = []
    for a in job.applications:
        s = a.jobseeker
        out.append({"application_id": a.id, "status": a.status, "applied_on": a.applied_on,
                    "candidate_id": s.id,
                    "candidate_name": f"{s.first_name or ''} {s.last_name or ''}".strip() or s.email,
                    "location": s.location, "key_skills": s.key_skills})
    return {"job": {"id": job.id, "title": job.title, "status": job.status}, "applicants": out}


@router.get("/dashboard")
def enterprise_dashboard(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ent = _enterprise(current, db)
    jobs = db.query(models.Job).filter_by(enterprise_id=ent.id).all()
    job_ids = [j.id for j in jobs]
    apps = db.query(models.Application).filter(models.Application.job_id.in_(job_ids)).all() if job_ids else []
    by_status = {}
    for st in models.APPLICATION_STATUSES:
        by_status[st] = sum(1 for a in apps if a.status == st)
    return {
        "jobs_total": len(jobs),
        "jobs_active": sum(1 for j in jobs if j.status == "active"),
        "applications": len(apps),
        "by_status": by_status,
        "resumes_viewed": db.query(models.ProfileView).filter_by(viewer_user_id=current.id).count(),
    }


# ---------------- Banner ----------------
@router.get("/banners")
def my_banners(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(models.Banner).filter_by(posted_by_user_id=current.id)
            .order_by(models.Banner.created_at.desc()).all())
    return [{
        "id": b.id, "title": b.title, "company_name": b.company_name,
        "text_content": b.text_content, "media_type": b.media_type, "media_url": b.media_url,
        "poster_url": b.poster_url, "cta_label": b.cta_label, "cta_link": b.cta_link,
        "audience": b.audience, "theme": b.theme, "status": b.status,
        "start_date": b.start_date, "end_date": b.end_date, "priority": b.priority,
        "autoplay": b.autoplay, "muted": b.muted,
        "impressions": b.impressions or 0, "clicks": b.clicks or 0,
    } for b in rows]


@router.post("/banners", response_model=schemas.Message)
def post_banner(body: dict, current: models.User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """Create a banner. When audience is 'jobseekers' it appears on every job-seeker page."""
    ent = _enterprise(current, db)
    banner = models.Banner(
        posted_by_user_id=current.id,
        title=body.get("title"),
        company_name=body.get("company_name") or ent.name,
        logo_url=ent.logo_url,
        text_content=body.get("text_content"),
        media_type=body.get("media_type", "image"),
        media_url=body.get("media_url"),
        poster_url=body.get("poster_url"),
        cta_label=body.get("cta_label"),
        cta_link=body.get("cta_link"),
        audience=body.get("audience", "jobseekers"),
        theme=body.get("theme", "navy"),
        autoplay=bool(body.get("autoplay", True)),
        muted=bool(body.get("muted", True)),
        priority=int(body.get("priority") or 0),
        start_date=body.get("start_date"),
        end_date=body.get("end_date"),
        status="active",
    )
    db.add(banner)
    db.commit()
    where = "every job seeker" if banner.audience in ("jobseekers", "all") else "recruiters"
    return {"message": f'Banner "{banner.title}" is live and visible to {where}.'}


@router.put("/banners/{banner_id}/status", response_model=schemas.Message)
def banner_status(banner_id: int, body: dict, current: models.User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    b = db.query(models.Banner).filter_by(id=banner_id, posted_by_user_id=current.id).first()
    if not b:
        raise HTTPException(404, "Banner not found.")
    status = body.get("status")
    if status not in ("active", "paused"):
        raise HTTPException(400, "Status must be 'active' or 'paused'.")
    b.status = status
    db.commit()
    return {"message": f"Banner {'resumed' if status == 'active' else 'paused'}."}


@router.get("/banners/analytics")
def banner_analytics(days: int = 14, current: models.User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """Impressions, clicks, CTR and a daily trend for this recruiter's banners."""
    rows = db.query(models.Banner).filter_by(posted_by_user_id=current.id).all()
    return banner_service.analytics(db, rows, days=days)
