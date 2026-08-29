"""Admin: manager users, approval queue and subscriptions (requirements 3a-3g)."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import require_role, hash_password, generate_password
from ..email_utils import send_credentials_email, send_email
from ..notify_service import notify

router = APIRouter(prefix="/api/admin", tags=["admin"],
                   dependencies=[Depends(require_role(models.ROLE_ADMIN))])


# ---------------------------------------------------------------- 3a: managers
@router.get("/managers")
def list_managers(db: Session = Depends(get_db)):
    rows = (db.query(models.User)
            .filter(models.User.role.in_([models.ROLE_MANAGER, models.ROLE_ADMIN]))
            .order_by(models.User.created_at.desc()).all())
    return [{"id": u.id, "email": u.email, "role": u.role, "is_active": u.is_active,
             "created_at": u.created_at, "must_change_password": u.must_change_password}
            for u in rows]


@router.post("/managers", response_model=schemas.CredentialResult)
def add_manager(body: dict, db: Session = Depends(get_db)):
    """Create a manager (or another admin). Credentials are emailed."""
    email = (body.get("email") or "").strip().lower()
    role = body.get("role") or models.ROLE_MANAGER
    if not email:
        raise HTTPException(400, "Email is required.")
    if role not in (models.ROLE_MANAGER, models.ROLE_ADMIN):
        raise HTTPException(400, "Role must be 'manager' or 'admin'.")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(400, "A user with this email already exists.")

    password = generate_password()
    user = models.User(email=email, password_hash=hash_password(password),
                       role=role, must_change_password=True)
    db.add(user)
    db.commit()
    try:
        send_credentials_email(email, body.get("name") or email, email, password)
    except Exception:
        pass
    return schemas.CredentialResult(email=email, user_id=email, password=password,
                                    status=f"{role.title()} user created")


@router.put("/managers/{user_id}/status", response_model=schemas.Message)
def set_manager_status(user_id: int, body: dict, db: Session = Depends(get_db)):
    u = db.query(models.User).get(user_id)
    if not u or u.role not in (models.ROLE_MANAGER, models.ROLE_ADMIN):
        raise HTTPException(404, "Manager not found.")
    u.is_active = bool(body.get("is_active", True))
    db.commit()
    return {"message": f"{u.email} {'enabled' if u.is_active else 'disabled'}."}


# ------------------------------------------------- 3b/3c/3d: approval queue
def _pending(db: Session):
    return {
        "institutes": db.query(models.Institute).filter_by(approval_status="pending").all(),
        "enterprises": db.query(models.Enterprise).filter_by(approval_status="pending").all(),
        "jobseekers": db.query(models.JobSeeker)
                        .filter_by(approval_status="pending", registration_source="self").all(),
    }


@router.get("/approvals")
def approval_queue(db: Session = Depends(get_db)):
    """Everything waiting for admin sign-off."""
    p = _pending(db)
    return {
        "counts": {k: len(v) for k, v in p.items()},
        "institutes": [{"id": i.id, "name": i.name, "email": i.email, "city": i.city,
                        "phone": i.phone, "website": i.website, "courses": i.courses or [],
                        "created_at": i.created_at} for i in p["institutes"]],
        "enterprises": [{"id": e.id, "name": e.name, "email": e.email, "city": e.city,
                         "phone": e.phone, "gst_no": e.gst_no, "pan_no": e.pan_no,
                         "created_at": e.created_at} for e in p["enterprises"]],
        "jobseekers": [{"id": s.id, "name": f"{s.first_name or ''} {s.last_name or ''}".strip() or s.email,
                        "email": s.email, "phone": s.phone, "location": s.location,
                        "skills": s.key_skills or [], "created_at": s.created_at}
                       for s in p["jobseekers"]],
    }


@router.get("/registrations")
def registrations(kind: str = "all", status: str = "all", q: str | None = None,
                  db: Session = Depends(get_db)):
    """Every registration in one place — pending, approved and rejected.

    Powers the consolidated Registrations tab: one screen, filter by type and
    status, search as you type.
    """
    out = []

    def add(rows, k, name_fn):
        for r in rows:
            out.append({
                "kind": k, "id": r.id, "name": name_fn(r), "email": r.email,
                "phone": getattr(r, "phone", None),
                "city": getattr(r, "city", None) or getattr(r, "location", None),
                "status": r.approval_status or "approved",
                "source": getattr(r, "registration_source", "admin"),
                "created_at": r.created_at,
                "approved_at": getattr(r, "approved_at", None),
                "reason": getattr(r, "rejection_reason", None),
                "extra": (", ".join(getattr(r, "courses", None) or [])
                          if k == "institute" else
                          (r.gst_no or "") if k == "enterprise" else
                          ", ".join(getattr(r, "key_skills", None) or [])),
                "active": bool(r.user.is_active) if r.user else False,
            })

    if kind in ("all", "institute"):
        add(db.query(models.Institute).all(), "institute", lambda r: r.name)
    if kind in ("all", "enterprise"):
        add(db.query(models.Enterprise).all(), "enterprise", lambda r: r.name)
    if kind in ("all", "jobseeker"):
        add(db.query(models.JobSeeker).all(), "jobseeker",
            lambda r: f"{r.first_name or ''} {r.last_name or ''}".strip() or r.email)

    if status != "all":
        out = [o for o in out if o["status"] == status]
    if q:
        ql = q.lower()
        out = [o for o in out
               if ql in (o["name"] or "").lower() or ql in (o["email"] or "").lower()
               or ql in (o["city"] or "").lower() or ql in (o["extra"] or "").lower()]

    out.sort(key=lambda o: (o["created_at"] or ""), reverse=True)
    counts = {"all": len(out)}
    for st in ("pending", "approved", "rejected"):
        counts[st] = sum(1 for o in out if o["status"] == st)
    return {"counts": counts, "items": out[:400]}


MODEL_FOR = {"institute": models.Institute, "enterprise": models.Enterprise,
             "jobseeker": models.JobSeeker}


@router.post("/approvals/{kind}/{obj_id}", response_model=schemas.Message)
def decide_approval(kind: str, obj_id: int, body: dict,
                    current: models.User = Depends(require_role(models.ROLE_ADMIN)),
                    db: Session = Depends(get_db)):
    """Approve or reject a pending account. Body: {"decision": "approved"|"rejected", "reason": ""}"""
    Model = MODEL_FOR.get(kind)
    if not Model:
        raise HTTPException(400, "kind must be institute, enterprise or jobseeker.")
    decision = body.get("decision")
    if decision not in ("approved", "rejected"):
        raise HTTPException(400, "decision must be 'approved' or 'rejected'.")

    obj = db.query(Model).get(obj_id)
    if not obj:
        raise HTTPException(404, f"{kind.title()} not found.")

    obj.approval_status = decision
    obj.approved_at = datetime.utcnow()
    obj.approved_by = current.id
    if hasattr(obj, "rejection_reason"):
        obj.rejection_reason = body.get("reason") if decision == "rejected" else None

    # A rejected account can't log in.
    if obj.user:
        obj.user.is_active = decision == "approved"

    name = getattr(obj, "name", None) or getattr(obj, "email", "Account")
    if obj.user:
        notify(db, obj.user.id, "system",
               f"Your account was {decision}",
               body.get("reason") or f"Your {kind} account has been {decision} by the QCloneJob team.",
               "/", commit=False)
    db.commit()

    try:
        email_to = getattr(obj, "email", None)
        if email_to:
            if decision == "approved":
                send_email(email_to, "Your QCloneJob account is approved",
                           f"Good news — your {kind} account has been approved.\n\n"
                           f"You can now log in and start using QCloneJob.\n")
            else:
                send_email(email_to, "About your QCloneJob registration",
                           f"Thank you for registering.\n\nWe couldn't approve your {kind} "
                           f"account at this time.\n\nReason: {body.get('reason') or 'Not specified'}\n")
    except Exception:
        pass
    return {"message": f"{name} {decision}."}


@router.get("/registrations")
def registrations(kind: str = "all", status: str = "all", q: str | None = None,
                  db: Session = Depends(get_db)):
    """One list for every account type — pending, approved or rejected.

    Replaces the separate Institutes / Enterprises / Job seekers tabs with a
    single searchable view.
    """
    out = []

    def add(rows, k):
        for r in rows:
            name = getattr(r, "name", None) or \
                   f"{getattr(r, 'first_name', '') or ''} {getattr(r, 'last_name', '') or ''}".strip() or r.email
            out.append({
                "kind": k, "id": r.id, "name": name, "email": r.email,
                "phone": getattr(r, "phone", None), "city": getattr(r, "city", None),
                "status": getattr(r, "approval_status", "approved") or "approved",
                "source": getattr(r, "registration_source", "admin"),
                "created_at": r.created_at,
                "approved_at": getattr(r, "approved_at", None),
                "rejection_reason": getattr(r, "rejection_reason", None),
                "extra": (r.courses or []) if k == "institute"
                         else ([r.gst_no, r.pan_no] if k == "enterprise"
                               else (getattr(r, "key_skills", None) or [])),
                "logo_url": getattr(r, "logo_url", None) or getattr(r, "profile_picture_url", None),
                "is_active": bool(r.user.is_active) if r.user else True,
            })

    if kind in ("all", "institute"):
        add(db.query(models.Institute).all(), "institute")
    if kind in ("all", "enterprise"):
        add(db.query(models.Enterprise).all(), "enterprise")
    if kind in ("all", "jobseeker"):
        add(db.query(models.JobSeeker).all(), "jobseeker")

    if status != "all":
        out = [r for r in out if r["status"] == status]
    if q:
        ql = q.lower()
        out = [r for r in out
               if ql in (r["name"] or "").lower() or ql in (r["email"] or "").lower()
               or ql in (r["city"] or "").lower()]

    out.sort(key=lambda r: r["created_at"] or "", reverse=True)
    counts = {"all": len(out)}
    for k in ("institute", "enterprise", "jobseeker"):
        counts[k] = sum(1 for r in out if r["kind"] == k)
    for st in ("pending", "approved", "rejected"):
        counts[st] = sum(1 for r in out if r["status"] == st)
    return {"counts": counts, "items": out[:300]}


# ---------------------------------------------------------------- 3e: reset password
@router.post("/users/reset-password", response_model=schemas.CredentialResult)
def reset_any_password(body: dict, db: Session = Depends(get_db)):
    """Reset any user's password by email and send them the new one."""
    email = (body.get("email") or "").strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, "No user with that email.")
    password = body.get("password") or generate_password()
    user.password_hash = hash_password(password)
    user.must_change_password = True
    user.is_active = True
    db.commit()
    try:
        send_credentials_email(user.email, user.email, user.email, password)
    except Exception:
        pass
    return schemas.CredentialResult(email=user.email, user_id=user.email,
                                    password=password, status="Password reset and emailed")


