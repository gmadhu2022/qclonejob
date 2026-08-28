"""Direct messaging between job seekers and recruiters, with blocking.

Rules:
- A job seeker can message any enterprise; an enterprise can message any job seeker.
- Either side can block the other. A blocked sender cannot deliver messages.
- Unread counts power the live notification badges in the UI.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..auth import get_current_user
from ..notify_service import notify
from ..notifications import notify

router = APIRouter(prefix="/api/chat", tags=["chat"])

ONLINE_WINDOW_SECONDS = 90   # treat a user as online if seen within this window


def _touch(db: Session, user: models.User) -> None:
    """Record activity so presence stays fresh (called on every chat request)."""
    user.last_seen_at = datetime.utcnow()
    db.commit()


def _presence(other: models.User) -> dict:
    """Presence respecting the other user's privacy settings."""
    now = datetime.utcnow()
    online = False
    if other.last_seen_at:
        online = (now - other.last_seen_at).total_seconds() <= ONLINE_WINDOW_SECONDS
    return {
        "online": bool(online and other.show_online_status),
        "last_seen": other.last_seen_at if (other.show_last_seen and not online) else None,
        "shows_presence": bool(other.show_online_status or other.show_last_seen),
    }


def _display_name(db: Session, user: models.User) -> str:
    if user.role == models.ROLE_JOBSEEKER and user.jobseeker:
        s = user.jobseeker
        return f"{s.first_name or ''} {s.last_name or ''}".strip() or user.email
    if user.role == models.ROLE_ENTERPRISE and user.enterprise:
        return user.enterprise.name
    if user.role == models.ROLE_INSTITUTE and user.institute:
        return user.institute.name
    return user.email


def _is_blocked(db: Session, blocker_id: int, blocked_id: int) -> bool:
    return db.query(models.Block).filter_by(
        blocker_user_id=blocker_id, blocked_user_id=blocked_id).first() is not None


