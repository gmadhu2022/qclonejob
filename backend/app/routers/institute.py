import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .. import models, schemas, plans
from ..database import get_db
from ..auth import require_role, get_current_user
from ..resume_service import (process_institute_upload, sample_template_dataframe,
                              build_template_workbook)
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
    data = body.model_dump(exclude={"email"})

    # Mandatory fields (profile requirements 28-31). The form checks these too,
    # but a PUT that arrives with a blank name would otherwise wipe the
    # institute's identity and leave the dashboard showing an empty heading.
    for field, label in (("name", "Name of the Institute"),
                         ("authorised_person_name", "Contact Person Name"),
                         ("phone", "Mobile No")):
        if not (data.get(field) or "").strip():
            raise HTTPException(400, f"{label} is required.")

    # current_strength is the field the institute edits; present_strength is the
    # legacy name the bulk-upload capacity check reads. Keep them in step rather
    # than letting an upload be measured against a number nobody has seen since
    # registration.
    if data.get("current_strength") is not None:
        data["present_strength"] = data["current_strength"]

    for k, v in data.items():
        setattr(inst, k, v)

    _sync_primary_location(inst, db)
    db.commit()
    db.refresh(inst)
    return inst


def _sync_primary_location(inst: models.Institute, db: Session) -> models.InstituteLocation:
    """Keep the primary location row mirroring the institute's own address.

    The institute edits ONE address, on the profile. Without this the primary
    campus in the locations list would quietly drift out of date the first time
    that address changed, and "Add new location" would be comparing against a
    stale head office.
    """
    primary = (db.query(models.InstituteLocation)
               .filter_by(institute_id=inst.id, is_primary=True).first())
    if not primary:
        primary = models.InstituteLocation(institute_id=inst.id, is_primary=True,
                                           name="Main campus")
        db.add(primary)
    primary.address1 = inst.address1
    primary.address2 = inst.address2
    primary.city = inst.city
    primary.district = inst.district
    primary.state = inst.state
    primary.country = inst.country or "INDIA"
    primary.pincode = inst.pincode
    primary.contact_person = inst.authorised_person_name
    primary.contact_email = inst.authorised_person_email or inst.email
    primary.contact_phone = inst.authorised_person_phone or inst.phone
    db.flush()
    return primary


