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


def _clean_phone(value) -> str:
    """Normalise a mobile number read out of a spreadsheet.

    pandas types a column of digits as float64, so 9876543210 arrives as
    9876543210.0 and "0412345" loses its leading zero. Any validation that
    compares the raw string therefore rejects perfectly good numbers — which
    is exactly what happened: a sheet of valid students imported nothing.

    Trailing ".0" is dropped only when the value really is a whole number;
    a genuine decimal is left alone so it still fails validation loudly
    rather than being silently truncated into a different number.
    """
    if value is None:
        return ""
    text = str(value).strip()
    if not text or text.lower() in ("nan", "none"):
        return ""
    if re.fullmatch(r"\d+\.0+", text):
        text = text.split(".")[0]
    return text


def _norm_key(v) -> str:
    """Normalise a value for duplicate comparison (case/space/punctuation-insensitive)."""
    if v is None:
        return ""
    t = str(v).strip().lower()
    return "".join(ch for ch in t if ch.isalnum())


def inspect_institute_upload(file_bytes: bytes, institute: models.Institute,
                             db: Session) -> dict:
    """Read the sheet and report what WOULD happen. Writes nothing.

    Exists so the institute can decide about duplicates before any account is
    created. Importing first and reporting afterwards gives them no choice at
    all — the accounts already exist by the time they read the summary.

    Raises ValueError for a sheet that isn't a student upload, so the caller
    gets the same clear header message it would get on a real import.
    """
    return process_institute_upload(file_bytes, institute, db, dry_run=True)


def process_institute_upload(file_bytes: bytes, institute: models.Institute, db: Session,
                             dry_run: bool = False,
                             skip_duplicates: bool = True) -> list[dict]:
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
    # The sheet must actually BE a student sheet.
    #
    # Any workbook used to be accepted: an invoice, a timetable, last year's
    # budget. Every row then failed its own validation and the institute was
    # told "480 rows skipped" with no clue that they had picked the wrong
    # file. Checking the HEADERS first turns that into one clear sentence.
    # ------------------------------------------------------------------
    # A name can arrive as one column ("Name") or two ("First name"/"Last
    # name"); either satisfies the requirement. The alias table calls the
    # single-column form `name`, not `full_name` — getting that wrong rejected
    # sheets that were perfectly valid, which the test caught.
    has_name = any(k in mapping for k in ("name", "first_name", "last_name"))
    missing = []
    if not has_name:                 missing.append("Name")
    if "email" not in mapping:       missing.append("Email")
    if "phone" not in mapping:       missing.append("Mobile No")
    if missing:
        found = ", ".join(str(c) for c in list(df.columns)[:8]) or "none"
        raise ValueError(
            "This sheet doesn't look like a student upload — the required "
            f"column(s) {', '.join(missing)} were not found.\n\n"
            f"Columns in your file: {found}\n\n"
            "Download the template below and paste your data into it, keeping "
            "the header row exactly as it is."
        )

    # ------------------------------------------------------------------
    # NO CAPACITY LIMIT.
    #
    # Uploads used to be rejected outright when the sheet held more rows than
    # the institute's recorded strength, and rejected again when strength was
    # blank. Both refused the whole file over a number the institute types in
    # by hand on its own profile — so a stale figure blocked real students.
    # Strength is now a reported statistic, not a gate.
    #
    # NOTHING IS ALL-OR-NOTHING ANY MORE EITHER.
    # The old scan collected every malformed row and then imported ZERO. One
    # blank email in a sheet of 400 meant nobody was registered. Each row is
    # now judged on its own: good rows import, bad rows are skipped with a
    # reason, and the caller is told exactly which.
    # ------------------------------------------------------------------

    results = []

    def duplicate(name, why, email=None):
        """Record a duplicate — or refuse the whole sheet.

        All three duplicate paths (already in this sheet, email already
        registered, mobile already registered) go through here, so the
        institute's choice applies to every one of them. The first version
        checked the policy in only one branch, and a row caught by either of
        the other two slipped past it — which the test caught.
        """
        if not skip_duplicates and not dry_run:
            raise ValueError(
                f"'{email or name}' is already registered, and you chose to correct "
                f"the sheet rather than skip duplicates. Nothing was imported.")
        results.append({"row": name, "status": why, "outcome": "duplicate",
                        "email": email, "user_id": email, "password": None})

    def skip(name, why, email=None):
        results.append({"row": name, "status": f"skipped — {why}", "outcome": "skipped",
                        "email": email, "user_id": None, "password": None})


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

        phone_val = _clean_phone(_get(row, mapping, "phone"))
        name_val = (f"{first or ''} {last or ''}").strip() or (full_name or "").strip()

        # --- the three mandatory fields -------------------------------------
        # Name, mobile and email. A student record without all three cannot be
        # contacted or logged into, so it is worthless — but it is skipped,
        # never fatal, so the other 399 rows still import.
        missing = []
        if not name_val:  missing.append("name")
        if not phone_val: missing.append("mobile number")
        if not email:     missing.append("email")
        if missing:
            skip(display_name, "missing " + ", ".join(missing), email)
            continue

        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", str(email).strip()):
            skip(display_name, f"'{email}' is not a valid email address", email)
            continue
        if not re.fullmatch(r"[\d+\-\s()]{6,20}", phone_val):
            skip(display_name, f"'{phone_val}' is not a valid mobile number", email)
            continue

        # --- already in this sheet, or already uploaded by this institute ----
        fingerprint = (_norm_key(f"{first or ''}{last or ''}"),
                       _norm_key(phone_val), _norm_key(email))
        if fingerprint in seen_keys:
            duplicate(display_name,
                      "duplicate — same name, mobile and email already uploaded", email)
            continue
        seen_keys.add(fingerprint)

        # --- already somewhere in the platform -------------------------------
        # Matched on EITHER email or mobile: the same person re-entered with a
        # typo'd name is still the same person, and a second account on one
        # mobile number splits their applications across two logins.
        #
        # Scoped to JOB SEEKERS. users.email is unique per (email, role) now,
        # so a student may share an address with a recruiter or an institute
        # contact — often the same person. Only another job seeker on that
        # address is a real duplicate.
        clash = (db.query(models.User)
                 .filter(models.User.email == email,
                         models.User.role == models.ROLE_JOBSEEKER).first())
        if clash:
            note = ("" if clash.role == models.ROLE_JOBSEEKER
                    else f" to a {clash.role} account")
            duplicate(display_name, f"duplicate — email already registered{note}", email)
            continue
        phone_clash = (db.query(models.JobSeeker)
                       .filter(models.JobSeeker.phone == phone_val).first())
        if phone_clash:
            duplicate(display_name, "duplicate — mobile already registered", email)
            continue

        # A dry run stops here: everything above is validation, everything
        # below writes. Counting a row as "would be created" without creating
        # it is what lets the institute decide about duplicates first.
        if dry_run:
            results.append({"row": display_name, "status": "will be created",
                            "outcome": "created", "email": email,
                            "user_id": email, "password": None})
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
