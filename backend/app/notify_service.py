"""Creates in-app notifications (and optional emails) for platform events.

Called from routers when something happens: a recruiter views a profile, an application
status changes, a message arrives, or a new job matches a seeker's skills.
"""
from sqlalchemy.orm import Session

from . import models
from .email_utils import send_email


def notify(db: Session, user_id: int, kind: str, title: str,
           body: str = "", link: str = "", commit: bool = True) -> models.Notification:
    n = models.Notification(user_id=user_id, kind=kind, title=title, body=body, link=link)
    db.add(n)
    if commit:
        db.commit()
    return n


def notify_job_alert(db: Session, job: models.Job) -> int:
    """When a job is posted, alert seekers whose skills overlap the job's skills.

    Kept deliberately simple and portable (JSON columns work on SQLite and Postgres).
    At scale, move this to a background worker and a JSONB/GIN query.
    """
    job_skills = {s.strip().lower() for s in (job.key_skills or []) if s and s.strip()}
    if not job_skills:
        return 0

    alerted = 0
    for seeker in db.query(models.JobSeeker).all():
        seeker_skills = {s.strip().lower() for s in (seeker.key_skills or []) if s and s.strip()}
        if not seeker_skills or not (seeker_skills & job_skills):
            continue
        notify(db, seeker.user_id, "job",
               f"New job matching your skills: {job.title}",
               f"{job.location or ''} · {', '.join(sorted(seeker_skills & job_skills))}".strip(" ·"),
               "/jobseeker/recommended", commit=False)
        alerted += 1

        # Best-effort email alert; never break the posting flow on a mail error.
        if seeker.email:
            try:
                send_email(seeker.email, f"New job on Hire: {job.title}",
                           f"A new job matching your skills was posted.\n\n"
                           f"  {job.title}\n  {job.location or ''}\n\n"
                           f"Log in to Hire to view and apply.")
            except Exception:
                pass

    db.commit()
    return alerted


def match_score(seeker: models.JobSeeker, job: models.Job) -> tuple[int, list[str]]:
    """Return (0-100 score, matched skills) for how well a seeker fits a job."""
    job_skills = {s.strip().lower() for s in (job.key_skills or []) if s and s.strip()}
    seeker_skills = {s.strip().lower() for s in (seeker.key_skills or []) if s and s.strip()}

    score = 0
    matched = sorted(seeker_skills & job_skills)

    # Skills carry most of the weight.
    if job_skills:
        score += int(70 * len(matched) / len(job_skills))
    elif seeker_skills:
        score += 25  # no skills listed on the job — neutral partial credit

    # Location match.
    if job.location and seeker.location and job.location.strip().lower() in seeker.location.strip().lower():
        score += 15

    # Education keyword appears in the job's education requirement.
    edu_text = " ".join(
        f"{e.get('degree','')} {e.get('branch','')}" for e in (seeker.education or [])
    ).lower()
    req = (job.requirement_education or "").lower()
    if req and edu_text and any(tok and tok in req for tok in edu_text.split()):
        score += 15

    return min(score, 100), matched