@router.get("/users")
def search_users(q: str | None = None, role: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.User)
    if role:
        query = query.filter(models.User.role == role)
    if q:
        query = query.filter(models.User.email.ilike(f"%{q}%"))
    rows = query.order_by(models.User.created_at.desc()).limit(100).all()
    return [{"id": u.id, "email": u.email, "role": u.role, "is_active": u.is_active,
             "created_at": u.created_at} for u in rows]


# ------------------------------------------------------- 3f/3g: subscriptions
def _plan(key: str) -> dict | None:
    return next((p for p in models.SUBSCRIPTION_PLANS if p["key"] == key), None)


@router.get("/plans")
def list_plans():
    return {"plans": models.SUBSCRIPTION_PLANS}


@router.get("/subscriptions")
def list_subscriptions(db: Session = Depends(get_db)):
    rows = db.query(models.Subscription).order_by(models.Subscription.created_at.desc()).all()
    out = []
    now = datetime.utcnow()
    for s in rows:
        u = db.query(models.User).get(s.user_id)
        expired = bool(s.expires_at and s.expires_at < now)
        out.append({
            "id": s.id, "user_id": s.user_id, "email": u.email if u else "—",
            "role": u.role if u else "—", "plan": s.plan,
            "status": "expired" if expired else s.status,
            "started_at": s.started_at, "expires_at": s.expires_at,
            "amount": s.amount, "auto_renew": s.auto_renew,
            "days_left": max(0, (s.expires_at - now).days) if s.expires_at else None,
            "jobs_posted": s.jobs_posted, "resume_views_used": s.resume_views_used,
        })
    return out


