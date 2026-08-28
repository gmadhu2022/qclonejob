"""Creating in-app notifications (and optional email) in one place."""
from sqlalchemy.orm import Session

from . import models
from .email_utils import send_email


def notify(db: Session, user_id: int, kind: str, title: str,
           body: str = "", link: str = "", email_to: str | None = None) -> models.Notification:
    """Create an in-app notification. If email_to is given, also send an email
    (failures are swallowed so a mail problem never breaks the main action)."""
    n = models.Notification(user_id=user_id, kind=kind, title=title, body=body, link=link)
    db.add(n)
    db.flush()
    if email_to:
        try:
            send_email(email_to, title, body or title)
        except Exception:
            pass
    return n


def notify_matching_seekers(db: Session, job: models.Job) -> int:
    """When a job is posted, alert seekers whose skills or location match.
    Returns how many were notified."""
    job_skills = {s.strip().lower() for s in (job.key_skills or []) if s and s.strip()}
    loc = (job.location or "").strip().lower()
    if not job_skills and not loc:
        return 0

    count = 0
    for seeker in db.query(models.JobSeeker).all():
        seeker_skills = {s.strip().lower() for s in (seeker.key_skills or []) if s and s.strip()}
        skill_hit = bool(job_skills & seeker_skills)
        loc_hit = bool(loc and seeker.location and loc in seeker.location.strip().lower())
        if not (skill_hit or loc_hit):
            continue
        notify(
            db, seeker.user_id, "job",
            f'New job matching your profile: {job.title}',
            f'{job.title} in {job.location or "—"}. '
            f'Skills: {", ".join(job.key_skills or []) or "—"}.',
            link="/jobseeker/jobs",
        )
        count += 1
    return count
