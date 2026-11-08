"""Job-description import: document -> text -> structured job-post fields.

Two stages, so the feature works with or without an AI key:

  extract_text()  PDF (pypdf), Word .docx (python-docx), Excel / CSV (pandas),
                  plain text / markdown.
  rule_parse()    Reads labelled lines ("Location: Hyderabad"), section blocks
                  ("Responsibilities" followed by bullet lines), e-mail / phone
                  patterns and salary phrases ("₹15,000 - 20,000 per month",
                  "3.5 LPA", "$60k/year"). Used on its own when AI is off, and
                  to fill gaps the AI left when it is on.

Nothing is guessed that isn't in the document; a field the text doesn't
mention is simply returned empty for the recruiter to fill in.
"""
from __future__ import annotations

import io
import os
import re

MAX_BYTES = 8 * 1024 * 1024
TEXT_EXT = {".txt", ".md", ".text", ".rtf"}
TABLE_EXT = {".csv", ".xlsx", ".xls", ".xlsm"}


# ---------------------------------------------------------------- extraction
def extract_text(filename: str, data: bytes) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if len(data) > MAX_BYTES:
        raise ValueError("That file is larger than 8 MB.")
    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((p.extract_text() or "") for p in reader.pages[:30])
    if ext == ".docx":
        import docx
        d = docx.Document(io.BytesIO(data))
        parts = [p.text for p in d.paragraphs]
        for t in d.tables:                       # key/value tables are common in JDs
            for row in t.rows:
                cells = [c.text.strip() for c in row.cells]
                cells = [c for i, c in enumerate(cells) if c and c not in cells[:i]]
                if len(cells) >= 2:
                    parts.append(f"{cells[0]}: {' '.join(cells[1:])}")
                elif cells:
                    parts.append(cells[0])
        return "\n".join(parts)
    if ext == ".doc":
        raise ValueError("Old .doc files can't be read — save it as .docx or PDF and try again.")
    if ext in TABLE_EXT:
        return _table_to_text(ext, data)
    # default: treat as text
    for enc in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except Exception:
            continue
    return ""


def _table_to_text(ext: str, data: bytes) -> str:
    import pandas as pd
    if ext == ".csv":
        df = pd.read_csv(io.BytesIO(data), header=None, dtype=str, keep_default_na=False)
    else:
        df = pd.read_excel(io.BytesIO(data), header=None, dtype=str, keep_default_na=False)
    df = df.fillna("")
    rows = [[str(c).strip() for c in r] for r in df.values.tolist()]
    rows = [r for r in rows if any(r)]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    header = rows[0]
    labelled = sum(1 for h in header if _label_key(h))
    # A header row of known labels with data under it -> "Label: value" from row 2.
    if labelled >= 2 and len(rows) > 1:
        return "\n".join(f"{h}: {v}" for h, v in zip(header, rows[1]) if h and v)
    # A two-column key/value sheet.
    if width <= 3:
        return "\n".join(f"{r[0]}: {' '.join(x for x in r[1:] if x)}" if len(r) > 1 and r[1] else r[0] for r in rows)
    return "\n".join(" ".join(x for x in r if x) for r in rows)


