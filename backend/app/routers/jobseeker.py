from pathlib import Path
import uuid
import os
import re
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import String, func
from sqlalchemy.orm import Session

from .. import models, schemas, plans
from ..database import get_db
from ..auth import require_role, get_current_user
from ..email_utils import send_application_email
from ..notify_service import match_score
from ..profile_service import profile_strength

router = APIRouter(prefix="/api/jobseeker", tags=["jobseeker"],
                   dependencies=[Depends(require_role(models.ROLE_JOBSEEKER))])

# Templates the job seeker can switch between (item 4).
# Each entry maps to a layout archetype + accent scheme rendered on the frontend.
TEMPLATE_META = {
    "classic":      {"name": "Classic",      "layout": "single",   "accent": "navy",   "tier": "ATS",      "desc": "Traditional serif single column. Safest for ATS parsing."},
    "onyx":         {"name": "Onyx",         "layout": "single",   "accent": "slate",  "tier": "ATS",      "desc": "Clean monochrome column with strong section rules."},
    "meridian":     {"name": "Meridian",     "layout": "single",   "accent": "green",  "tier": "ATS",      "desc": "Simple column with a green accent line per section."},
    "modern":       {"name": "Modern",       "layout": "sidebar",  "accent": "navy",   "tier": "Popular",  "desc": "Navy sidebar for contact and skills, content on the right."},
    "cobalt":       {"name": "Cobalt",       "layout": "sidebar",  "accent": "cobalt", "tier": "Popular",  "desc": "Bold blue sidebar with a photo and skill meters."},
    "forest":       {"name": "Forest",       "layout": "sidebar",  "accent": "green",  "tier": "Popular",  "desc": "Green sidebar, warm and approachable."},
    "graphite":     {"name": "Graphite",     "layout": "sidebar",  "accent": "slate",  "tier": "Popular",  "desc": "Dark grey sidebar, understated and corporate."},
    "sidebar-right":{"name": "Beacon",       "layout": "sidebar-r","accent": "navy",   "tier": "Popular",  "desc": "Right-hand sidebar — content leads, details follow."},
    "professional": {"name": "Professional", "layout": "band",     "accent": "navy",   "tier": "Executive","desc": "Banner header, two-column body, timeline education."},
    "corporate":    {"name": "Corporate",    "layout": "band",     "accent": "slate",  "tier": "Executive","desc": "Formal banner with a structured requirements grid."},
    "emerald":      {"name": "Emerald",      "layout": "band",     "accent": "green",  "tier": "Executive","desc": "Green banner header with clean supporting columns."},
    "executive":    {"name": "Executive",    "layout": "monogram", "accent": "green",  "tier": "Executive","desc": "Monogram header and bold rules for senior profiles."},
    "regal":        {"name": "Regal",        "layout": "monogram", "accent": "navy",   "tier": "Executive","desc": "Serif monogram layout with generous spacing."},
    "minimal":      {"name": "Minimal",      "layout": "minimal",  "accent": "slate",  "tier": "Minimal",  "desc": "Label-left grid, hairline rules, lots of air."},
    "paper":        {"name": "Paper",        "layout": "minimal",  "accent": "navy",   "tier": "Minimal",  "desc": "Quiet editorial layout with wide margins."},
    "compact":      {"name": "Compact",      "layout": "compact",  "accent": "navy",   "tier": "Dense",    "desc": "Dense two-column layout that fits more per page."},
    "dense":        {"name": "Dense",        "layout": "compact",  "accent": "slate",  "tier": "Dense",    "desc": "Maximum content per page for long histories."},
    "timeline":     {"name": "Timeline",     "layout": "timeline", "accent": "navy",   "tier": "Modern",   "desc": "Vertical timeline for education and career progression."},
    "split":        {"name": "Split",        "layout": "split",    "accent": "cobalt", "tier": "Modern",   "desc": "Even two-column split with a centred header."},
    "trades":       {"name": "Trades",       "layout": "trades",   "accent": "green",  "tier": "Skilled",  "desc": "Built for skilled and worker roles: work, trade skills, availability first."},
}
AVAILABLE_TEMPLATES = list(TEMPLATE_META.keys())


