"""AI endpoints (Groq). Every route returns 503 with a readable message when AI is off."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..auth import get_current_user, require_role
from .. import ai_service as ai
from ..notify_service import match_score

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _guard(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except ai.AIUnavailable as e:
        raise HTTPException(503, str(e))


def _seeker_dict(s: models.JobSeeker) -> dict:
    return {
        "name": f"{s.first_name or ''} {s.last_name or ''}".strip(),
        "location": s.location, "objective": s.career_objective,
        "skills": s.key_skills or [], "education": s.education or [],
        "experience": s.experience or [], "certifications": s.certifications or [],
        "languages": s.languages or [], "additional_info": s.additional_info,
    }


def _job_dict(j: models.Job) -> dict:
    return {
        "title": j.title, "location": j.location, "category": j.category,
        "description": j.description, "education": j.requirement_education,
        "technical": j.requirement_technical, "experience": j.experience,
        "salary": j.salary, "skills": j.key_skills or [],
    }


def _my_seeker(current: models.User, db: Session) -> models.JobSeeker:
    s = db.query(models.JobSeeker).filter_by(user_id=current.id).first()
    if not s:
        raise HTTPException(404, "Job seeker profile not found.")
    return s


@router.get("/models")
def list_available_models(current: models.User = Depends(get_current_user)):
    """List the model IDs this Groq key can use, so you can pick a valid GROQ_MODEL."""
    try:
        available = ai.list_models()
    except ai.AIUnavailable as e:
        raise HTTPException(503, str(e))
    return {
        "configured": ai.settings.GROQ_MODEL,
        "configured_is_valid": ai.settings.GROQ_MODEL in available,
        "available": available,
    }


@router.get("/status")
def status():
    """Lets the UI hide AI buttons when AI isn't configured."""
    return {"enabled": ai.ai_enabled(), "model": ai.settings.GROQ_MODEL if ai.ai_enabled() else None}


# ---------------- job seeker ----------------
@router.post("/resume/objective")
def ai_objective(current: models.User = Depends(require_role(models.ROLE_JOBSEEKER)),
                 db: Session = Depends(get_db)):
    return _guard(ai.improve_objective, _seeker_dict(_my_seeker(current, db)))


@router.post("/resume/skills")
def ai_skills(current: models.User = Depends(require_role(models.ROLE_JOBSEEKER)),
              db: Session = Depends(get_db)):
    return _guard(ai.suggest_skills, _seeker_dict(_my_seeker(current, db)))


@router.post("/resume/parse")
def ai_parse_resume(body: dict, current: models.User = Depends(require_role(models.ROLE_JOBSEEKER))):
    text = (body.get("text") or "").strip()
    if len(text) < 40:
        raise HTTPException(400, "Paste a bit more of your resume text (at least 40 characters).")
    return _guard(ai.parse_resume_text, text)


@router.post("/jobs/{job_id}/explain")
def ai_explain(job_id: int, current: models.User = Depends(require_role(models.ROLE_JOBSEEKER)),
               db: Session = Depends(get_db)):
    seeker = _my_seeker(current, db)
    job = db.query(models.Job).get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    score, matched = match_score(seeker, job)
    return _guard(ai.explain_match, _seeker_dict(seeker), _job_dict(job), score, matched)


@router.post("/jobs/{job_id}/interview-prep")
def ai_interview(job_id: int, current: models.User = Depends(require_role(models.ROLE_JOBSEEKER)),
                 db: Session = Depends(get_db)):
    seeker = _my_seeker(current, db)
    job = db.query(models.Job).get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return _guard(ai.interview_prep, _seeker_dict(seeker), _job_dict(job))


@router.post("/jobs/{job_id}/cover-letter")
def ai_cover_letter(job_id: int, current: models.User = Depends(require_role(models.ROLE_JOBSEEKER)),
                    db: Session = Depends(get_db)):
    seeker = _my_seeker(current, db)
    job = db.query(models.Job).get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return _guard(ai.cover_letter, _seeker_dict(seeker), _job_dict(job))


# ---------------- recruiter ----------------
@router.post("/job/describe")
def ai_job_description(body: dict, current: models.User = Depends(get_current_user)):
    if current.role not in (models.ROLE_ENTERPRISE, models.ROLE_INSTITUTE):
        raise HTTPException(403, "Only recruiters and institutes can generate job descriptions.")
    if not (body.get("title") or "").strip():
        raise HTTPException(400, "Enter a job title first.")
    return _guard(ai.generate_job_description, body)