def _refresh_course_names(inst: models.Institute, db: Session) -> None:
    """Rebuild Institute.courses (the flat name list) from the course rows.

    Institute.courses is what recruiters and students filter on, and it existed
    before courses carried seat numbers. Rebuilding it here means the two can
    never disagree about which courses an institute runs.
    """
    names = [r.name for r in db.query(models.InstituteCourse)
             .filter_by(institute_id=inst.id).order_by(models.InstituteCourse.name).all()]
    seen, unique = set(), []
    for n in names:
        key = (n or "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(n.strip())
    inst.courses = unique


# ---------------- Locations (profile requirements 39-43) ----------------
def _location_payload(loc: models.InstituteLocation, courses: list[models.InstituteCourse]) -> dict:
    rows = [c for c in courses if c.location_id == loc.id]
    return {
        "id": loc.id, "name": loc.name, "is_primary": bool(loc.is_primary),
        "address1": loc.address1, "address2": loc.address2, "city": loc.city,
        "district": loc.district, "state": loc.state, "country": loc.country,
        "pincode": loc.pincode,
        "contact_person": loc.contact_person, "contact_email": loc.contact_email,
        "contact_phone": loc.contact_phone,
        # current_strength stays None when it has never been set, so the form
        # can tell "no students yet" (0) apart from "not answered" (blank).
        "courses": [{"id": c.id, "name": c.name, "seats": c.seats or 0,
                     "current_strength": c.current_strength} for c in rows],
        "seats": sum(c.seats or 0 for c in rows),
        "strength": sum(c.current_strength or 0 for c in rows),
    }


@router.get("/locations")
def list_locations(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Every campus, primary first, each with its own course list."""
    inst = _institute(current, db)
    _sync_primary_location(inst, db)
    db.commit()
    locs = (db.query(models.InstituteLocation).filter_by(institute_id=inst.id)
            .order_by(models.InstituteLocation.is_primary.desc(),
                      models.InstituteLocation.id).all())
    courses = db.query(models.InstituteCourse).filter_by(institute_id=inst.id).all()
    return [_location_payload(l, courses) for l in locs]


@router.post("/locations")
def add_location(body: dict, current: models.User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """Add a campus.

    Requirement 42: a new location starts with the SAME course list as the
    first location — the institute almost always runs the same programmes, and
    retyping twenty course names is how seat numbers end up wrong.
    Requirement 43: every copied course must be given a student strength, so
    the copies arrive with strength 0 and the profile screen refuses to save
    the location until each one is filled in.
    """
    inst = _institute(current, db)
    pincode = (body.get("pincode") or "").strip()
    if not pincode:
        raise HTTPException(400, "Pincode is required for a new location.")
    if not (body.get("contact_person") or "").strip():
        raise HTTPException(400, "Contact Person is required for a new location.")
    if not (body.get("contact_phone") or "").strip():
        raise HTTPException(400, "Mobile No is required for a new location.")

    loc = models.InstituteLocation(
        institute_id=inst.id, is_primary=False,
        name=(body.get("name") or "").strip() or f"Campus {pincode}",
        address1=body.get("address1"), address2=body.get("address2"),
        city=body.get("city"), district=body.get("district"), state=body.get("state"),
        country=body.get("country") or "INDIA", pincode=pincode,
        contact_person=body.get("contact_person"),
        contact_email=body.get("contact_email"),
        contact_phone=body.get("contact_phone"),
    )
    db.add(loc)
    db.flush()

    # Copy the primary campus's courses across, seats included, strength blank.
    primary = (db.query(models.InstituteLocation)
               .filter_by(institute_id=inst.id, is_primary=True).first())
    if primary:
        for c in db.query(models.InstituteCourse).filter_by(
                institute_id=inst.id, location_id=primary.id).all():
            db.add(models.InstituteCourse(institute_id=inst.id, location_id=loc.id,
                                          name=c.name, seats=c.seats or 0,
                                          # None, not 0 — see requirement 43.
                                          current_strength=None))
    db.commit()
    courses = db.query(models.InstituteCourse).filter_by(institute_id=inst.id).all()
    return _location_payload(loc, courses)


@router.put("/locations/{location_id}")
def edit_location(location_id: int, body: dict,
                  current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    inst = _institute(current, db)
    loc = db.query(models.InstituteLocation).filter_by(id=location_id, institute_id=inst.id).first()
    if not loc:
        raise HTTPException(404, "Location not found.")
    for k in ("name", "address1", "address2", "city", "district", "state", "country",
              "pincode", "contact_person", "contact_email", "contact_phone"):
        if k in body:
            setattr(loc, k, body[k])

    # Editing the primary campus edits the institute's own address, because
    # they are the same address — two copies that can disagree is worse than
    # one that is written twice.
    if loc.is_primary:
        inst.address1, inst.address2 = loc.address1, loc.address2
        inst.city, inst.district, inst.state = loc.city, loc.district, loc.state
        inst.country, inst.pincode = loc.country, loc.pincode
        inst.authorised_person_name = loc.contact_person or inst.authorised_person_name
        inst.authorised_person_email = loc.contact_email or inst.authorised_person_email
        inst.authorised_person_phone = loc.contact_phone or inst.authorised_person_phone
    db.commit()
    courses = db.query(models.InstituteCourse).filter_by(institute_id=inst.id).all()
    return _location_payload(loc, courses)


@router.put("/locations/{location_id}/strengths")
def set_location_strengths(location_id: int, body: dict,
                           current: models.User = Depends(get_current_user),
                           db: Session = Depends(get_db)):
    """Set the student strength for every course at one campus, in one call.

    Requirement 43 makes this mandatory, and mandatory means all-or-nothing:
    saving each course with its own PUT meant a browser that lost connection
    half way left the campus in a state the rule says can't exist — some
    courses filled, some blank, and no way for the UI to tell which. One
    transaction, validated up front, or nothing is written.
    """
    inst = _institute(current, db)
    loc = db.query(models.InstituteLocation).filter_by(id=location_id, institute_id=inst.id).first()
    if not loc:
        raise HTTPException(404, "Location not found.")

    rows = db.query(models.InstituteCourse).filter_by(
        institute_id=inst.id, location_id=loc.id).all()
    if not rows:
        raise HTTPException(400, "This location has no courses yet.")

    incoming = body.get("strengths") or {}
    missing, over, updates = [], [], []
    for row in rows:
        raw = incoming.get(str(row.id), incoming.get(row.id))
        if raw is None or str(raw).strip() == "":
            raw = row.current_strength          # None when never answered
        if raw is None or str(raw).strip() == "":
            missing.append(row.name)
            continue
        try:
            value = int(raw)
        except (TypeError, ValueError):
            raise HTTPException(400, f'"{row.name}": student strength must be a number.')
        if value < 0:
            raise HTTPException(400, f'"{row.name}": student strength can\'t be negative.')
        if value > (row.seats or 0):
            over.append(f"{row.name} ({value} students, {row.seats} seats)")
        updates.append((row, value))

    if missing:
        raise HTTPException(400, "Student strength is required for every course. "
                                 "Still blank: " + ", ".join(missing))
    if over:
        raise HTTPException(400, "More students than seats: " + "; ".join(over)
                                 + ". Raise the seat count first.")

    for row, value in updates:
        row.current_strength = value
    db.commit()
    courses = db.query(models.InstituteCourse).filter_by(institute_id=inst.id).all()
    return _location_payload(loc, courses)


@router.delete("/locations/{location_id}", response_model=schemas.Message)
def delete_location(location_id: int, current: models.User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    inst = _institute(current, db)
    loc = db.query(models.InstituteLocation).filter_by(id=location_id, institute_id=inst.id).first()
    if not loc:
        raise HTTPException(404, "Location not found.")
    if loc.is_primary:
        raise HTTPException(400, "The main campus can't be removed — edit its address instead.")
    db.query(models.InstituteCourse).filter_by(location_id=loc.id).delete()
    db.delete(loc)
    db.commit()
    _refresh_course_names(inst, db)
    db.commit()
    return {"message": "Location removed."}


# ---------------- Courses and seats (profile requirements 37-38) ----------------
@router.get("/courses")
def list_courses(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    inst = _institute(current, db)
    rows = (db.query(models.InstituteCourse).filter_by(institute_id=inst.id)
            .order_by(models.InstituteCourse.location_id, models.InstituteCourse.name).all())
    return [{"id": c.id, "name": c.name, "seats": c.seats or 0,
             "current_strength": c.current_strength,
             "location_id": c.location_id} for c in rows]


@router.post("/courses")
def add_course(body: dict, current: models.User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """Add Course — Course Name, No of Seats (requirement 38)."""
    inst = _institute(current, db)
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Course Name is required.")
    try:
        seats = int(body.get("seats") or 0)
    except (TypeError, ValueError):
        raise HTTPException(400, "No of Seats must be a number.")
    if seats < 0:
        raise HTTPException(400, "No of Seats can't be negative.")

    location_id = body.get("location_id")
    if location_id:
        owned = db.query(models.InstituteLocation).filter_by(
            id=location_id, institute_id=inst.id).first()
        if not owned:
            raise HTTPException(404, "Location not found.")
    else:
        location_id = _sync_primary_location(inst, db).id

    dupe = (db.query(models.InstituteCourse)
            .filter_by(institute_id=inst.id, location_id=location_id)
            .filter(models.InstituteCourse.name.ilike(name)).first())
    if dupe:
        raise HTTPException(400, f'"{name}" is already listed at this location.')

    raw_strength = body.get("current_strength")
    if raw_strength is None or str(raw_strength).strip() == "":
        strength = None            # not answered yet — the profile chases it
    else:
        try:
            strength = int(raw_strength)
        except (TypeError, ValueError):
            raise HTTPException(400, "Current strength must be a number.")
    row = models.InstituteCourse(institute_id=inst.id, location_id=location_id,
                                 name=name, seats=seats, current_strength=strength)
    db.add(row)
    db.flush()
    _refresh_course_names(inst, db)
    db.commit()
    return {"id": row.id, "name": row.name, "seats": row.seats,
            "current_strength": row.current_strength, "location_id": row.location_id}


@router.put("/courses/{course_id}")
def edit_course(course_id: int, body: dict, current: models.User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    inst = _institute(current, db)
    row = db.query(models.InstituteCourse).filter_by(id=course_id, institute_id=inst.id).first()
    if not row:
        raise HTTPException(404, "Course not found.")
    if "name" in body:
        name = (body.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "Course Name is required.")
        row.name = name
    for field, label in (("seats", "No of Seats"), ("current_strength", "Current strength")):
        if field in body:
            try:
                value = int(body.get(field) or 0)
            except (TypeError, ValueError):
                raise HTTPException(400, f"{label} must be a number.")
            if value < 0:
                raise HTTPException(400, f"{label} can't be negative.")
            setattr(row, field, value)
    if (row.current_strength is not None) and row.current_strength > (row.seats or 0):
        raise HTTPException(400, f'"{row.name}" has {row.current_strength} students but only '
                                 f"{row.seats} seats. Raise the seat count first.")
    _refresh_course_names(inst, db)
    db.commit()
    return {"id": row.id, "name": row.name, "seats": row.seats,
            "current_strength": row.current_strength, "location_id": row.location_id}


@router.delete("/courses/{course_id}", response_model=schemas.Message)
def delete_course(course_id: int, current: models.User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    inst = _institute(current, db)
    row = db.query(models.InstituteCourse).filter_by(id=course_id, institute_id=inst.id).first()
    if not row:
        raise HTTPException(404, "Course not found.")
    db.delete(row)
    db.flush()
    _refresh_course_names(inst, db)
    db.commit()
    return {"message": f'"{row.name}" removed.'}


# ---------------- Data upload (THE emphasized flow) ----------------
def _log_download(db: Session, inst: models.Institute, user: models.User,
                  kind: str, filename: str, file_format: str) -> None:
    """Record a download so the Data upload screen can list them with a timestamp.

    Never raises: a failure to write the audit row must not stop the institute
    getting the file they asked for.
    """
    try:
        db.add(models.InstituteDownloadLog(
            institute_id=inst.id, user_id=user.id, kind=kind,
            filename=filename, file_format=file_format))
        db.commit()
    except Exception:
        db.rollback()


@router.get("/upload-template")
def download_upload_template(current: models.User = Depends(get_current_user),
                             db: Session = Depends(get_db)):
    """Download a blank .xlsx the institute can fill in and upload."""
    _log_download(db, _institute(current, db), current, "template",
                  "qclonejob_student_upload_template.xlsx", "xlsx")
    data = build_template_workbook()
    # Response (not StreamingResponse) so Content-Length is set — some Excel
    # versions reject a download whose length the browser couldn't verify.
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="qclonejob_student_upload_template.xlsx"',
            "Content-Length": str(len(data)),
            "Cache-Control": "no-store",
        },
    )


@router.get("/upload-template.csv")
def download_template_csv(current: models.User = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    """CSV fallback — opens anywhere, including Google Sheets and old Office."""
    _log_download(db, _institute(current, db), current, "template",
                  "qclonejob_student_upload_template.csv", "csv")
    df = sample_template_dataframe()
    csv = df.to_csv(index=False)
    return Response(
        content=csv.encode("utf-8-sig"),      # BOM so Excel reads UTF-8 correctly
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="qclonejob_student_upload_template.csv"'},
    )


@router.get("/students-export")
def export_students(current: models.User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """Download this institute's students as Excel (requirement 50).

    The template is a blank form; this is the data that has actually been
    uploaded, which is what an institute reaching for "download" usually
    wants — to check what the platform holds, or to correct and re-upload it.
    """
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    inst = _institute(current, db)
    students = (db.query(models.JobSeeker).filter_by(institute_id=inst.id)
                .order_by(models.JobSeeker.created_at.desc()).all())

    headers = ["First Name", "Last Name", "Email", "Phone", "Gender", "DOB",
               "Degree", "Branch", "Year of Passing", "Percentage",
               "City", "State", "Key Skills", "Registered on"]
    wb = Workbook()
    ws = wb.active
    ws.title = "Students"
    fill = PatternFill("solid", fgColor="10256B")
    font = Font(color="FFFFFF", bold=True, size=11)
    for col, name in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=name)
        cell.fill, cell.font = fill, font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(col)].width = max(14, min(len(name) + 6, 30))
    ws.freeze_panes = "A2"

    for r, s in enumerate(students, start=2):
        edu = _first_education(s)
        values = [
            s.first_name, s.last_name, s.email, s.phone, s.gender, s.dob,
            edu.get("degree"), edu.get("branch"), edu.get("year_of_passing"),
            edu.get("percentage"), s.city, s.state,
            ", ".join(s.key_skills or []),
            s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else "",
        ]
        for c, v in enumerate(values, start=1):
            ws.cell(row=r, column=c, value=v)

    buf = io.BytesIO()
    wb.save(buf)
    data = buf.getvalue()
    filename = f"qclonejob_students_{inst.id}.xlsx"
    _log_download(db, inst, current, "students", filename, "xlsx")
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"',
                 "Content-Length": str(len(data)), "Cache-Control": "no-store"},
    )


@router.get("/download-history")
def download_history(current: models.User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """Every file this institute has downloaded, with date and time (requirement 51)."""
    inst = _institute(current, db)
    rows = (db.query(models.InstituteDownloadLog).filter_by(institute_id=inst.id)
            .order_by(models.InstituteDownloadLog.downloaded_at.desc()).limit(100).all())
    return [{"id": r.id, "kind": r.kind, "filename": r.filename,
             "file_format": r.file_format, "downloaded_at": r.downloaded_at} for r in rows]


@router.post("/upload")
async def upload_students(file: UploadFile = File(...),
                          current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Upload an Excel of 1..N students. For each row we auto-create a resume,
    generate credentials, store in DB, and email the student their user id + password."""
    # Requirement 48 — the wording is fixed, because it is what the institute
    # is told to look for. The browser filters the picker too, but a file can
    # still arrive here renamed or dragged in, so the server checks as well.
    if not (file.filename or "").lower().endswith((".xlsx", ".xls", ".xlsm", ".csv")):
        raise HTTPException(400, "Wrong File Format — add only Excel/CSV files.")
    inst = _institute(current, db)
    contents = await file.read()
    try:
        results = process_institute_upload(contents, inst, db)
    except ValueError as e:
        # Capacity exceeded or malformed rows: the sheet parsed fine, so the
        # "could not read the spreadsheet" wrapper would send the user hunting
        # for a file-format problem that doesn't exist. Pass the message through.
        raise HTTPException(400, str(e))
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
        # Requirement 49 — the headline is the fixed phrase; the counts follow
        # it, because "successful" on its own doesn't tell an institute whether
        # all 300 of their students actually landed.
        "message": "Data upload is successful — " + ", ".join(parts) + ".",
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


def _first_education(seeker: models.JobSeeker) -> dict:
    """The education entry the dashboard groups by.

    Bulk-uploaded students get exactly one row, built from the sheet's Degree /
    Branch / Year of Passing columns. A student who has since edited their own
    profile may have several, so take the most recent year rather than
    whichever happens to be first in the list.
    """
    rows = [e for e in (seeker.education or []) if isinstance(e, dict)]
    if not rows:
        return {}
    def year(e):
        try:
            return int(str(e.get("year_of_passing") or "0")[:4])
        except (TypeError, ValueError):
            return 0
    return max(rows, key=year)


@router.get("/summary")
def profile_summary(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Everything the Dashboard shows (requirements 20-25).

    Course-wise seats and strength come from the course rows the institute
    maintains on the profile. The year / course / gender breakdowns are derived
    from the student data that was actually uploaded, so they stay truthful
    even when the profile numbers are out of date.
    """
    inst = _institute(current, db)
    students = db.query(models.JobSeeker).filter_by(institute_id=inst.id).all()
    student_ids = [s.id for s in students]
    apps = (db.query(models.Application)
            .filter(models.Application.jobseeker_id.in_(student_ids)).all()) if student_ids else []
    placed = sum(1 for a in apps if a.status in ("Hired", "Offered"))
    last_batch = (db.query(models.UploadBatch).filter_by(institute_id=inst.id)
                  .order_by(models.UploadBatch.uploaded_at.desc()).first())

    course_rows = (db.query(models.InstituteCourse).filter_by(institute_id=inst.id)
                   .order_by(models.InstituteCourse.name).all())
    locations = {l.id: l for l in db.query(models.InstituteLocation)
                 .filter_by(institute_id=inst.id).all()}

    # --- Course-wise capacity and strength (requirements 21-23) -------------
    by_course: dict[str, dict] = {}
    for c in course_rows:
        slot = by_course.setdefault(c.name, {"label": c.name, "seats": 0, "strength": 0,
                                             "locations": []})
        slot["seats"] += c.seats or 0
        slot["strength"] += c.current_strength or 0
        loc = locations.get(c.location_id)
        slot["locations"].append({
            "location": (loc.name if loc else "Main campus"),
            "pincode": (loc.pincode if loc else None),
            "seats": c.seats or 0, "strength": c.current_strength or 0,
        })
    courses_list = list(by_course.values())
    for c in courses_list:
        c["vacant"] = max(0, c["seats"] - c["strength"])
        c["fill_rate"] = round(100 * c["strength"] / c["seats"], 1) if c["seats"] else 0

    total_seats = sum(c["seats"] for c in courses_list)
    total_strength = sum(c["strength"] for c in courses_list)

    # Requirement 43 — a campus whose courses still have no strength entered is
    # silently dragging the totals down. The dashboard says so rather than
    # presenting a number the institute would have to work out is wrong.
    incomplete = []
    for c in course_rows:
        if c.current_strength is None:
            loc = locations.get(c.location_id)
            incomplete.append({"course": c.name,
                               "location": loc.name if loc else "Main campus",
                               "location_id": c.location_id})

    # --- Students uploaded, broken down (requirement 25) --------------------
    year_counts: dict[str, int] = {}
    course_counts: dict[str, int] = {}
    gender_counts: dict[str, int] = {}
    for s in students:
        edu = _first_education(s)
        y = str(edu.get("year_of_passing") or "").strip()[:4] or "Not given"
        year_counts[y] = year_counts.get(y, 0) + 1

        course = (edu.get("degree") or "").strip() or "Not given"
        branch = (edu.get("branch") or "").strip()
        label = f"{course} — {branch}" if branch and branch.lower() != course.lower() else course
        course_counts[label] = course_counts.get(label, 0) + 1

        g = (s.gender or "").strip().title() or "Not given"
        if g in ("M", "Male"):
            g = "Male"
        elif g in ("F", "Female"):
            g = "Female"
        gender_counts[g] = gender_counts.get(g, 0) + 1

    def as_series(counts: dict, sort_by_label=False) -> list[dict]:
        items = sorted(counts.items(),
                       key=(lambda kv: kv[0]) if sort_by_label else (lambda kv: -kv[1]))
        return [{"label": k, "value": v} for k, v in items]

    return {
        "institute": {"name": inst.name, "email": inst.email, "phone": inst.phone,
                      "city": inst.city, "state": inst.state, "website": inst.website,
                      "courses": inst.courses or [], "logo_url": inst.logo_url,
                      "approval_status": inst.approval_status,
                      "pincode": inst.pincode,
                      "total_capacity": inst.total_capacity,
                      "current_strength": inst.current_strength,
                      "present_strength": inst.present_strength},
        # Headline numbers
        "courses_count": len(courses_list),
        "locations_count": max(1, len(locations)),
        "seats_total": total_seats or (inst.total_capacity or 0),
        "strength_total": total_strength or (inst.current_strength or 0),
        "students_total": len(students),
        "students_with_resume": sum(1 for s in students if s.key_skills or s.education),
        "applications": len(apps),
        "placed": placed,
        "placement_rate": round(100 * placed / len(students), 1) if students else 0,
        "jobs_posted": db.query(models.Job).filter_by(institute_id=inst.id).count(),
        # Breakdowns
        "courses": courses_list,
        "courses_incomplete": incomplete,
        "by_year": as_series(year_counts, sort_by_label=True),
        "by_course": as_series(course_counts),
        "by_gender": as_series(gender_counts),
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
    data = body.model_dump()
    # Same 20-day cap as the recruiter portal — enforced in both places, since
    # either can create a posting.
    expires_at = plans.job_expiry(data.pop("expires_at", None))
    job = models.Job(institute_id=inst.id, posted_by_user_id=current.id,
                     expires_at=expires_at, **data)
    db.add(job)
    db.commit()
    db.refresh(job)
    notify_job_alert(db, job)
    return job


# ---------------- Post a Ad (requirements 52-56) ----------------
#
# Two formats, and only two, chosen by a pair of buttons on the form:
#
#   flyer     a JPG, cover-cropped by the server to the mobile app's ad slot.
#             The institute uploads whatever their designer sent; the platform
#             does the resizing, because an ad that arrives at the wrong aspect
#             ratio either letterboxes or crops someone's face off.
#   scroller  a single short line that scrolls across that same slot. Length is
#             capped so the message completes a pass before the user moves on.
#
# Both are stored as Banner rows so they flow through the existing slot,
# impression and click machinery unchanged.

def _ad_payload(b: models.Banner) -> dict:
    return {
        "id": b.id, "ad_format": b.ad_format or "flyer", "title": b.title,
        "text_content": b.text_content, "image_url": b.image_url or b.media_url,
        "cta_label": b.cta_label, "cta_link": b.cta_link,
        "audience": b.audience, "status": b.status, "theme": b.theme,
        "start_date": b.start_date, "end_date": b.end_date,
        "impressions": b.impressions or 0, "clicks": b.clicks or 0,
        "created_at": b.created_at,
    }


def _scroller_limit() -> int:
    from ..config import settings
    return int(getattr(settings, "AD_SCROLLER_MAX_CHARS", 120))


@router.get("/ads")
def list_ads(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _institute(current, db)
    rows = (db.query(models.Banner).filter_by(posted_by_user_id=current.id)
            .order_by(models.Banner.created_at.desc()).all())
    return {"ads": [_ad_payload(b) for b in rows], "scroller_max_chars": _scroller_limit()}


@router.post("/ads")
def create_ad(body: dict, current: models.User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    inst = _institute(current, db)
    ad_format = (body.get("ad_format") or "flyer").lower()
    if ad_format not in ("flyer", "scroller"):
        raise HTTPException(400, "Choose either Flyer or Scroller.")

    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "Give the ad a title so you can find it later.")

    image_url = (body.get("image_url") or "").strip()
    text = (body.get("text_content") or "").strip()

    if ad_format == "flyer":
        if not image_url:
            raise HTTPException(400, "Upload the flyer image (JPG) before posting.")
        text = text[:200]          # optional caption, not the ad itself
    else:
        limit = _scroller_limit()
        if not text:
            raise HTTPException(400, "Type the scroller text.")
        if len(text) > limit:
            raise HTTPException(400, f"Scroller text must be {limit} characters or fewer — "
                                     f"yours is {len(text)}.")
        image_url = ""

    ad = models.Banner(
        posted_by_user_id=current.id,
        ad_format=ad_format,
        title=title,
        company_name=inst.name,
        logo_url=inst.logo_url,
        image_url=image_url or None,
        media_url=image_url or None,
        media_type="image" if ad_format == "flyer" else "none",
        text_content=text or None,
        cta_label=(body.get("cta_label") or "").strip() or None,
        cta_link=(body.get("cta_link") or "").strip() or None,
        audience=body.get("audience") or "jobseekers",
        theme=body.get("theme") or "navy",
        start_date=body.get("start_date"),
        end_date=body.get("end_date"),
        status="active",
    )
    db.add(ad)
    db.commit()
    db.refresh(ad)
    return {"message": f'Your {ad_format} ad "{ad.title}" is live.', "ad": _ad_payload(ad)}


@router.put("/ads/{ad_id}")
def update_ad(ad_id: int, body: dict, current: models.User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    _institute(current, db)
    ad = db.query(models.Banner).filter_by(id=ad_id, posted_by_user_id=current.id).first()
    if not ad:
        raise HTTPException(404, "Ad not found.")

    if "text_content" in body and (ad.ad_format or "flyer") == "scroller":
        text = (body.get("text_content") or "").strip()
        limit = _scroller_limit()
        if not text:
            raise HTTPException(400, "Type the scroller text.")
        if len(text) > limit:
            raise HTTPException(400, f"Scroller text must be {limit} characters or fewer — "
                                     f"yours is {len(text)}.")
        ad.text_content = text
    elif "text_content" in body:
        ad.text_content = (body.get("text_content") or "").strip()[:200] or None

    if "image_url" in body and (ad.ad_format or "flyer") == "flyer":
        url = (body.get("image_url") or "").strip()
        if not url:
            raise HTTPException(400, "A flyer needs an image.")
        ad.image_url = ad.media_url = url

    for field in ("title", "cta_label", "cta_link", "audience", "theme",
                  "start_date", "end_date"):
        if field in body:
            setattr(ad, field, (body.get(field) or None))

    if "status" in body:
        status = body.get("status")
        if status not in ("active", "paused"):
            raise HTTPException(400, "Status must be active or paused.")
        ad.status = status

    db.commit()
    db.refresh(ad)
    return {"message": "Ad updated.", "ad": _ad_payload(ad)}


@router.delete("/ads/{ad_id}", response_model=schemas.Message)
def delete_ad(ad_id: int, current: models.User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    _institute(current, db)
    ad = db.query(models.Banner).filter_by(id=ad_id, posted_by_user_id=current.id).first()
    if not ad:
        raise HTTPException(404, "Ad not found.")
    db.query(models.BannerEvent).filter_by(banner_id=ad.id).delete()
    db.delete(ad)
    db.commit()
    return {"message": "Ad removed."}
