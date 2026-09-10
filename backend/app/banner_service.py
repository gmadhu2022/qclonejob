"""Banner selection and analytics.

Two rules drive selection:
  1. **One banner per page.** A page asks for a single banner, not a carousel,
     so nothing rotates under the user while they read.
  2. **No repeats across pages.** Two different pages in the same session should
     show different banners whenever there are enough to go round. We do this by
     hashing the slot name into the eligible pool, which is deterministic (the
     same page always shows the same ad for a given pool) and spreads evenly.

Priority is respected: higher-priority banners occupy the earlier positions in
the ordered pool, so they land on the most-visited slots.
"""
from datetime import date, datetime, timedelta
import hashlib

from sqlalchemy.orm import Session

from . import models


def _eligible(db: Session, audience: str) -> list[models.Banner]:
    today = date.today().isoformat()
    rows = (db.query(models.Banner)
            .filter(models.Banner.status == "active",
                    models.Banner.audience.in_([audience, "all"]))
            .order_by(models.Banner.priority.desc(), models.Banner.id.asc())
            .all())
    out = []
    for b in rows:
        if b.start_date and str(b.start_date) > today:
            continue
        if b.end_date and str(b.end_date) < today:
            continue
        out.append(b)
    return out


def _slot_index(db: Session, slot: str) -> int:
    """Stable sequential index for a page slot (created on first sight)."""
    key = slot or "default"
    row = db.query(models.BannerSlot).filter_by(slot=key).first()
    if not row:
        row = models.BannerSlot(slot=key)
        db.add(row)
        try:
            db.commit()
        except Exception:            # another worker inserted it first
            db.rollback()
            row = db.query(models.BannerSlot).filter_by(slot=key).first()
            if not row:
                return abs(hash(key)) % 997
    return row.id


def pick_for_slot(db: Session, audience: str, slot: str) -> models.Banner | None:
    """Choose exactly one banner for a page.

    Round-robins the eligible pool by the slot's sequential index, so consecutive
    pages get different advertisers whenever the pool is big enough. A daily
    offset rotates the whole assignment, so every advertiser reaches every page
    over time rather than being stuck on one.

    Priority orders the pool, so higher-priority banners occupy the lowest slot
    indexes — the pages registered first, which are the most visited.
    """
    pool = _eligible(db, audience)
    if not pool:
        return None
    idx = _slot_index(db, slot)
    day_offset = (date.today() - date(2026, 1, 1)).days
    return pool[(idx + day_offset) % len(pool)]


def record(db: Session, banner: models.Banner, slot: str, kind: str = "impression") -> None:
    """Increment lifetime totals on the banner and today's row for trends."""
    today = date.today().isoformat()
    row = (db.query(models.BannerEvent)
           .filter_by(banner_id=banner.id, day=today, slot=slot or "default").first())
    if not row:
        row = models.BannerEvent(banner_id=banner.id, day=today, slot=slot or "default",
                                 impressions=0, clicks=0)
        db.add(row)
    if kind == "click":
        row.clicks = (row.clicks or 0) + 1
        banner.clicks = (banner.clicks or 0) + 1
    else:
        row.impressions = (row.impressions or 0) + 1
        banner.impressions = (banner.impressions or 0) + 1
    db.commit()


def serialise(b: models.Banner) -> dict:
    return {
        "id": b.id, "title": b.title, "company_name": b.company_name,
        "text_content": b.text_content, "media_type": b.media_type,
        "media_url": b.media_url or b.image_url, "poster_url": b.poster_url,
        "cta_label": b.cta_label, "cta_link": b.cta_link, "theme": b.theme,
        "autoplay": b.autoplay, "muted": b.muted, "logo_url": b.logo_url,
    }


def analytics(db: Session, banners: list[models.Banner], days: int = 14) -> dict:
    """Totals, per-banner breakdown and a daily series for charts."""
    ids = [b.id for b in banners]
    start = date.today() - timedelta(days=days - 1)
    day_keys = [(start + timedelta(days=i)).isoformat() for i in range(days)]

    events = (db.query(models.BannerEvent)
              .filter(models.BannerEvent.banner_id.in_(ids),
                      models.BannerEvent.day >= start.isoformat()).all()
              if ids else [])

    series = {d: {"day": d, "impressions": 0, "clicks": 0} for d in day_keys}
    per_banner = {b.id: {"impressions": 0, "clicks": 0} for b in banners}
    per_slot: dict[str, dict] = {}

    for e in events:
        if e.day in series:
            series[e.day]["impressions"] += e.impressions or 0
            series[e.day]["clicks"] += e.clicks or 0
        if e.banner_id in per_banner:
            per_banner[e.banner_id]["impressions"] += e.impressions or 0
            per_banner[e.banner_id]["clicks"] += e.clicks or 0
        s = per_slot.setdefault(e.slot or "default", {"slot": e.slot or "default",
                                                      "impressions": 0, "clicks": 0})
        s["impressions"] += e.impressions or 0
        s["clicks"] += e.clicks or 0

    total_i = sum(b.impressions or 0 for b in banners)
    total_c = sum(b.clicks or 0 for b in banners)

    def ctr(i, c):
        return round(100 * c / i, 1) if i else 0.0

    items = []
    for b in banners:
        li, lc = b.impressions or 0, b.clicks or 0
        items.append({
            "id": b.id, "title": b.title, "company_name": b.company_name,
            "status": b.status, "audience": b.audience, "media_type": b.media_type,
            "priority": b.priority or 0,
            "impressions": li, "clicks": lc, "ctr": ctr(li, lc),
            "recent_impressions": per_banner.get(b.id, {}).get("impressions", 0),
            "recent_clicks": per_banner.get(b.id, {}).get("clicks", 0),
            "created_at": b.created_at,
        })
    items.sort(key=lambda x: x["impressions"], reverse=True)

    return {
        "totals": {
            "banners": len(banners),
            "active": sum(1 for b in banners if b.status == "active"),
            "impressions": total_i,
            "clicks": total_c,
            "ctr": ctr(total_i, total_c),
        },
        "series": [series[d] for d in day_keys],
        "banners": items,
        "by_slot": sorted(per_slot.values(), key=lambda x: x["impressions"], reverse=True)[:10],
    }