@router.get("/conversations")
def conversations(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List everyone this user has exchanged messages with, plus last message + unread count."""
    _touch(db, current)
    msgs = (db.query(models.Message)
            .filter(or_(models.Message.sender_user_id == current.id,
                        models.Message.recipient_user_id == current.id))
            .order_by(models.Message.created_at.desc()).all())

    seen = {}
    for m in msgs:
        other_id = m.recipient_user_id if m.sender_user_id == current.id else m.sender_user_id
        if other_id not in seen:
            other = db.query(models.User).get(other_id)
            if not other:
                continue
            seen[other_id] = {
                "user_id": other_id,
                "name": _display_name(db, other),
                "role": other.role,
                **_presence(other),
                "last_message": m.body,
                "last_at": m.created_at,
                "unread": 0,
                "blocked": _is_blocked(db, current.id, other_id),
            }
        if m.recipient_user_id == current.id and not m.is_read:
            seen[other_id]["unread"] += 1
    return list(seen.values())


@router.get("/with/{other_user_id}")
def thread(other_user_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Full message thread with one user. Marks incoming messages as read."""
    other = db.query(models.User).get(other_user_id)
    if not other:
        raise HTTPException(404, "User not found.")
    _touch(db, current)

    db.query(models.Message).filter_by(
        sender_user_id=other_user_id, recipient_user_id=current.id, is_read=False
    ).update({"is_read": True})
    db.commit()

    msgs = (db.query(models.Message)
            .filter(or_(and_(models.Message.sender_user_id == current.id,
                             models.Message.recipient_user_id == other_user_id),
                        and_(models.Message.sender_user_id == other_user_id,
                             models.Message.recipient_user_id == current.id)))
            .order_by(models.Message.created_at.asc()).all())

    return {
        "other": {"user_id": other.id, "name": _display_name(db, other), "role": other.role,
                  **_presence(other)},
        "i_blocked_them": _is_blocked(db, current.id, other_user_id),
        "they_blocked_me": _is_blocked(db, other_user_id, current.id),
        "messages": [
            {"id": m.id, "body": m.body, "mine": m.sender_user_id == current.id,
             "created_at": m.created_at,
             "is_read": m.is_read if other.show_read_receipts else None}
            for m in msgs
        ],
    }


@router.post("/send")
def send_message(body: dict, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    recipient_id = body.get("recipient_user_id")
    text = (body.get("body") or "").strip()
    if not recipient_id or not text:
        raise HTTPException(400, "recipient_user_id and body are required.")

    recipient = db.query(models.User).get(recipient_id)
    if not recipient:
        raise HTTPException(404, "Recipient not found.")
    if _is_blocked(db, recipient_id, current.id):
        raise HTTPException(403, "You cannot message this user — they have blocked you.")
    if _is_blocked(db, current.id, recipient_id):
        raise HTTPException(403, "You have blocked this user. Unblock them to send a message.")

    msg = models.Message(sender_user_id=current.id, recipient_user_id=recipient_id, body=text)
    db.add(msg)
    notify(db, recipient_id, "message",
           f"New message from {_display_name(db, current)}",
           text[:140], link="/messages")
    db.commit()
    db.refresh(msg)
    return {"id": msg.id, "body": msg.body, "mine": True, "created_at": msg.created_at}


@router.post("/start")
def start_conversation(body: dict, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Resolve a jobseeker_id or enterprise_id into a chat user_id so the UI can open a thread."""
    if body.get("jobseeker_id"):
        js = db.query(models.JobSeeker).get(body["jobseeker_id"])
        if not js:
            raise HTTPException(404, "Job seeker not found.")
        return {"user_id": js.user_id, "name": f"{js.first_name or ''} {js.last_name or ''}".strip() or js.email}
    if body.get("enterprise_id"):
        ent = db.query(models.Enterprise).get(body["enterprise_id"])
        if not ent:
            raise HTTPException(404, "Enterprise not found.")
        return {"user_id": ent.user_id, "name": ent.name}
    raise HTTPException(400, "Provide jobseeker_id or enterprise_id.")


@router.post("/block/{other_user_id}")
def block_user(other_user_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not _is_blocked(db, current.id, other_user_id):
        db.add(models.Block(blocker_user_id=current.id, blocked_user_id=other_user_id))
        db.commit()
    return {"message": "User blocked. They can no longer message you."}


@router.post("/unblock/{other_user_id}")
def unblock_user(other_user_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(models.Block).filter_by(
        blocker_user_id=current.id, blocked_user_id=other_user_id).delete()
    db.commit()
    return {"message": "User unblocked."}


@router.get("/unread-count")
def unread_count(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(models.Message).filter_by(recipient_user_id=current.id, is_read=False).count()
    return {"unread": n}


# ---------------- Chat privacy settings (item 7) ----------------
@router.get("/settings")
def get_chat_settings(current: models.User = Depends(get_current_user)):
    return {
        "show_online_status": bool(current.show_online_status),
        "show_last_seen": bool(current.show_last_seen),
        "show_read_receipts": bool(current.show_read_receipts),
    }


@router.put("/settings")
def update_chat_settings(body: dict, current: models.User = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    for key in ("show_online_status", "show_last_seen", "show_read_receipts"):
        if key in body:
            setattr(current, key, bool(body[key]))
    db.commit()
    return {"message": "Chat settings updated."}


@router.post("/heartbeat")
def heartbeat(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Called periodically by the UI so 'online' stays accurate."""
    _touch(db, current)
    return {"ok": True}


@router.get("/blocked")
def blocked_list(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(models.Block).filter_by(blocker_user_id=current.id).all()
    out = []
    for b in rows:
        u = db.query(models.User).get(b.blocked_user_id)
        if u:
            out.append({"user_id": u.id, "name": _display_name(db, u), "role": u.role})
    return out
