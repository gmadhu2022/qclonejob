"""Institute data-upload feature.

An institute uploads an Excel sheet describing 1..N students. For each row we:
  1. map whatever columns are present onto our resume fields (flexible header matching),
  2. create a User (email = user id) with a system-generated random password,
  3. create a JobSeeker resume populated with the available info, attached to the institute,
  4. email the login credentials to the student.

Columns not present are simply left blank on the resume — the student fills them in later.
"""
import io
import re
import pandas as pd
from sqlalchemy.orm import Session

from . import models
from .auth import hash_password, generate_password
from .email_utils import send_credentials_email


# Maps many possible spreadsheet header spellings -> our internal field name.
# Add more synonyms freely; matching is case/space/underscore-insensitive.
COLUMN_ALIASES = {
    "first_name": ["first name", "firstname", "fname", "given name"],
    "last_name": ["last name", "lastname", "lname", "surname"],
    "name": ["name", "full name", "student name", "candidate name"],
    "email": ["email", "email id", "e-mail", "mail id", "mail"],
    "phone": ["phone", "phone no", "mobile", "mobile no", "contact", "contact no", "ph no"],
    "dob": ["dob", "date of birth", "birth date"],
    "gender": ["gender", "sex"],
    "location": ["location", "place", "current location"],
    "city": ["city"],
    "state": ["state"],
    "degree": ["degree", "qualification", "course"],
    "branch": ["branch", "specialization", "stream", "major"],
    "institute": ["institute", "college", "university", "college/institute"],
    "year_of_passing": ["year of passing", "yop", "passing year", "year"],
    "percentage": ["percentage", "percent", "%", "cgpa", "marks", "overall %"],
    "key_skills": ["key skills", "skills", "skill set", "keyskills"],
    "career_objective": ["objective", "career objective", "summary"],
    "experience": ["experience", "work experience", "exp"],
    "certifications": ["certifications", "certificates", "certification"],
    "languages": ["languages", "language"],
    # richer candidate detail (requested: experience, years, city, address)
    "address": ["address", "residential address", "permanent address", "full address"],
    "district": ["district"],
    "pincode": ["pincode", "pin code", "postal code", "zip"],
    "total_experience": ["total experience", "years of experience", "experience years",
                         "exp years", "yoe"],
    "previous_company": ["previous company", "last company", "company", "employer",
                         "organisation", "organization"],
    "previous_role": ["previous role", "designation", "last designation", "job title", "role"],
    "previous_duration": ["duration", "work duration", "period", "from to"],
    "current_salary": ["current salary", "present salary", "ctc", "current ctc"],
    "expected_salary": ["expected salary", "expected ctc", "salary expectation"],
    "availability": ["availability", "notice period", "available from"],
    "gender_col": ["gender", "sex"],
    "headline": ["headline", "profile summary", "about", "summary"],
}


def _norm(s: str) -> str:
    return str(s).strip().lower().replace("_", " ").replace("-", " ").replace(".", "")


def _build_reverse_map(df_columns):
    """Return {internal_field: actual_df_column} for the columns present in the sheet."""
    normalized = {_norm(c): c for c in df_columns}
    mapping = {}
    for field, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if _norm(alias) in normalized:
                mapping[field] = normalized[_norm(alias)]
                break
    return mapping


def _split_list(value) -> list:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    text = str(value).strip()
    if not text:
        return []
    for sep in [",", ";", "|", "/"]:
        if sep in text:
            return [p.strip() for p in text.split(sep) if p.strip()]
    return [text]


def _get(row, mapping, field):
    col = mapping.get(field)
    if col is None:
        return None
    val = row.get(col)
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip()


def _norm_key(v) -> str:
    """Normalise a value for duplicate comparison (case/space/punctuation-insensitive)."""
    if v is None:
        return ""
    t = str(v).strip().lower()
    return "".join(ch for ch in t if ch.isalnum())