@router.post("/subscriptions", response_model=schemas.Message)
def subscribe(body: dict, db: Session = Depends(get_db)):
    """Start (3f) or renew (3g) a subscription for a user."""
    email = (body.get("email") or "").strip().lower()
    plan_key = body.get("plan") or "starter"
    plan = _plan(plan_key)
    if not plan:
        raise HTTPException(400, f"Unknown plan. Choose from "
                                 f"{[p['key'] for p in models.SUBSCRIPTION_PLANS]}.")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, "No user with that email.")

    existing = (db.query(models.Subscription)
                .filter_by(user_id=user.id)
                .order_by(models.Subscription.created_at.desc()).first())

    now = datetime.utcnow()
    # Renewing an unexpired plan extends from its end date, not from today,
    # so the customer never loses days they've already paid for.
    base = existing.expires_at if (existing and existing.expires_at and existing.expires_at > now) else now
    renewing = bool(existing and existing.plan == plan_key and existing.status == "active")

    if renewing:
        existing.expires_at = base + timedelta(days=plan["days"])
        existing.amount = (existing.amount or 0) + plan["price"]
        existing.status = "active"
        existing.auto_renew = bool(body.get("auto_renew", existing.auto_renew))
        msg = f"{plan['name']} renewed for {user.email} until {existing.expires_at:%d %b %Y}."
    else:
        if existing:
            existing.status = "cancelled"
        sub = models.Subscription(
            user_id=user.id, plan=plan_key, status="active",
            started_at=now, expires_at=base + timedelta(days=plan["days"]),
            amount=plan["price"], auto_renew=bool(body.get("auto_renew", False)),
        )
        db.add(sub)
        msg = f"{plan['name']} activated for {user.email} until {sub.expires_at:%d %b %Y}."

    notify(db, user.id, "system", "Subscription updated", msg, "/", commit=False)
    db.commit()
    return {"message": msg}