# ---------------------------------------------------------------- parsing
LABELS = {
    "title": ["job title", "position title", "position", "job role", "role", "post", "title", "vacancy for", "hiring for", "opening"],
    "job_code": ["job code", "job id", "requisition id", "req id", "reference no", "ref no", "job ref"],
    "location": ["job location", "work location", "location", "place of work", "city", "posting location", "work place"],
    "no_of_positions": ["no. of positions", "no of positions", "number of positions", "positions", "openings", "no. of openings",
                        "vacancies", "no. of vacancies", "headcount"],
    "experience": ["experience required", "experience", "exp", "work experience"],
    "salary": ["salary", "ctc", "compensation", "pay", "wages", "stipend", "remuneration", "package"],
    "category": ["qualification", "education", "educational qualification", "eligibility", "degree"],
    "shift": ["shift", "timings", "working hours", "work timings", "shift timings", "duty hours"],
    "job_type": ["job type", "employment type", "type of employment", "nature of job"],
    "key_skills": ["key skills", "skills required", "required skills", "skill set", "skills", "must have"],
    "requirement_technical": ["technical requirement", "technical skills", "tools", "certifications"],
    "description": ["job description", "description", "about the role", "about the job", "role overview", "summary",
                    "responsibilities", "roles and responsibilities", "roles & responsibilities", "key responsibilities",
                    "duties", "what you will do", "job responsibilities"],
    "recruiter_name": ["contact person", "recruiter", "hr name", "contact name", "hiring manager", "contact"],
    "recruiter_email": ["email", "e-mail", "mail id", "email id"],
    "recruiter_phone": ["phone", "mobile", "contact number", "phone number", "mobile no", "whatsapp"],
}
_ALL = sorted(((k, lab) for k, labs in LABELS.items() for lab in labs), key=lambda x: -len(x[1]))


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9.&]+", " ", (s or "").lower()).strip()


def _label_key(text: str):
    t = _norm(text)
    for k, lab in _ALL:
        if t == lab or t.startswith(lab + " ") and len(t) <= len(lab) + 12:
            return k
    return None


_BULLET = re.compile(r"^\s*(?:[-*•▪●◦–]|\d+[.)])\s*")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
PHONE = re.compile(r"(?:\+?\d[\d\s-]{8,14}\d)")