def process_institute_upload(file_bytes: bytes, institute: models.Institute, db: Session) -> list[dict]:
    """Parse the sheet and create seekers.

    Duplicate rule (requirement 1c): a row is treated as a duplicate when its
    Name, Mobile No AND Email all match a row already seen — either earlier in
    this same file, or an existing student of this institute. Matching on all
    three avoids false positives from shared family phone numbers or common names.
    """
    # CSV is accepted alongside Excel — some institutes export from Tally or
    # Google Sheets and CSV is the safer round-trip.
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception:
        df = pd.read_csv(io.BytesIO(file_bytes), encoding_errors="replace")
    df.columns = [str(c) for c in df.columns]
    mapping = _build_reverse_map(df.columns)

    # ------------------------------------------------------------------
    # Capacity check (requirement 7). An institute may hold at most
    # `present_strength` students in total, counting the ones it already has.
    # Checked BEFORE any row is processed so a rejected upload creates nothing
    # rather than half a batch.
    # ------------------------------------------------------------------
    capacity = institute.present_strength or 0
    if not capacity:
        # Without this the restriction is bypassed by simply leaving Present
        # strength blank, which is the default for every institute created
        # before the field existed. Refusing here is the only way the cap
        # actually holds.
        raise ValueError(
            f"{institute.name} has no student capacity set, so there is nothing to check "
            "an upload against.\n"
            "Set 'Present strength' on your institute profile first — it is the maximum "
            "number of students you can register."
        )
    if capacity:
        already = db.query(models.JobSeeker).filter_by(institute_id=institute.id).count()
        room = capacity - already
        if len(df) > room:
            raise ValueError(
                f"This sheet has {len(df)} rows but {institute.name} has room for "
                f"{max(0, room)} more student(s) — capacity is {capacity} and "
                f"{already} are already registered. "
                "Remove the extra rows, or raise Present strength on your profile first."
            )

    # ------------------------------------------------------------------
    # Malformed-data scan. Report the SHEET row number the user can actually
    # see (header is row 1, so the first data row is row 2), not the zero-based
    # dataframe index — "check record 4" has to mean row 4 in their file.
    # ------------------------------------------------------------------
    problems = []
    for idx, row in df.iterrows():
        n = int(idx) + 2
        email_v = _get(row, mapping, "email")
        name_v = (_get(row, mapping, "name") or _get(row, mapping, "first_name") or "").strip()
        who = f"row {n}" + (f" ({name_v})" if name_v else "")

        # Each problem states the FIELD, the bad value, and what a correct one
        # looks like. "not a valid email address" tells someone their data is
        # wrong; it doesn't tell them what to type instead.
        if not name_v and not email_v:
            problems.append(f"{who} | Name and Email | (both blank) | "
                            "Every student needs at least a name and an email address")
            continue
        if not name_v:
            problems.append(f"{who} | Name | (blank) | Enter the student's full name")
        if not email_v:
            problems.append(f"{who} | Email | (blank) | "
                            "Required — login details are emailed here. e.g. student@gmail.com")
        elif not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", str(email_v).strip()):
            problems.append(f"{who} | Email | '{email_v}' | "
                            "Must contain @ and a domain, e.g. student@gmail.com")
        phone_v = str(_get(row, mapping, "phone") or "").strip()
        if phone_v and not re.fullmatch(r"[\d+\-\s()]{6,20}", phone_v):
            problems.append(f"{who} | Mobile No | '{phone_v}' | "
                            "Digits only, 10 for an Indian number, e.g. 9876543210")
    if problems:
        shown = problems[:10]
        more = f"\n…and {len(problems) - 10} more problem(s)." if len(problems) > 10 else ""
        raise ValueError(
            f"{len(problems)} problem(s) found in this sheet. Nothing was imported.\n"
            + "\n".join(shown) + more
        )

    results = []

    # Fingerprints of this institute's existing students, to catch re-uploads.
    seen_keys = set()
    for existing in db.query(models.JobSeeker).filter_by(institute_id=institute.id).all():
        seen_keys.add((
            _norm_key(f"{existing.first_name or ''}{existing.last_name or ''}"),
            _norm_key(existing.phone),
            _norm_key(existing.email),
        ))

    for _, row in df.iterrows():
        email = _get(row, mapping, "email")

        # Derive a display name from either name or first/last columns
        full_name = _get(row, mapping, "name")
        first = _get(row, mapping, "first_name")
        last = _get(row, mapping, "last_name")
        if not first and full_name:
            parts = full_name.split(" ", 1)
            first = parts[0]
            last = parts[1] if len(parts) > 1 else ""
        display_name = (f"{first or ''} {last or ''}").strip() or full_name or (email or "Student")

        if not email:
            results.append({"row": display_name, "status": "skipped (no email)",
                            "outcome": "skipped",
                            "email": None, "user_id": None, "password": None})
            continue

        # --- duplicate check: Name + Mobile + Email all matching ---
        phone_val = _get(row, mapping, "phone")
        fingerprint = (_norm_key(f"{first or ''}{last or ''}"),
                       _norm_key(phone_val), _norm_key(email))
        if fingerprint in seen_keys:
            results.append({"row": display_name,
                            "status": "duplicate — same name, mobile and email already uploaded",
                            "outcome": "duplicate",
                            "email": email, "user_id": email, "password": None})
            continue
        seen_keys.add(fingerprint)

        if db.query(models.User).filter(models.User.email == email).first():
            results.append({"row": display_name, "status": "skipped (email already exists)",
                            "outcome": "duplicate",
                            "email": email, "user_id": email, "password": None})
            continue

        # --- create user with generated credentials ---
        password = generate_password()
        user = models.User(
            email=email,
            password_hash=hash_password(password),
            role=models.ROLE_JOBSEEKER,
            must_change_password=True,
        )
        db.add(user)
        db.flush()  # get user.id

        # --- build a single education row from the flat columns present ---
        education = []
        degree = _get(row, mapping, "degree")
        if degree or _get(row, mapping, "institute"):
            education.append({
                "level": "Bachelor",
                "degree": degree,
                "branch": _get(row, mapping, "branch"),
                "institute": _get(row, mapping, "institute") or institute.name,
                "location": _get(row, mapping, "location"),
                "year_of_passing": _get(row, mapping, "year_of_passing"),
                "percentage": _get(row, mapping, "percentage"),
            })

        # Previous experience, when the sheet provides it
        experience = []
        if _get(row, mapping, "previous_company") or _get(row, mapping, "previous_role"):
            experience.append({
                "company": _get(row, mapping, "previous_company"),
                "role": _get(row, mapping, "previous_role"),
                "years": _get(row, mapping, "previous_duration") or _get(row, mapping, "total_experience"),
                "description": "",
            })

        address_parts = [_get(row, mapping, "address"), _get(row, mapping, "city"),
                         _get(row, mapping, "district"), _get(row, mapping, "state"),
                         _get(row, mapping, "pincode")]
        full_address = ", ".join(p for p in address_parts if p)

        seeker = models.JobSeeker(
            user_id=user.id,
            institute_id=institute.id,
            experience=experience,
            headline=_get(row, mapping, "headline"),
            total_experience=_get(row, mapping, "total_experience"),
            expected_salary=_get(row, mapping, "expected_salary"),
            availability=_get(row, mapping, "availability"),
            additional_info=(f"Address: {full_address}" if full_address else None),
            profile_type=("worker" if not _get(row, mapping, "degree") else "professional"),
            first_name=first,
            last_name=last,
            email=email,
            phone=_get(row, mapping, "phone"),
            dob=_get(row, mapping, "dob"),
            gender=_get(row, mapping, "gender"),
            location=_get(row, mapping, "location"),
            city=_get(row, mapping, "city"),
            state=_get(row, mapping, "state"),
            career_objective=_get(row, mapping, "career_objective"),
            key_skills=_split_list(row.get(mapping.get("key_skills"))) if "key_skills" in mapping else [],
            education=education,
            certifications=_split_list(row.get(mapping.get("certifications"))) if "certifications" in mapping else [],
            languages=_split_list(row.get(mapping.get("languages"))) if "languages" in mapping else [],
            resume_template="classic",
        )
        db.add(seeker)
        db.flush()

        # --- email credentials ---
        try:
            send_credentials_email(email, display_name, email, password)
            email_status = "created + email sent"
        except Exception as e:  # don't fail the whole batch on one email error
            email_status = f"created (email failed: {e})"

        results.append({"row": display_name, "status": email_status, "outcome": "created",
                        "email": email, "user_id": email, "password": password})

    db.commit()
    return results


