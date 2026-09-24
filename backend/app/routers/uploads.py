"""Image uploads (profile photos, company / institute logos).

Accepts up to 5 MB (item 3) and **compresses before storing** so the file that
actually lands in storage is a fraction of the upload — important on Supabase's
1 GB free tier, where uncompressed phone photos would exhaust the quota fast.

Files are written to backend/uploads and served at /uploads/<name>. To move to
Supabase Storage, replace `_store()` — nothing else depends on where bytes live.
"""
import io
import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from PIL import Image, ImageOps

# HEIC/HEIF (iPhone photos) need a plugin; without it Pillow can't open them.
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIF_OK = True
except Exception:                                # pragma: no cover
    HEIF_OK = False

from .. import models
from ..database import get_db
from ..auth import get_current_user

logger = logging.getLogger("qclonejob.uploads")

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Accept anything a phone or camera produces. Everything is converted to WebP
# on save, so the stored format is consistent regardless of what came in.
ALLOWED = {
    ".png", ".jpg", ".jpeg", ".jpe", ".jfif", ".webp", ".gif",
    ".bmp", ".dib", ".tif", ".tiff", ".ico", ".ppm", ".pgm", ".pnm",
    ".heic", ".heif",          # iPhone default
    ".avif", ".jp2", ".j2k", ".tga", ".pcx", ".sgi", ".xbm",
}
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


def _compress(data: bytes, kind: str) -> tuple[bytes, str, tuple | None]:
    """Downscale + re-encode to WebP. Returns (bytes, extension, (w, h))."""
    try:
        im = Image.open(io.BytesIO(data))
        # Animated GIFs: keep only the first frame when converting to a still.
        if getattr(im, "is_animated", False) and kind in ("avatar", "logo"):
            im.seek(0)
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
        return buf.getvalue(), ".webp", im.size
    except Exception as e:
        logger.warning("Image conversion failed (%s); storing original", e)
        return data, ".png", None


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
    # Trust the content type too — some phones send files with no extension.
    if ext not in ALLOWED and not (file.content_type or "").startswith("image/"):
        raise HTTPException(
            400,
            "That doesn't look like an image. JPG, PNG, WEBP, GIF, HEIC, BMP, "
            "TIFF and AVIF are all supported.",
        )
    if ext in (".heic", ".heif") and not HEIF_OK:
        raise HTTPException(
            400,
            "HEIC images need the pillow-heif package on the server "
            "(pip install pillow-heif). Please upload a JPG or PNG for now.",
        )

    data = await file.read()
    original = len(data)
    if original > MAX_BYTES:
        raise HTTPException(400, "Image must be 5 MB or smaller.")

    data, ext, dims = _compress(data, kind)
    url = _store(data, ext)

    if kind == "avatar" and current.role == models.ROLE_JOBSEEKER and current.jobseeker:
        current.jobseeker.profile_picture_url = url
    elif kind == "logo" and current.role == models.ROLE_ENTERPRISE and current.enterprise:
        current.enterprise.logo_url = url
    elif kind == "logo" and current.role == models.ROLE_INSTITUTE and current.institute:
        current.institute.logo_url = url
    else:
        raise HTTPException(400, "This upload type doesn't apply to your account.")

    # Record the asset and retire any previous one of the same kind.
    db.query(models.MediaAsset).filter_by(
        owner_user_id=current.id, kind=kind, is_active=True).update({"is_active": False})
    asset = models.MediaAsset(
        owner_user_id=current.id, kind=kind, url=url,
        original_filename=file.filename, content_type=file.content_type,
        original_bytes=original, stored_bytes=len(data),
        width=dims[0] if dims else None, height=dims[1] if dims else None,
        storage="local",
    )
    db.add(asset)
    db.commit()
    saved = len(data)
    return {
        "id": asset.id,
        "url": url,
        "original_bytes": original,
        "stored_bytes": saved,
        "saved_percent": round(100 * (1 - saved / original)) if original else 0,
        "message": f"Image uploaded ({saved // 1024} KB stored, "
                   f"{round(100 * (1 - saved / original)) if original else 0}% smaller).",
    }


