from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(limit: int = 20, current: models.User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    rows = (db.query(models.Notification)
            .filter(models.Notification.user_id == current.id)
            .order_by(models.Notification.created_at.desc())
            .limit(limit).all())
    unread = db.query(models.Notification).filter_by(user_id=current.id, is_read=False).count()
    return {
        "unread": unread,
        "items": [
            {"id": n.id, "kind": n.kind, "title": n.title, "body": n.body,
             "link": n.link, "is_read": n.is_read, "created_at": n.created_at}
            for n in rows
        ],
    }


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, current: models.User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    db.query(models.Notification).filter_by(id=notification_id, user_id=current.id)\
        .update({"is_read": True})
    db.commit()
    return {"message": "Marked as read."}


@router.post("/read-all")
def mark_all_read(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(models.Notification).filter_by(user_id=current.id, is_read=False)\
        .update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read."}