def build_template_workbook() -> bytes:
    """Build the upload template with openpyxl directly.

    pandas' default writer produces a minimal workbook that Excel 2010 opens but
    newer versions can flag. Writing it explicitly — with a styled header row,
    sized columns, a frozen pane and an Instructions sheet — produces a file every
    Excel version accepts.
    """
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    df = sample_template_dataframe()
    headers = list(df.columns)

    wb = Workbook()
    ws = wb.active
    ws.title = "Students"

    head_fill = PatternFill("solid", fgColor="10256B")
    head_font = Font(color="FFFFFF", bold=True, size=11)
    thin = Side(style="thin", color="D5DBE8")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    for col, name in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=name)
        cell.fill = head_fill
        cell.font = head_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border
        ws.column_dimensions[get_column_letter(col)].width = max(14, min(len(name) + 6, 34))

    # one filled-in example row so the expected format is obvious
    for col, name in enumerate(headers, start=1):
        c = ws.cell(row=2, column=col, value=df.iloc[0][name])
        c.border = border
        c.alignment = Alignment(vertical="center")

    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"

    info = wb.create_sheet("Instructions")
    lines = [
        ("QCloneJob — student upload template", True),
        ("", False),
        ("1. Row 2 is a filled-in example. Replace it with your first student.", False),
        ("2. Email is the ONLY required column — it becomes the student's User ID.", False),
        ("3. Every other column is optional. Leave blanks where you don't have data.", False),
        ("4. Don't rename or reorder the headers in row 1.", False),
        ("5. Rows where Name, Mobile AND Email all repeat are treated as duplicates", False),
        ("   and skipped automatically.", False),
        ("6. Save as .xlsx and upload it on the Data upload page.", False),
        ("", False),
        ("Each student is emailed their User ID and a generated password.", False),
    ]
    for i, (text, bold) in enumerate(lines, start=1):
        c = info.cell(row=i, column=1, value=text)
        if bold:
            c.font = Font(bold=True, size=13, color="10256B")
    info.column_dimensions["A"].width = 90

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def sample_template_dataframe() -> pd.DataFrame:
    """The blank template institutes can download and fill in.

    Every column is optional except Email — whatever is present gets mapped onto
    the resume, and anything missing the student can add later.
    """
    return pd.DataFrame([{
        "First Name": "Ramesh",
        "Last Name": "Kumar",
        "Email": "ramesh.kumar@example.com",
        "Phone": "9000000001",
        "DOB": "2001-05-14",
        "Gender": "Male",
        "Location": "Hyderabad",
        "City": "Hyderabad",
        "State": "Telangana",
        "Degree": "B.Tech",
        "Branch": "Mechanical",
        "Institute": "Coco Soft Institute",
        "Year of Passing": "2024",
        "Percentage": "72",
        "Key Skills": "AutoCAD, SolidWorks, Automobile Design",
        "Career Objective": "Seeking a trainee mechanical engineer role.",
        "Certifications": "CAD Certified",
        "Languages": "English, Telugu, Hindi",
        "Address": "12-3-45, Ashok Nagar",
        "District": "Hyderabad",
        "Pincode": "500001",
        "Total Experience": "2 years",
        "Previous Company": "ABC Engineering Works",
        "Previous Role": "Junior Draughtsman",
        "Duration": "2022 - 2024",
        "Current Salary": "18000",
        "Expected Salary": "25000",
        "Availability": "Immediate",
        "Headline": "Mechanical draughtsman with CAD experience",
    }])