def _seeker(current: models.User, db: Session) -> models.JobSeeker:
    seeker = db.query(models.JobSeeker).filter(models.JobSeeker.user_id == current.id).first()
    if not seeker:
        raise HTTPException(404, "Job seeker profile not found.")
    return seeker


# ---------------- Profile / Resume ----------------
@router.get("/profile", response_model=schemas.JobSeekerOut)
def get_profile(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _seeker(current, db)


@router.put("/profile", response_model=schemas.JobSeekerOut)
def update_profile(body: schemas.JobSeekerBase,
                   current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Job seeker edits the resume — including adding additional information later."""
    seeker = _seeker(current, db)
    data = body.model_dump(exclude={"email"})
    # normalise nested lists to plain dicts for JSON columns
    for key in ("education", "experience", "projects"):
        data[key] = [x for x in (data.get(key) or [])]
    for k, v in data.items():
        setattr(seeker, k, v)
    db.commit()
    db.refresh(seeker)
    return seeker


@router.get("/templates")
def list_templates():
    return {
        "templates": AVAILABLE_TEMPLATES,
        "meta": [{"key": k, **TEMPLATE_META[k]} for k in AVAILABLE_TEMPLATES],
        "tiers": sorted({m["tier"] for m in TEMPLATE_META.values()}),
    }


@router.put("/template", response_model=schemas.JobSeekerOut)
def change_template(body: schemas.ResumeTemplateUpdate,
                    current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.resume_template not in AVAILABLE_TEMPLATES:
        raise HTTPException(400, f"Template must be one of {AVAILABLE_TEMPLATES}")
    seeker = _seeker(current, db)
    seeker.resume_template = body.resume_template
    db.commit()
    db.refresh(seeker)
    return seeker


@router.get("/download-profile")
def download_profile(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns the full resume as JSON. The frontend renders it in the chosen template
    and triggers a browser download / print-to-PDF."""
    seeker = _seeker(current, db)
    return schemas.JobSeekerOut.model_validate(seeker)


@router.get("/profile-strength")
def get_profile_strength(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return profile_strength(_seeker(current, db))


def _wage_ceiling(job) -> int:
    """Highest number this job advertises, as an int. 0 when nothing parses.

    Uses wage_max because that is what a seeker could actually earn, falling
    back to wage_min for postings that published a single figure.
    """
    for raw in (job.wage_max, job.wage_min, job.salary):
        digits = re.sub(r"[^\d]", "", str(raw or ""))
        if digits:
            return int(digits)
    return 0


# ---------------- Job search & apply ----------------
@router.get("/jobs", response_model=list[schemas.JobOut])
def search_jobs(q: str | None = None, location: str | None = None,
                category: str | None = None, experience: str | None = None,
                job_type: str | None = None, salary_min: int | None = None,
                posted_within_days: int | None = None, limit: int = 200,
                db: Session = Depends(get_db)):
    """Job search.

    salary_min and posted_within_days back the "Salary at least" and "Date
    posted" filters. Both are applied in SQL rather than in Python so the
    LIMIT still means something on a large table.
    """
    query = plans.live_jobs(db.query(models.Job))
    if q:
        # Search the skills list too: a seeker typing "AutoCAD" means the skill,
        # and matching only title and description missed jobs that listed it.
        like = f"%{q}%"
        query = query.filter(
            models.Job.title.ilike(like)
            | models.Job.description.ilike(like)
            | models.Job.key_skills.cast(String).ilike(like)
        )
    if location:
        query = query.filter(models.Job.location.ilike(f"%{location}%"))
    if category:
        query = query.filter(models.Job.category.ilike(f"%{category}%"))
    if experience:
        query = query.filter(models.Job.experience.ilike(f"%{experience}%"))
    if job_type:
        query = query.filter(models.Job.job_type.ilike(f"%{job_type}%"))
    if posted_within_days:
        cutoff = datetime.utcnow() - timedelta(days=int(posted_within_days))
        query = query.filter(models.Job.created_at >= cutoff)

    rows = (query.order_by(models.Job.created_at.desc())
            .limit(min(max(1, limit), 500)).all())

    if salary_min:
        # Filtered in Python, not SQL, on purpose. wage_min/wage_max are STRING
        # columns and older rows hold free text like "15,000" or "15000/month",
        # so a SQL comparison silently misbehaves — SQLite compared them as
        # text and matched a 15,000 job against a 30,000 filter, and Postgres
        # would error outright on CAST('15,000' AS INTEGER).
        # Parsing the digits here is correct for both, and the row set is
        # already bounded by the LIMIT above.
        rows = [j for j in rows if _wage_ceiling(j) >= salary_min]

    return rows


# ---------------- Recommendations & saved jobs ----------------
@router.get("/recommended")
def recommended_jobs(limit: int = 20, current: models.User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """Active jobs ranked by how well they match this seeker's skills, location and education."""
    seeker = _seeker(current, db)
    applied = {a.job_id for a in db.query(models.Application).filter_by(jobseeker_id=seeker.id).all()}
    saved = {sj.job_id for sj in db.query(models.SavedJob).filter_by(jobseeker_id=seeker.id).all()}

    out = []
    for job in plans.live_jobs(db.query(models.Job)).all():
        score, matched = match_score(seeker, job)
        if score <= 0:
            continue
        out.append({
            "id": job.id, "title": job.title, "location": job.location, "category": job.category,
            "experience": job.experience, "salary": job.salary, "key_skills": job.key_skills,
            "description": job.description, "requirement_education": job.requirement_education,
            "requirement_technical": job.requirement_technical,
            "recruiter_name": job.recruiter_name, "recruiter_phone": job.recruiter_phone,
            "recruiter_email": job.recruiter_email, "contact_visible": job.contact_visible,
            "created_at": job.created_at,
            "match_score": score, "matched_skills": matched,
            "applied": job.id in applied, "saved": job.id in saved,
        })
    out.sort(key=lambda x: x["match_score"], reverse=True)
    return out[:limit]


@router.get("/saved-jobs")
def list_saved_jobs(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    seeker = _seeker(current, db)
    rows = db.query(models.SavedJob).filter_by(jobseeker_id=seeker.id)\
             .order_by(models.SavedJob.created_at.desc()).all()
    out = []
    for r in rows:
        job = db.query(models.Job).get(r.job_id)
        if not job:
            continue
        score, matched = match_score(seeker, job)
        out.append({"id": job.id, "title": job.title, "location": job.location,
                    "category": job.category, "salary": job.salary, "experience": job.experience,
                    "key_skills": job.key_skills, "description": job.description,
                    "status": job.status, "saved_on": r.created_at,
                    "match_score": score, "matched_skills": matched})
    return out


@router.post("/jobs/{job_id}/save", response_model=schemas.Message)
def save_job(job_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    seeker = _seeker(current, db)
    if not db.query(models.Job).get(job_id):
        raise HTTPException(404, "Job not found.")
    existing = db.query(models.SavedJob).filter_by(jobseeker_id=seeker.id, job_id=job_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"message": "Removed from saved jobs."}
    db.add(models.SavedJob(jobseeker_id=seeker.id, job_id=job_id))
    db.commit()
    return {"message": "Saved to your jobs."}


@router.post("/jobs/{job_id}/apply", response_model=schemas.Message)
def apply_to_job(job_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    seeker = _seeker(current, db)
    job = db.query(models.Job).get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")

    existing = db.query(models.Application).filter_by(job_id=job_id, jobseeker_id=seeker.id).first()
    if existing:
        raise HTTPException(400, "You have already applied to this job.")

    app = models.Application(job_id=job_id, jobseeker_id=seeker.id, status="Applied")
    db.add(app)
    db.commit()

    # Email the recruiter the application (per user story acceptance criteria).
    if job.recruiter_email:
        edu = ", ".join(
            f"{e.get('degree','')} {e.get('branch','')}".strip()
            for e in (seeker.education or [])
        )
        send_application_email(
            recruiter_email=job.recruiter_email,
            candidate_name=f"{seeker.first_name or ''} {seeker.last_name or ''}".strip() or seeker.email,
            position=job.title, job_code=job.job_code or f"JOB/{job.id}",
            location=seeker.location or "", education=edu,
            experience=", ".join(x.get("company", "") for x in (seeker.experience or [])),
            key_skills=", ".join(seeker.key_skills or []),
        )
    return {"message": f'Your application for "{job.title}" has been submitted.'}


# ---------------- Applied jobs (with live status) ----------------
@router.get("/applications", response_model=list[schemas.ApplicationOut])
def applied_jobs(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Full history of applied jobs with current status.

    The 10-row cap was removed: the My Applications screen now filters and
    searches this list client-side, and filtering a truncated list would
    silently hide applications the seeker had actually made. Capped at 500 as
    a sanity bound rather than a display limit.
    """
    seeker = _seeker(current, db)
    return (db.query(models.Application)
            .filter(models.Application.jobseeker_id == seeker.id)
            .order_by(models.Application.applied_on.desc())
            .limit(500).all())


# ---------------- Recruiter / profile views ----------------
@router.get("/profile-views", response_model=list[schemas.ProfileViewOut])
def profile_views(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Which companies have viewed/downloaded this seeker's profile."""
    seeker = _seeker(current, db)
    return (db.query(models.ProfileView)
            .filter(models.ProfileView.jobseeker_id == seeker.id)
            .order_by(models.ProfileView.viewed_at.desc()).all())


@router.get("/dashboard")
def dashboard(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    seeker = _seeker(current, db)
    apps = db.query(models.Application).filter_by(jobseeker_id=seeker.id).all()
    by_status = {st: sum(1 for a in apps if a.status == st) for st in models.APPLICATION_STATUSES}

    strength = profile_strength(seeker)

    return {
        "applied": len(apps),
        "profile_views": db.query(models.ProfileView).filter_by(jobseeker_id=seeker.id).count(),
        "new_jobs": plans.live_jobs(db.query(models.Job)).count(),
        "saved": db.query(models.SavedJob).filter_by(jobseeker_id=seeker.id).count(),
        "by_status": by_status,
        "completeness": strength["score"],
        "strength": strength,
        "missing": [m["label"] for m in strength["missing"]],
    }


# ==================== v2: saved jobs, recommendations, insights ====================
from ..notifications import notify


def _profile_completeness(s: models.JobSeeker) -> dict:
    """Score the resume so the seeker knows what's missing."""
    checks = [
        ("Name", bool(s.first_name)),
        ("Phone", bool(s.phone)),
        ("Location", bool(s.location)),
        ("Career objective", bool(s.career_objective)),
        ("Key skills", bool(s.key_skills)),
        ("Education", bool(s.education)),
        ("Experience", bool(s.experience)),
        ("Profile photo", bool(s.profile_picture_url)),
        ("Additional information", bool(s.additional_info)),
    ]
    done = sum(1 for _, ok in checks if ok)
    return {
        "percent": round(done / len(checks) * 100),
        "missing": [label for label, ok in checks if not ok],
    }


@router.get("/completeness")
def completeness(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _profile_completeness(_seeker(current, db))


def _match_score(seeker: models.JobSeeker, job: models.Job) -> int:
    """0-100 relevance score used for recommendations."""
    s_skills = {x.strip().lower() for x in (seeker.key_skills or []) if x and x.strip()}
    j_skills = {x.strip().lower() for x in (job.key_skills or []) if x and x.strip()}
    score = 0
    if j_skills and s_skills:
        score += round(len(s_skills & j_skills) / len(j_skills) * 70)
    if job.location and seeker.location and job.location.strip().lower() in seeker.location.strip().lower():
        score += 20
    edu_text = " ".join(
        f"{e.get('degree','')} {e.get('branch','')}" for e in (seeker.education or [])
    ).lower()
    if job.requirement_education and edu_text:
        words = {w for w in job.requirement_education.lower().split() if len(w) > 3}
        if any(w in edu_text for w in words):
            score += 10
    return min(score, 100)


@router.get("/recommendations")
def recommendations(limit: int = 10, current: models.User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """Jobs ranked by how well they match this seeker's skills, location and education."""
    seeker = _seeker(current, db)
    applied = {a.job_id for a in db.query(models.Application).filter_by(jobseeker_id=seeker.id).all()}
    jobs = plans.live_jobs(db.query(models.Job)).all()

    scored = []
    for j in jobs:
        if j.id in applied:
            continue
        sc = _match_score(seeker, j)
        if sc <= 0:
            continue
        scored.append({
            "id": j.id, "title": j.title, "location": j.location, "category": j.category,
            "experience": j.experience, "salary": j.salary, "key_skills": j.key_skills,
            "description": j.description, "match": sc,
        })
    scored.sort(key=lambda x: x["match"], reverse=True)
    return scored[:limit]


# ---------------- Saved jobs ----------------
@router.get("/saved-jobs")
def saved_jobs(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    seeker = _seeker(current, db)
    rows = (db.query(models.SavedJob, models.Job)
            .join(models.Job, models.Job.id == models.SavedJob.job_id)
            .filter(models.SavedJob.jobseeker_id == seeker.id)
            .order_by(models.SavedJob.created_at.desc()).all())
    return [{"saved_id": sj.id, "id": j.id, "title": j.title, "location": j.location,
             "category": j.category, "salary": j.salary, "experience": j.experience,
             "key_skills": j.key_skills, "description": j.description,
             "saved_on": sj.created_at} for sj, j in rows]


@router.post("/saved-jobs/{job_id}", response_model=schemas.Message)
def save_job(job_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    seeker = _seeker(current, db)
    if not db.query(models.Job).get(job_id):
        raise HTTPException(404, "Job not found.")
    if db.query(models.SavedJob).filter_by(jobseeker_id=seeker.id, job_id=job_id).first():
        return {"message": "Job already saved."}
    db.add(models.SavedJob(jobseeker_id=seeker.id, job_id=job_id))
    db.commit()
    return {"message": "Job saved."}


@router.delete("/saved-jobs/{job_id}", response_model=schemas.Message)
def unsave_job(job_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    seeker = _seeker(current, db)
    db.query(models.SavedJob).filter_by(jobseeker_id=seeker.id, job_id=job_id).delete()
    db.commit()
    return {"message": "Removed from saved jobs."}


# ---------------- Withdraw an application ----------------
@router.delete("/applications/{application_id}", response_model=schemas.Message)
def withdraw_application(application_id: int, current: models.User = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    seeker = _seeker(current, db)
    app = db.query(models.Application).filter_by(id=application_id, jobseeker_id=seeker.id).first()
    if not app:
        raise HTTPException(404, "Application not found.")
    if app.status in ("Shortlisted", "Selected"):
        raise HTTPException(400, f"You can't withdraw an application that is {app.status}.")
    db.delete(app)
    db.commit()
    return {"message": "Application withdrawn."}

@router.post("/resume-file")
async def upload_resume_file(file: UploadFile = File(...),
                             current: models.User = Depends(get_current_user),
                             db: Session = Depends(get_db)):
    """Store a resume the seeker wrote themselves (PDF or Word).

    Deliberately does NOT replace the generated resume. Recruiters search on
    the structured profile fields — skills, education, location — and a PDF is
    opaque to that search, so a seeker who replaced their profile with a file
    would quietly stop appearing in results. Both are kept and the seeker picks
    which one is shown by default.
    """
    seeker = _seeker(current, db)
    name = (file.filename or "resume").strip()
    ext = os.path.splitext(name)[1].lower()
    if ext not in (".pdf", ".doc", ".docx", ".rtf", ".odt"):
        raise HTTPException(400, "Upload a PDF or Word document (.pdf, .doc, .docx).")

    data = await file.read()
    if not data:
        raise HTTPException(400, "That file is empty.")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Resume must be 5 MB or smaller.")

    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    stored = f"resume_{uuid.uuid4().hex}{ext}"
    (upload_dir / stored).write_bytes(data)

    seeker.uploaded_resume_url = f"/uploads/{stored}"
    seeker.uploaded_resume_name = name
    db.commit()
    return {"url": seeker.uploaded_resume_url, "filename": name,
            "message": f"{name} uploaded."}


@router.delete("/resume-file")
def delete_resume_file(current: models.User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """Remove the uploaded file. The generated resume is unaffected."""
    seeker = _seeker(current, db)
    seeker.uploaded_resume_url = None
    seeker.uploaded_resume_name = None
    seeker.prefer_uploaded_resume = False
    db.commit()
    return {"message": "Uploaded resume removed. Your generated resume is still available."}