@router.post("/candidate/{jobseeker_id}/summary")
def ai_candidate_summary(jobseeker_id: int, body: dict | None = None,
                         current: models.User = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    if current.role not in (models.ROLE_ENTERPRISE, models.ROLE_INSTITUTE):
        raise HTTPException(403, "Only recruiters and institutes can summarise candidates.")
    s = db.query(models.JobSeeker).get(jobseeker_id)
    if not s:
        raise HTTPException(404, "Candidate not found.")
    job = None
    if body and body.get("job_id"):
        j = db.query(models.Job).get(body["job_id"])
        job = _job_dict(j) if j else None
    return _guard(ai.candidate_summary, _seeker_dict(s), job)


@router.post("/job/parse")
def ai_parse_jd(body: dict, current: models.User = Depends(get_current_user)):
    """Paste a job description -> structured fields to auto-populate the post-job form."""
    if current.role not in (models.ROLE_ENTERPRISE, models.ROLE_INSTITUTE):
        raise HTTPException(403, "Only recruiters and institutes can post jobs.")
    text = (body.get("text") or "").strip()
    if len(text) < 40:
        raise HTTPException(400, "Paste a bit more of the job description (at least 40 characters).")
    return _guard(ai.parse_job_description, text)


@router.post("/job/classify")
def ai_classify(body: dict, current: models.User = Depends(get_current_user)):
    """Job title -> sector, education level, wage basis, suggested skills."""
    if current.role not in (models.ROLE_ENTERPRISE, models.ROLE_INSTITUTE):
        raise HTTPException(403, "Only recruiters and institutes can post jobs.")
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "Enter a job title first.")
    from ..job_taxonomy import SECTORS
    return _guard(ai.classify_role, title, SECTORS)


@router.post("/banner/copy")
def ai_banner_copy(body: dict, current: models.User = Depends(get_current_user)):
    if current.role not in (models.ROLE_ENTERPRISE, models.ROLE_INSTITUTE, models.ROLE_ADMIN):
        raise HTTPException(403, "Not available for this account type.")
    return _guard(ai.banner_copy, body)


