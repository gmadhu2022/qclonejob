"""Image uploads (profile photos, company / institute logos).

Accepts up to 5 MB (item 3) and **compresses before storing** so the file that
actually lands in storage is a fraction of the upload — important on Supabase's
1 GB free tier, where uncompressed phone photos would exhaust the quota fast.

Files are written to backend/uploads and served at /uploads/<name>. To move to
Supabase Storage, replace `_store()` — nothing else depends on where bytes live.
"""
import io
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from PIL import Image, ImageOps

from .. import models
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_BYTES = 5 * 1024 * 1024          # 5 MB for photos/logos

# Banner media (item 4): HD stills, animated GIFs, video and audio.
MEDIA_ALLOWED = {
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image",
    ".gif": "gif",
    ".mp4": "video", ".webm": "video", ".mov": "video",
    ".mp3": "audio", ".wav": "audio", ".m4a": "audio", ".ogg": "audio",
}
MEDIA_MAX = {"image": 8 * 1024 * 1024, "gif": 12 * 1024 * 1024,
             "video": 50 * 1024 * 1024, "audio": 15 * 1024 * 1024}
# HD stills are kept large enough to stay crisp on desktop banners.
BANNER_MAX_DIM = (1920, 1080)

# Target dimensions per use — anything larger is downscaled before saving.
MAX_DIM = {"avatar": (600, 600), "logo": (800, 800)}
WEBP_QUALITY = 82


def _compress(data: bytes, kind: str) -> tuple[bytes, str]:
    """Downscale + re-encode to WebP. Returns (bytes, extension)."""
    try:
        im = Image.open(io.BytesIO(data))
        im = ImageOps.exif_transpose(im)          # honour phone orientation
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
            im = Image.alpha_composite(bg, im).convert("RGB")
        else:
            im = im.convert("RGB")
        im.thumbnail(MAX_DIM.get(kind, (800, 800)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="WEBP", quality=WEBP_QUALITY, method=6)
        return buf.getvalue(), ".webp"
    except Exception:
        # If the image can't be processed, fall back to storing it unchanged.
        return data, ".png"


def _store(data: bytes, ext: str) -> str:
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return f"/uploads/{name}"


@router.post("/image")
async def upload_image(kind: str = "avatar", file: UploadFile = File(...),
                       current: models.User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """kind: avatar (job seeker photo) | logo (enterprise / institute logo)."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(400, "Please upload a PNG, JPG, WEBP or GIF image.")

    data = await file.read()
    original = len(data)
    if original > MAX_BYTES:
        raise HTTPException(400, "Image must be 5 MB or smaller.")

    data, ext = _compress(data, kind)
    url = _store(data, ext)

    if kind == "avatar" and current.role == models.ROLE_JOBSEEKER and current.jobseeker:
        current.jobseeker.profile_picture_url = url
    elif kind == "logo" and current.role == models.ROLE_ENTERPRISE and current.enterprise:
        current.enterprise.logo_url = url
    elif kind == "logo" and current.role == models.ROLE_INSTITUTE and current.institute:
        current.institute.logo_url = url
    else:
        raise HTTPException(400, "This upload type doesn't apply to your account.")

    db.commit()
    saved = len(data)
    return {
        "url": url,
        "original_bytes": original,
        "stored_bytes": saved,
        "saved_percent": round(100 * (1 - saved / original)) if original else 0,
        "message": f"Image uploaded ({saved // 1024} KB stored, "
                   f"{round(100 * (1 - saved / original)) if original else 0}% smaller).",
    }


@router.post("/media")
async def upload_media(file: UploadFile = File(...),
                       current: models.User = Depends(get_current_user)):
    """Upload banner media: HD image, GIF, video or audio (item 4).

    Still images are re-encoded to WebP at up to 1920x1080 so banners stay HD but small.
    GIFs, video and audio are stored as-is to preserve animation and playback.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    kind = MEDIA_ALLOWED.get(ext)
    if not kind:
        raise HTTPException(400, "Supported: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, MP3, WAV, M4A, OGG.")

    data = await file.read()
    limit = MEDIA_MAX[kind]
    if len(data) > limit:
        raise HTTPException(400, f"{kind.title()} files must be {limit // (1024 * 1024)} MB or smaller.")

    original = len(data)
    if kind == "image":
        try:
            im = Image.open(io.BytesIO(data))
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail(BANNER_MAX_DIM, Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, format="WEBP", quality=88, method=6)
            data, ext = buf.getvalue(), ".webp"
        except Exception:
            pass   # store the original if it can't be processed

    url = _store(data, ext)
    return {
        "url": url, "media_type": kind,
        "original_bytes": original, "stored_bytes": len(data),
        "message": f"{kind.title()} uploaded ({len(data) // 1024} KB).",
    }