@router.put("/subscriptions/{sub_id}/cancel", response_model=schemas.Message)
def cancel_subscription(sub_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Subscription).get(sub_id)
    if not s:
        raise HTTPException(404, "Subscription not found.")
    s.status = "cancelled"
    s.auto_renew = False
    db.commit()
    return {"message": "Subscription cancelled."}


# ---------------------------------------------------------------- email delivery
@router.get("/email-log")
def email_log(limit: int = 50, status: str | None = None, db: Session = Depends(get_db)):
    """Every email attempt and its real outcome — so a silent failure is visible."""
    q = db.query(models.EmailLog)
    if status:
        q = q.filter(models.EmailLog.status == status)
    rows = q.order_by(models.EmailLog.created_at.desc()).limit(limit).all()
    total = db.query(models.EmailLog).count()
    failed = db.query(models.EmailLog).filter_by(status="failed").count()
    sent = db.query(models.EmailLog).filter_by(status="sent").count()
    console = db.query(models.EmailLog).filter_by(status="console").count()
    return {
        "totals": {"total": total, "sent": sent, "failed": failed, "console": console},
        "items": [{"id": r.id, "to": r.to_email, "subject": r.subject, "kind": r.kind,
                   "status": r.status, "error": r.error, "provider": r.provider,
                   "created_at": r.created_at} for r in rows],
    }


@router.delete("/email-log", response_model=schemas.Message)
def clear_email_log(status: str | None = None, db: Session = Depends(get_db)):
    """Clear delivery history. Pass ?status=failed to clear only failures."""
    q = db.query(models.EmailLog)
    if status:
        q = q.filter(models.EmailLog.status == status)
    n = q.delete(synchronize_session=False)
    db.commit()
    return {"message": f"Cleared {n} email log entr{'y' if n == 1 else 'ies'}."}


@router.post("/email-log/{log_id}/resend", response_model=schemas.Message)
def resend_email(log_id: int, db: Session = Depends(get_db)):
    """Retry a failed email (useful right after fixing SMTP settings)."""
    row = db.query(models.EmailLog).get(log_id)
    if not row:
        raise HTTPException(404, "Log entry not found.")
    res = send_email(row.to_email, row.subject,
                     "Resending your earlier QCloneJob message.\n\n"
                     "If you were expecting login details and they are missing, "
                     "ask an administrator to reset your password.",
                     kind=row.kind or "other")
    if not res["ok"]:
        raise HTTPException(400, res.get("error") or "Send failed.")
    return {"message": f"Resent to {row.to_email}."}