# ---------------- copilot & advanced ----------------
@router.post("/copilot")
def ai_copilot(body: dict, current: models.User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """Conversational assistant grounded in the user's own data."""
    q = (body.get("question") or "").strip()
    if not q:
        raise HTTPException(400, "Ask a question.")
    history = body.get("history") or []

    if current.role == models.ROLE_JOBSEEKER:
        seeker = _my_seeker(current, db)
        jobs = db.query(models.Job).filter(models.Job.status == "active").limit(25).all()
        ctx = {"profile": _seeker_dict(seeker),
               "available_jobs": [_job_dict(j) | {"id": j.id} for j in jobs],
               "applications": [{"job": a.job.title, "status": a.status}
                                for a in seeker.applications[:15]]}
        return _guard(ai.copilot, "jobseeker", ctx, history, q)

    if current.role == models.ROLE_ENTERPRISE:
        ent = db.query(models.Enterprise).filter_by(user_id=current.id).first()
        if not ent:
            raise HTTPException(404, "Enterprise profile not found.")
        jobs = db.query(models.Job).filter_by(enterprise_id=ent.id).all()
        apps = (db.query(models.Application).join(models.Job)
                .filter(models.Job.enterprise_id == ent.id).limit(40).all())
        ctx = {"company": ent.name,
               "jobs": [_job_dict(j) | {"id": j.id, "status": j.status} for j in jobs],
               "pipeline": [{"candidate": f"{a.jobseeker.first_name or ''} {a.jobseeker.last_name or ''}".strip(),
                             "job": a.job.title, "status": a.status,
                             "skills": a.jobseeker.key_skills} for a in apps]}
        return _guard(ai.copilot, "enterprise", ctx, history, q)

    raise HTTPException(403, "Copilot is available for job seekers and recruiters.")


@router.post("/profile/from-speech")
def ai_profile_from_speech(body: dict,
                           current: models.User = Depends(require_role(models.ROLE_JOBSEEKER))):
    """Build a profile from a plain self-description in any Indian language."""
    text = (body.get("text") or "").strip()
    if len(text) < 15:
        raise HTTPException(400, "Tell us a bit more about your work.")
    return _guard(ai.profile_from_speech, text, body.get("language", "auto"))


@router.post("/jobs/{job_id}/translate")
def ai_translate_job(job_id: int, body: dict, current: models.User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """Translate a job posting into a regional language."""
    job = db.query(models.Job).get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    lang = body.get("language") or "Hindi"
    if lang not in ai.INDIAN_LANGUAGES:
        raise HTTPException(400, f"Language must be one of {ai.INDIAN_LANGUAGES}")
    return _guard(ai.translate_job, _job_dict(job), lang)


@router.get("/languages")
def ai_languages():
    return {"languages": ai.INDIAN_LANGUAGES}


@router.post("/jobs/{job_id}/rank-candidates")
def ai_rank(job_id: int, current: models.User = Depends(get_current_user),
            db: Session = Depends(get_db)):
    """Rank every applicant for one job, with a reason each."""
    if current.role != models.ROLE_ENTERPRISE:
        raise HTTPException(403, "Recruiters only.")
    ent = db.query(models.Enterprise).filter_by(user_id=current.id).first()
    job = db.query(models.Job).filter_by(id=job_id, enterprise_id=ent.id if ent else -1).first()
    if not job:
        raise HTTPException(404, "Job not found.")
    cands = [{"id": a.jobseeker.id,
              "name": f"{a.jobseeker.first_name or ''} {a.jobseeker.last_name or ''}".strip() or a.jobseeker.email,
              "skills": a.jobseeker.key_skills, "education": a.jobseeker.education,
              "experience": a.jobseeker.experience, "location": a.jobseeker.location}
             for a in job.applications]
    if not cands:
        return {"ranked": [], "summary": "No applicants yet."}
    return _guard(ai.rank_candidates, _job_dict(job), cands)


@router.post("/jobs/{job_id}/quality")
def ai_jd_quality(job_id: int, current: models.User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    if current.role not in (models.ROLE_ENTERPRISE, models.ROLE_INSTITUTE):
        raise HTTPException(403, "Recruiters and institutes only.")
    job = db.query(models.Job).get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return _guard(ai.jd_quality, _job_dict(job))


@router.post("/salary")
def ai_salary(body: dict, current: models.User = Depends(get_current_user)):
    role_name = (body.get("role") or "").strip()
    if not role_name:
        raise HTTPException(400, "Which role?")
    return _guard(ai.salary_insight, role_name, body.get("location", ""),
                  body.get("experience", ""), body.get("sector", ""))


@router.post("/jobs/{job_id}/mock-interview")
def ai_mock_interview(job_id: int, body: dict,
                      current: models.User = Depends(require_role(models.ROLE_JOBSEEKER)),
                      db: Session = Depends(get_db)):
    seeker = _my_seeker(current, db)
    job = db.query(models.Job).get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return _guard(ai.mock_interview, _seeker_dict(seeker), _job_dict(job),
                  body.get("history") or [], body.get("answer"))


@router.post("/roadmap")
def ai_roadmap(body: dict, current: models.User = Depends(require_role(models.ROLE_JOBSEEKER)),
               db: Session = Depends(get_db)):
    target = (body.get("target_role") or "").strip()
    if not target:
        raise HTTPException(400, "Which role do you want to reach?")
    return _guard(ai.skill_roadmap, _seeker_dict(_my_seeker(current, db)), target)


# ---------------- shared ----------------
@router.post("/resume/review")
def ai_resume_review(current: models.User = Depends(require_role(models.ROLE_JOBSEEKER)),
                     db: Session = Depends(get_db)):
    return _guard(ai.resume_review, _seeker_dict(_my_seeker(current, db)))


@router.post("/career/advice")
def ai_career_advice(current: models.User = Depends(require_role(models.ROLE_JOBSEEKER)),
                     db: Session = Depends(get_db)):
    return _guard(ai.career_advice, _seeker_dict(_my_seeker(current, db)))


@router.post("/search/parse")
def ai_search(body: dict, current: models.User = Depends(get_current_user)):
    q = (body.get("query") or "").strip()
    if not q:
        raise HTTPException(400, "Type what you're looking for.")
    return _guard(ai.parse_search, q)


@router.post("/suggest")
def ai_suggest(body: dict, current: models.User = Depends(get_current_user)):
    field = (body.get("field") or "").strip()
    if not field:
        raise HTTPException(400, "Field is required.")
    return _guard(ai.suggest_options, field, body.get("context", ""))
