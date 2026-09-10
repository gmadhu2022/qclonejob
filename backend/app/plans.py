"""Plan quotas, enforced server-side.

Every limit here is checked on the WRITE endpoint, not in the UI. A limit that
only exists in the frontend is bypassed by one curl request, so the React code
treats these numbers as a display hint and this module treats them as the rule.

Counts come from the actual rows (jobs / banners owned by the enterprise) rather
than a running counter on the subscription. A counter drifts the moment anything
is deleted, backfilled or created by an admin; counting rows cannot.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from . import models


# Hard ceiling on how long a job posting stays live, regardless of plan.
# Stale postings are the fastest way for a job board to lose seeker trust:
# people apply, nobody answers, they stop applying.
JOB_MAX_VALIDITY_DAYS = 20


def job_expiry(requested=None) -> datetime:
    """End date for a posting: whatever was asked for, capped at 20 days.

    Accepts a date/datetime or an ISO string; anything unparseable falls back
    to the cap rather than raising, because a bad date in the payload should
    not stop someone posting a job.
    """
    cap = datetime.utcnow() + timedelta(days=JOB_MAX_VALIDITY_DAYS)
    if not requested:
        return cap
    if isinstance(requested, str):
        try:
            requested = datetime.fromisoformat(requested.replace("Z", "").strip()[:19])
        except ValueError:
            return cap
    if isinstance(requested, datetime):
        return min(requested, cap) if requested > datetime.utcnow() else cap
    return cap


def live_jobs(query):
    """Narrow a Job query to postings a seeker should actually see.

    Active AND not past its expiry. Applied through one helper rather than
    repeated inline, because a listing that forgets the expiry check is
    indistinguishable from a working one until a stale job gets an
    application — and that is a wasted application for the seeker and a
    complaint for the recruiter.

    Rows with a NULL expires_at are treated as live: they predate the column.
    """
    from . import models
    return query.filter(
        models.Job.status == "active",
        or_(models.Job.expires_at.is_(None), models.Job.expires_at > datetime.utcnow()),
    )


PURGE_AFTER_DAYS = 180          # ~6 months


def purge_expired_jobs(db: Session) -> int:
    """Delete jobs that expired more than PURGE_AFTER_DAYS ago.

    Applications reference jobs, so those go first — otherwise the delete
    fails on a foreign key (SQLite) or orphans rows (Postgres without
    ON DELETE CASCADE). A job seeker's application history for a six-month-old
    expired posting has no value to anyone; the job itself is gone.
    """
    from . import models
    cutoff = datetime.utcnow() - timedelta(days=PURGE_AFTER_DAYS)
    doomed = [j.id for j in db.query(models.Job.id)
              .filter(models.Job.expires_at.isnot(None),
                      models.Job.expires_at < cutoff).all()]
    if not doomed:
        return 0
    db.query(models.Application).filter(models.Application.job_id.in_(doomed)).delete(
        synchronize_session=False)
    db.query(models.Job).filter(models.Job.id.in_(doomed)).delete(synchronize_session=False)
    db.commit()
    return len(doomed)


def plan_def(key: str) -> dict:
    """Look up a plan, falling back to the free plan for unknown keys."""
    for p in models.SUBSCRIPTION_PLANS:
        if p["key"] == key:
            return p
    for p in models.SUBSCRIPTION_PLANS:
        if p["key"] == models.DEFAULT_PLAN:
            return p
    return models.SUBSCRIPTION_PLANS[0]


def active_subscription(db: Session, user_id: int) -> Optional[models.Subscription]:
    """The user's live subscription, if any.

    An expired paid plan is treated as no plan, so quotas silently fall back to
    Standard instead of leaving a lapsed account on Unlimited.
    """
    sub = (db.query(models.Subscription)
           .filter(models.Subscription.user_id == user_id,
                   models.Subscription.status == "active")
           .order_by(models.Subscription.created_at.desc())
           .first())
    if sub and sub.expires_at and sub.expires_at < datetime.utcnow():
        sub.status = "expired"
        db.commit()
        return None
    return sub


def current_plan(db: Session, user_id: int) -> dict:
    sub = active_subscription(db, user_id)
    return plan_def(sub.plan if sub else models.DEFAULT_PLAN)


def usage(db: Session, user: models.User) -> dict:
    """Everything the UI needs to render quota bars and the upgrade prompt."""
    plan = current_plan(db, user.id)
    sub = active_subscription(db, user.id)
    ent = getattr(user, "enterprise", None)

    jobs_used = 0
    if ent:
        jobs_used = db.query(models.Job).filter(models.Job.enterprise_id == ent.id).count()
    # Banner has no enterprise_id — it is owned via posted_by_user_id.
    ads_used = db.query(models.Banner).filter(
        models.Banner.posted_by_user_id == user.id).count()

    def remaining(limit, used):
        return None if not limit else max(0, limit - used)   # None == unlimited

    return {
        "plan": plan["key"],
        "plan_name": plan["name"],
        "price": plan["price"],
        "currency": plan["currency"],
        "expires_at": sub.expires_at.isoformat() if sub and sub.expires_at else None,
        "jobs": {"used": jobs_used, "limit": plan["job_limit"],
                 "remaining": remaining(plan["job_limit"], jobs_used)},
        "ads": {"used": ads_used, "limit": plan["ad_limit"],
                "remaining": remaining(plan["ad_limit"], ads_used)},
        "resume_views": {"used": sub.resume_views_used if sub else 0,
                         "limit": plan["resume_views"]},
        "ad_validity_minutes": plan["ad_validity_minutes"],
        "plans": models.SUBSCRIPTION_PLANS,
    }


def _deny(what: str, used: int, limit: int, plan_name: str):
    raise HTTPException(
        status_code=402,          # Payment Required — distinguishable from a 403
        detail=(f"Your {plan_name} plan allows {limit} {what}. "
                f"You've used {used}. Upgrade your plan to post more."),
    )


def check_job_quota(db: Session, user: models.User):
    """Call BEFORE creating a job. Raises 402 when the plan is exhausted."""
    ent = getattr(user, "enterprise", None)
    if not ent:
        return
    plan = current_plan(db, user.id)
    limit = plan["job_limit"]
    if not limit:
        return                                   # 0 == unlimited
    used = db.query(models.Job).filter(models.Job.enterprise_id == ent.id).count()
    if used >= limit:
        _deny("job posts", used, limit, plan["name"])


def check_ad_quota(db: Session, user: models.User):
    """Call BEFORE creating a banner/ad."""
    ent = getattr(user, "enterprise", None)
    if not ent:
        return
    plan = current_plan(db, user.id)
    limit = plan["ad_limit"]
    if not limit:
        return
    used = db.query(models.Banner).filter(
        models.Banner.posted_by_user_id == user.id).count()
    if used >= limit:
        _deny("advertisement(s)", used, limit, plan["name"])


def ad_expiry(db: Session, user: models.User) -> datetime:
    """End date for a newly posted ad, capped by the plan's validity window."""
    minutes = current_plan(db, user.id)["ad_validity_minutes"]
    return datetime.utcnow() + timedelta(minutes=minutes)