def rule_parse(text: str) -> dict:
    lines = [ln.rstrip() for ln in (text or "").replace("\r", "").split("\n")]
    out: dict = {}
    sections: dict = {}
    cur = None
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^\s*([A-Za-z][A-Za-z .&/()'-]{1,40}?)\s*[:\-–|]\s*(.+)$", line)
        if m and _label_key(m.group(1)):
            key = _label_key(m.group(1))
            val = m.group(2).strip()
            if key in ("description", "key_skills", "requirement_technical") and key in out:
                out[key] += "\n" + val
            else:
                out.setdefault(key, val)
            cur = key if key in ("description", "key_skills", "requirement_technical") else None
            continue
        # a bare heading ("Responsibilities", "Key Skills:") starts a section
        head = line.rstrip(":").strip()
        if len(head) <= 45 and _label_key(head) and not _BULLET.match(line):
            cur = _label_key(head)
            sections.setdefault(cur, [])
            continue
        if cur:
            # A skills list continues only with bullets / short items — a plain
            # sentence ("Night shift. Food provided.") ends it.
            if cur in ("key_skills", "requirement_technical") and not _BULLET.match(line) \
                    and (re.search(r"[.!?](\s|$)", line) or len(line) > 60):
                cur = None
                continue
            sections.setdefault(cur, []).append(_BULLET.sub("", line))

    for k, vals in sections.items():
        body = "\n".join(v for v in vals if v)
        if not body:
            continue
        if k in ("description", "key_skills", "requirement_technical"):
            out[k] = (out.get(k, "") + "\n" + body).strip()
        else:
            out.setdefault(k, vals[0])

    # Title fallback: the first short line that isn't a label.
    if not out.get("title"):
        for ln in lines:
            s = ln.strip()
            if 2 < len(s) <= 60 and not _label_key(s) and ":" not in s and not EMAIL.search(s):
                out["title"] = s.title() if s.isupper() else s
                break

    if not out.get("recruiter_email"):
        e = EMAIL.search(text or "")
        if e: out["recruiter_email"] = e.group(0)
    else:
        e = EMAIL.search(out["recruiter_email"]); out["recruiter_email"] = e.group(0) if e else out["recruiter_email"]
    if not out.get("recruiter_phone"):
        p = PHONE.search(text or "")
        if p: out["recruiter_phone"] = re.sub(r"[^\d+]", "", p.group(0))

    # skills -> list
    if out.get("key_skills"):
        parts = re.split(r"[,\n;/|•]+", out["key_skills"])
        seen, skills = set(), []
        for s in parts:
            s = _BULLET.sub("", s).strip(" .")
            if 1 < len(s) <= 40 and s.lower() not in seen:
                seen.add(s.lower()); skills.append(s)
        out["key_skills"] = skills[:15]

    if out.get("no_of_positions"):
        n = re.search(r"\d+", str(out["no_of_positions"]))
        out["no_of_positions"] = int(n.group(0)) if n else None

    low = (text or "").lower()
    out["accommodation"] = bool(re.search(r"\b(accommodation|stay|lodging|hostel)\s*(provided|available|free)|free (accommodation|stay)", low))
    out["food_provided"] = bool(re.search(r"\b(food|meals?|lunch)\s*(provided|available|free)|free (food|meals?)", low))
    out["is_urgent"] = bool(re.search(r"\burgent(ly)?\b|immediate join", low))
    if not out.get("shift"):
        m = re.search(r"\b(day|night|general|rotational|morning|evening)\s+shift\b", low)
        if m: out["shift"] = f"{m.group(1).title()} shift"
    if not out.get("job_type"):
        for k, v in (("full time", "Full-time"), ("full-time", "Full-time"), ("part time", "Part-time"),
                     ("part-time", "Part-time"), ("contract", "Contract"), ("internship", "Internship")):
            if k in low:
                out["job_type"] = v; break
    out.update(parse_salary(out.get("salary") or _salary_phrase(text)))
    return out


def _salary_phrase(text: str) -> str:
    m = re.search(r"(?:₹|rs\.?|inr|\$|usd|aed|€|eur|£|gbp|sar)\s?[\d.,]+\s*(?:k|l|lakh|lakhs|lpa|cr|crore)?"
                  r"(?:\s*(?:-|to|–)\s*(?:₹|rs\.?|inr|\$|usd|aed|€|eur|£|gbp|sar)?\s?[\d.,]+\s*(?:k|l|lakh|lakhs|lpa|cr|crore)?)?"
                  r"(?:\s*(?:per|/|a)\s*(?:month|annum|year|day|hour|hr|yr|mo))?", (text or "").lower())
    return m.group(0) if m else ""


_CUR = [("₹", "INR"), ("rs", "INR"), ("inr", "INR"), ("lpa", "INR"), ("lakh", "INR"), ("crore", "INR"),
        ("$", "USD"), ("usd", "USD"), ("aed", "AED"), ("dirham", "AED"), ("€", "EUR"), ("eur", "EUR"),
        ("£", "GBP"), ("gbp", "GBP"), ("sar", "SAR"), ("riyal", "SAR"), ("sgd", "SGD")]


def parse_salary(s: str) -> dict:
    s = (s or "").strip()
    if not s:
        return {}
    low = s.lower()
    cur = next((code for sym, code in _CUR if sym in low), None)
    basis = ("annual" if re.search(r"lpa|per\s*annum|p\.?a\.?\b|/\s*(yr|year)|per\s*year|yearly|annual", low)
             else "daily" if re.search(r"per\s*day|/\s*day|daily", low)
             else "hourly" if re.search(r"per\s*(hour|hr)|/\s*(hour|hr)|hourly", low)
             else "monthly" if re.search(r"per\s*month|/\s*(month|mo)|monthly|p\.?m\.?\b", low) else None)
    nums = []
    for m in re.finditer(r"(\d[\d,]*(?:\.\d+)?)\s*(k|l|lakh|lakhs|lpa|cr|crore|m)?", low):
        v = float(m.group(1).replace(",", ""))
        u = m.group(2) or ""
        mult = {"k": 1e3, "l": 1e5, "lakh": 1e5, "lakhs": 1e5, "lpa": 1e5, "cr": 1e7, "crore": 1e7, "m": 1e6}.get(u, 1)
        nums.append(v * mult)
    nums = [n for n in nums if n >= 50]
    out = {"salary_raw": s}
    if nums:
        out["wage_min"] = str(int(min(nums[:2])))
        if len(nums) > 1:
            out["wage_max"] = str(int(max(nums[:2])))
    if cur: out["salary_currency"] = cur
    if basis: out["wage_basis"] = basis
    return out