@router.post("/public-image")
async def upload_public_image(kind: str = "logo", file: UploadFile = File(...)):
    """Unauthenticated image upload for the registration pages.

    A recruiter uploads their company logo *before* the account exists, so there
    is no token to authenticate with and no profile row to attach the file to.
    The stored URL is returned and the browser submits it as `logo_url` with the
    registration form; the registration endpoint writes it onto the new record.

    Deliberately narrow: only the same 5 MB image ceiling as /image, no database
    row, no ownership. An orphaned file is created if someone abandons the form
    part-way — cheap, because everything is re-encoded to WebP before storing.
    """
    if kind not in ("logo", "avatar"):
        raise HTTPException(400, "Unsupported upload type.")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED and not (file.content_type or "").startswith("image/"):
        raise HTTPException(
            400,
            "That doesn't look like an image. JPG, PNG, WEBP, GIF, HEIC, BMP, "
            "TIFF and AVIF are all supported.",
        )
    if ext in (".heic", ".heif") and not HEIF_OK:
        raise HTTPException(
            400,
            "HEIC images need the pillow-heif package on the server "
            "(pip install pillow-heif). Please upload a JPG or PNG for now.",
        )

    data = await file.read()
    original = len(data)
    if not data:
        raise HTTPException(400, "That file is empty.")
    if original > MAX_BYTES:
        raise HTTPException(400, "Image must be 5 MB or smaller.")

    # This endpoint is unauthenticated, so verify the bytes really decode as an
    # image rather than falling back to storing them raw the way /image does.
    # Otherwise a corrupt file would be accepted and render as a broken logo.
    try:
        Image.open(io.BytesIO(data)).verify()
    except Exception:
        raise HTTPException(400, "That image looks damaged or unreadable. Please try another file.")

    data, ext, dims = _compress(data, kind)
    url = _store(data, ext)
    saved = len(data)
    logger.info("Public %s upload: %s -> %s (%d KB)", kind, file.filename, url, saved // 1024)
    return {
        "url": url,
        "original_bytes": original,
        "stored_bytes": saved,
        "width": dims[0] if dims else None,
        "height": dims[1] if dims else None,
        "message": f"Logo uploaded ({saved // 1024} KB stored).",
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


@router.post("/flyer")
async def upload_flyer(file: UploadFile = File(...),
                       current: models.User = Depends(get_current_user)):
    """Flyer artwork for a Post a Ad flyer (requirement 55).

    The institute uploads whatever their designer sent — a 4 MB phone photo, a
    tall poster, a wide banner — and the server shrinks it to the mobile app's
    ad slot so every ad renders identically on every handset.

    COVER-CROP, NOT LETTERBOX
    ------------------------
    ImageOps.fit scales to fill the slot and trims the overflow, centred.
    thumbnail() would preserve the whole image and leave white bars down the
    sides of a portrait flyer, which looks like a broken ad rather than a
    deliberate one. Centring the crop keeps a logo or a face in frame far more
    often than cropping from a corner would.

    JPG is what the requirement names and what designers send, but PNG and WEBP
    are accepted too — refusing a PNG would only make someone convert it by
    hand for no benefit, since everything is re-encoded on the way in anyway.
    """
    from ..config import settings

    ext = os.path.splitext(file.filename or "")[1].lower()
    ok_ext = {".jpg", ".jpeg", ".jpe", ".jfif", ".png", ".webp"}
    if ext not in ok_ext and not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Wrong File Format — upload a JPG image for the flyer.")

    data = await file.read()
    original = len(data)
    if not data:
        raise HTTPException(400, "That file is empty.")
    if original > MAX_BYTES:
        raise HTTPException(400, "Flyer image must be 5 MB or smaller.")

    target = (int(getattr(settings, "AD_FLYER_WIDTH", 1080)),
              int(getattr(settings, "AD_FLYER_HEIGHT", 360)))
    try:
        im = Image.open(io.BytesIO(data))
        im = ImageOps.exif_transpose(im)          # honour phone orientation
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
            im = Image.alpha_composite(bg, im).convert("RGB")
        else:
            im = im.convert("RGB")
        source_size = im.size
        im = ImageOps.fit(im, target, Image.LANCZOS, centering=(0.5, 0.5))
        buf = io.BytesIO()
        im.save(buf, format="WEBP", quality=86, method=6)
        data, ext = buf.getvalue(), ".webp"
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "That image looks damaged or unreadable. Please try another file.")

    url = _store(data, ext)
    saved = len(data)
    logger.info("Flyer upload: %s %s -> %s %s (%d KB)",
                file.filename, source_size, url, target, saved // 1024)
    return {
        "url": url,
        "width": target[0], "height": target[1],
        "original_bytes": original, "stored_bytes": saved,
        "saved_percent": round(100 * (1 - saved / original)) if original else 0,
        "message": (f"Flyer resized to {target[0]}×{target[1]} for the mobile ad space "
                    f"({saved // 1024} KB stored)."),
    }


@router.get("/my-media")
def my_media(kind: str | None = None, current: models.User = Depends(get_current_user),
             db: Session = Depends(get_db)):
    """This user's uploads — current and previous."""
    q = db.query(models.MediaAsset).filter_by(owner_user_id=current.id)
    if kind:
        q = q.filter(models.MediaAsset.kind == kind)
    rows = q.order_by(models.MediaAsset.created_at.desc()).limit(50).all()
    return [{"id": m.id, "kind": m.kind, "url": m.url, "filename": m.original_filename,
             "width": m.width, "height": m.height, "stored_bytes": m.stored_bytes,
             "is_active": m.is_active, "created_at": m.created_at} for m in rows]


@router.delete("/media/{asset_id}")
def delete_media(asset_id: int, current: models.User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    m = db.query(models.MediaAsset).filter_by(id=asset_id, owner_user_id=current.id).first()
    if not m:
        raise HTTPException(404, "Not found.")
    try:
        f = UPLOAD_DIR / m.url.rsplit("/", 1)[-1]
        if f.exists():
            f.unlink()
    except Exception:
        pass
    db.delete(m)
    db.commit()
    return {"message": "Image removed."}
