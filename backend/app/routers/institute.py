import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import require_role, get_current_user
from ..resume_service import process_institute_upload, sample_template_dataframe
from ..notify_service import notify_job_alert

router = APIRouter(prefix="/api/institute", tags=["institute"],
                   dependencies=[Depends(require_role(models.ROLE_INSTITUTE))])


def _institute(current: models.User, db: Session) -> models.Institute:
    inst = db.query(models.Institute).filter(models.Institute.user_id == current.id).first()
    if not inst:
        raise HTTPException(404, "Institute profile not found.")
    return inst


# ---------------- Profile ----------------
@router.get("/profile", response_model=schemas.InstituteOut)
def get_profile(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _institute(current, db)


@router.put("/profile", response_model=schemas.InstituteOut)
def update_profile(body: schemas.InstituteBase,
                   current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    inst = _institute(current, db)
    for k, v in body.model_dump(exclude={"email"}).items():
        setattr(inst, k, v)
    db.commit()
    db.refresh(inst)
    return inst


# ---------------- Data upload (THE emphasized flow) ----------------
@router.get("/upload-template")
def download_upload_template():
    """Download a blank .xlsx the institute can fill in and upload."""
    df = sample_template_dataframe()
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=qclonejob_student_upload_template.xlsx"},
    )


@router.post("/upload")
async def upload_students(file: UploadFile = File(...),
                          current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Upload an Excel of 1..N students. For each row we auto-create a resume,
    generate credentials, store in DB, and email the student their user id + password."""
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Please upload an .xlsx or .xls file.")
    inst = _institute(current, db)
    contents = await file.read()
    try:
        results = process_institute_upload(contents, inst, db)
    except Exception as e:
        raise HTTPException(400, f"Could not read the spreadsheet: {e}")

    created = sum(1 for r in results if r.get("outcome") == "created")
    dupes = sum(1 for r in results if r.get("outcome") == "duplicate")
    skipped = sum(1 for r in results if r.get("outcome") == "skipped")

    # Requirement 1f — capture WHEN the data was uploaded, and by whom.
    batch = models.UploadBatch(
        institute_id=inst.id, uploaded_by_user_id=current.id,
        filename=file.filename, total_rows=len(results),
        created_count=created, duplicate_count=dupes, skipped_count=skipped,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    parts = [f"{created} student account(s) created"]
    if dupes:
        parts.append(f"{dupes} duplicate(s) ignored")
    if skipped:
        parts.append(f"{skipped} row(s) skipped")
    return {
        "message": "Upload complete — " + ", ".join(parts) + ".",
        "results": results,
        "batch": {"id": batch.id, "filename": batch.filename,
                  "uploaded_at": batch.uploaded_at, "total_rows": batch.total_rows,
                  "created": created, "duplicates": dupes, "skipped": skipped},
    }


@router.get("/upload-history")
def upload_history(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Every upload this institute has made, with date and time (requirement 1f)."""
    inst = _institute(current, db)
    rows = (db.query(models.UploadBatch).filter_by(institute_id=inst.id)
            .order_by(models.UploadBatch.uploaded_at.desc()).limit(50).all())
    return [{"id": b.id, "filename": b.filename, "uploaded_at": b.uploaded_at,
             "total_rows": b.total_rows, "created": b.created_count,
             "duplicates": b.duplicate_count, "skipped": b.skipped_count} for b in rows]


@router.get("/summary")
def profile_summary(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Profile summary for the institute dashboard (requirement 1b)."""
    inst = _institute(current, db)
    students = db.query(models.JobSeeker).filter_by(institute_id=inst.id).all()
    student_ids = [s.id for s in students]
    apps = (db.query(models.Application)
            .filter(models.Application.jobseeker_id.in_(student_ids)).all()) if student_ids else []
    placed = sum(1 for a in apps if a.status in ("Hired", "Offered"))
    last_batch = (db.query(models.UploadBatch).filter_by(institute_id=inst.id)
                  .order_by(models.UploadBatch.uploaded_at.desc()).first())
    return {
        "institute": {"name": inst.name, "email": inst.email, "phone": inst.phone,
                      "city": inst.city, "state": inst.state, "website": inst.website,
                      "courses": inst.courses or [], "logo_url": inst.logo_url,
                      "approval_status": inst.approval_status,
                      "present_strength": inst.present_strength},
        "students_total": len(students),
        "students_with_resume": sum(1 for s in students if s.key_skills or s.education),
        "applications": len(apps),
        "placed": placed,
        "placement_rate": round(100 * placed / len(students), 1) if students else 0,
        "jobs_posted": db.query(models.Job).filter_by(institute_id=inst.id).count(),
        "last_upload": {"filename": last_batch.filename, "uploaded_at": last_batch.uploaded_at,
                        "created": last_batch.created_count} if last_batch else None,
    }


# ---------------- Student search ----------------
@router.get("/students", response_model=list[schemas.JobSeekerOut])
def student_search(email: str | None = None, phone: str | None = None,
                   current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Search this institute's students by email or phone (per user story)."""
    inst = _institute(current, db)
    query = db.query(models.JobSeeker).filter(models.JobSeeker.institute_id == inst.id)
    if email:
        query = query.filter(models.JobSeeker.email.ilike(f"%{email}%"))
    if phone:
        query = query.filter(models.JobSeeker.phone.ilike(f"%{phone}%"))
    return query.order_by(models.JobSeeker.created_at.desc()).all()


@router.get("/students/{jobseeker_id}", response_model=schemas.JobSeekerOut)
def view_student(jobseeker_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    inst = _institute(current, db)
    s = db.query(models.JobSeeker).filter_by(id=jobseeker_id, institute_id=inst.id).first()
    if not s:
        raise HTTPException(404, "Student not found in your institute.")
    return s


# ---------------- Post a job (institutes can post too) ----------------
@router.post("/jobs", response_model=schemas.JobOut)
def post_job(body: schemas.JobBase, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    inst = _institute(current, db)
    job = models.Job(institute_id=inst.id, posted_by_user_id=current.id, **body.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    notify_job_alert(db, job)
    return job
