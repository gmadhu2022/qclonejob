"""Stella — JobBay's AI assistant (POST /api/stella/chat).

Works for everyone:
  * visitors (no login)       — explains JobBay, finds live jobs, guides sign-up
  * job seekers / recruiters / institutes / admins — also grounded in their own data

Design notes
------------
* Login is OPTIONAL: the Authorization header is read if present, ignored if not.
* Replies are JSON {reply, suggestions[], links[]}. Links are filtered through a
  per-role allow-list, so Stella can only ever point at real pages of this app.
* When AI is off or the provider fails, Stella still answers from a built-in
  rule-based guide ("basic" mode) instead of erroring — the widget never breaks.
* A small per-user/IP rate limit protects the AI quota. It is in-memory, so it
  is per-instance; move it to Redis when running more than one instance.
"""
from __future__ import annotations

import json
import logging
import re
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt, JWTError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, plans
from .. import ai_service as ai
from ..config import settings
from ..database import get_db
from ..job_taxonomy import taxonomy_payload

router = APIRouter(prefix="/api/stella", tags=["stella"])
log = logging.getLogger("jobbay.stella")

# ------------------------------------------------------------------ rate limit
_WINDOW, _LIMIT_ANON, _LIMIT_USER = 600, 25, 60          # per 10 minutes
_hits: dict[str, deque] = defaultdict(deque)


def _rate_limit(key: str, limit: int) -> None:
    now = time.time()
    q = _hits[key]
    while q and now - q[0] > _WINDOW:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "You're chatting really fast! Please wait a few minutes and try again.")
    q.append(now)
    if len(_hits) > 20000:                               # keep memory bounded
        for k in list(_hits)[:5000]:
            if not _hits[k] or now - _hits[k][-1] > _WINDOW:
                _hits.pop(k, None)


# ------------------------------------------------------------------ optional auth
def _optional_user(request: Request, db: Session) -> models.User | None:
    h = request.headers.get("authorization") or ""
    if not h.lower().startswith("bearer "):
        return None
    try:
        payload = jwt.decode(h[7:], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user = db.query(models.User).filter(models.User.id == int(payload.get("sub"))).first()
        return user if user and user.is_active else None
    except (JWTError, TypeError, ValueError):
        return None


# ------------------------------------------------------------------ links Stella may use
PUBLIC_LINKS = {
    "/": "Home",
    "/register/jobseeker": "Create a job seeker account",
    "/register/enterprise": "Register as a recruiter",
    "/register/institute": "Register your institute",
    "/login?as=jobseeker": "Job seeker login",
    "/login?as=enterprise": "Recruiter login",
    "/login?as=institute": "Institute login",
    "/forgot-password": "Reset your password",
    "/services/job-search": "Job search service",
    "/services/recruitment": "Recruitment services",
    "/services/promotions": "Promotions & ads",
    "/about": "About JobBay",
    "/contact": "Contact us",
}
ROLE_LINKS = {
    models.ROLE_JOBSEEKER: {
        "/jobseeker/jobs": "Browse & apply to jobs", "/jobseeker/profile": "Edit my profile / resume",
        "/jobseeker/applied": "My applications", "/jobseeker/templates": "Resume templates",
        "/jobseeker/views": "Who viewed my profile", "/jobseeker/messages": "Messages",
    },
    models.ROLE_ENTERPRISE: {
        "/enterprise/post-job": "Post a job", "/enterprise/manage-jobs": "Manage jobs",
        "/enterprise/applications": "Applications", "/enterprise/resumes": "Find candidates",
        "/enterprise/ads": "Post an ad", "/enterprise/billing": "Plans & billing",
        "/enterprise/profile": "Company profile", "/enterprise/messages": "Messages",
    },
    models.ROLE_INSTITUTE: {
        "/institute/upload": "Upload student data", "/institute/post-job": "Post a job",
        "/institute/post-ad": "Post an ad", "/institute/profile": "Institute profile",
        "/institute/messages": "Messages",
    },
    models.ROLE_ADMIN: {"/admin": "Admin dashboard"},
}


def _allowed_links(role: str | None) -> dict:
    links = dict(ROLE_LINKS.get(role or "", {}))
    if not role:
        links.update(PUBLIC_LINKS)
    else:
        links.update({k: v for k, v in PUBLIC_LINKS.items()
                      if k in ("/about", "/contact", "/services/job-search", "/services/recruitment", "/services/promotions")})
    return links


# ------------------------------------------------------------------ context
_STOP = set("a an the and or for to in on of with me my i you is are am be can how what where which who show find "
            "job jobs any some please want need looking work near get give hi hello hey stella".split())


def _keywords(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-zA-Z][a-zA-Z+#.]{1,}", text.lower()) if w not in _STOP][:6]


def _find_jobs(db: Session, text: str, limit: int = 6) -> list[dict]:
    q = plans.live_jobs(db.query(models.Job))
    words = _keywords(text)
    if words:
        conds = []
        for w in words:
            like = f"%{w}%"
            conds += [models.Job.title.ilike(like), models.Job.category.ilike(like), models.Job.location.ilike(like)]
        q = q.filter(or_(*conds))
    rows = q.order_by(models.Job.created_at.desc()).limit(limit).all()
    return [{"title": j.title, "location": j.location, "category": j.category,
             "experience": j.experience, "salary": j.salary, "skills": (j.key_skills or [])[:6]} for j in rows]


def _platform(db: Session) -> dict:
    try:
        tax = taxonomy_payload()
        sectors = [s.get("name") for s in tax.get("sectors", [])][:60]
        roles = tax.get("role_count")
    except Exception:
        sectors, roles = [], None
    return {
        "live_jobs": plans.live_jobs(db.query(models.Job)).count(),
        "registered_job_seekers": db.query(models.JobSeeker).count(),
        "recruiters": db.query(models.Enterprise).count(),
        "institutes": db.query(models.Institute).count(),
        "sectors": sectors, "role_count": roles,
    }


def _user_context(user: models.User | None, db: Session) -> dict:
    if not user:
        return {"role": "visitor"}
    ctx: dict = {"role": user.role}
    if user.role == models.ROLE_JOBSEEKER:
        s = db.query(models.JobSeeker).filter_by(user_id=user.id).first()
        if s:
            ctx |= {"name": (s.first_name or "").strip(), "location": s.location,
                    "skills": (s.key_skills or [])[:15], "objective": (s.career_objective or "")[:300],
                    "applications": [{"job": a.job.title if a.job else "", "status": a.status}
                                     for a in (s.applications or [])[:10]]}
    elif user.role == models.ROLE_ENTERPRISE:
        e = db.query(models.Enterprise).filter_by(user_id=user.id).first()
        if e:
            jobs = db.query(models.Job).filter_by(enterprise_id=e.id).all()
            ctx |= {"company": e.name, "jobs": [{"title": j.title, "status": j.status} for j in jobs[:20]],
                    "applications_received": (db.query(models.Application).join(models.Job)
                                              .filter(models.Job.enterprise_id == e.id).count())}
    elif user.role == models.ROLE_INSTITUTE:
        i = db.query(models.Institute).filter_by(user_id=user.id).first()
        if i:
            ctx |= {"institute": i.name,
                    "students_uploaded": db.query(models.JobSeeker).filter_by(institute_id=i.id).count()}
    return ctx


SYSTEM = """You are Stella, the friendly AI assistant of JobBay — an advanced job searching platform \
that connects job seekers (from daily-wage workers to postgraduates), recruiters and institutes across the world.

Personality: warm, cheerful, encouraging and professional, like a helpful career advisor. \
Speak in simple, clear English (or the user's language if they write in another). Use the user's first name if known. \
Keep replies short: at most ~110 words, using short paragraphs or "- " bullet lists. You may use **bold** for key words. \
At most one emoji per reply.

Rules:
- Only mention jobs that appear in the provided "matching_jobs" list. Never invent jobs, companies, salaries or numbers.
- If no matching jobs are listed, say so kindly and suggest searching on the Jobs page after registering or logging in.
- JobBay does NOT offer job alerts, email/SMS notifications or a mobile app — never mention or suggest them.
- Always tell the user WHERE in JobBay to do or find something, and include the matching page in "links".
- Only include links that are relevant to the question (at most 2). Do not add links for general chit-chat.
- For account-specific actions, guide the user to the right page using the allowed links.
- Never ask for passwords, OTPs or payment details. Never give legal/medical advice.
- If the question is unrelated to jobs, careers, hiring, education or JobBay, answer briefly and steer back.

What JobBay offers (use this to answer questions about the portal):
- Job seekers: free sign-up; build a profile/resume (resume templates, AI help with objective, skills,
  resume review, cover letters, interview prep, mock interviews, salary insight, skill roadmap);
  browse and search jobs by role, sector, location, experience and salary; one-click apply;
  track application status; see who viewed their profile; chat with recruiters.
- Recruiters: register a company; post jobs (or auto-fill a job post from a JD document: PDF, Word,
  Excel, CSV or text); worldwide locations and any currency for salary; manage jobs; review
  applications; search candidate resumes with filters; AI candidate summaries and ranking;
  post ads (image, GIF, video or scrolling text); plans & billing for more posts/searches.
- Institutes: register the institute; upload student data from Excel/CSV (a template is provided)
  so each student gets a profile and login emailed to them; post jobs; post ads; track uploads.
- Accounts: each portal (Job seeker, Recruiter, Institute) has its own login; "Forgot password"
  sends a code to the registered email; users should change the initial password after first login.
- Coverage: 1,400+ roles across 50+ industries, from daily-wage work to postgraduate roles, worldwide.
If you are unsure about a detail, say so and point to the Contact us page instead of guessing.

Return ONLY a JSON object:
{"reply": "<message>", "suggestions": ["<short follow-up the user might tap>", "... (max 3, under 40 chars each)"], \
"links": [{"to": "<one of the allowed link paths>", "label": "<button text>"}] (max 2)}"""


def _clean(out: dict, allowed: dict) -> dict:
    reply = str(out.get("reply") or "").strip()[:1500]
    sugg = [str(s).strip()[:60] for s in (out.get("suggestions") or []) if str(s).strip()][:3]
    links = []
    for l in out.get("links") or []:
        to = (l or {}).get("to") if isinstance(l, dict) else None
        if to in allowed and all(x["to"] != to for x in links):
            links.append({"to": to, "label": str(l.get("label") or allowed[to])[:40]})
    return {"reply": reply or "Sorry, I didn't catch that — could you rephrase?", "suggestions": sugg, "links": links[:2]}


# ------------------------------------------------------------------ basic (no-AI) mode
def _basic(message: str, role: str | None, jobs: list[dict], platform: dict, allowed: dict) -> dict:
    m = message.lower()
    def L(*paths):
        return [{"to": p, "label": allowed[p]} for p in paths if p in allowed][:2]

    if re.search(r"\b(hi|hello|hey|namaste|good (morning|evening|afternoon))\b", m) and len(m) < 30:
        return {"reply": "Hi! I'm **Stella**, your JobBay assistant. I can help you find jobs, create an account, post jobs or upload student data. What would you like to do?",
                "suggestions": ["Find jobs for me", "How do I register?", "I want to hire"], "links": []}
    if "password" in m or "forgot" in m or "otp" in m:
        return {"reply": "No worries! Use **Forgot password** on the login page — we'll send a code to your registered email so you can set a new password.",
                "suggestions": ["How do I log in?"], "links": L("/forgot-password")}
    if any(w in m for w in ("register", "sign up", "signup", "create account", "join")):
        return {"reply": "Joining JobBay is free:\n- **Job seekers** create a profile and apply in one click\n- **Recruiters** post jobs and search candidates\n- **Institutes** upload students so they get placed",
                "suggestions": ["Find jobs for me", "I want to hire"],
                "links": L("/register/jobseeker", "/register/enterprise") or L("/jobseeker/profile")}
    if any(w in m for w in ("login", "log in", "sign in")):
        return {"reply": "Pick your portal on the login page — Job seeker, Recruiter or Institute — and sign in with your email and password.",
                "suggestions": ["Forgot my password"], "links": L("/login?as=jobseeker", "/login?as=enterprise")}
    if any(w in m for w in ("hire", "post a job", "post job", "recruit", "candidate", "hiring")):
        return {"reply": "To hire on JobBay, **post a job** in a few minutes (you can even auto-fill it from a JD document) and **search candidates** by skills, location and experience.",
                "suggestions": ["What plans are available?"],
                "links": L("/enterprise/post-job", "/enterprise/resumes") or L("/register/enterprise", "/login?as=enterprise")}
    if any(w in m for w in ("upload", "student", "institute", "placement")):
        return {"reply": "Institutes can **upload student data** from Excel/CSV. JobBay creates a profile for each student and emails them their login, so recruiters can find them.",
                "suggestions": ["Download the upload template"],
                "links": L("/institute/upload") or L("/register/institute", "/login?as=institute")}
    if any(w in m for w in ("plan", "price", "pricing", "subscription", "cost", "fee")):
        return {"reply": "Job seekers use JobBay **free**. Recruiters can choose a plan for more job posts and candidate searches — see Plans & billing after you log in.",
                "suggestions": ["I want to hire"], "links": L("/enterprise/billing", "/services/recruitment")}
    if any(w in m for w in ("contact", "support", "help desk", "complaint")):
        return {"reply": "You can reach the JobBay team from the **Contact us** page — we usually reply within one working day.",
                "suggestions": [], "links": L("/contact")}
    if jobs:
        lines = "\n".join(f"- **{j['title']}** — {j.get('location') or 'Location flexible'}" for j in jobs[:5])
        return {"reply": f"Here are some live jobs that match:\n{lines}\n\nLog in to see details and apply.",
                "suggestions": ["Show more jobs", "How do I apply?"],
                "links": L("/jobseeker/jobs") or L("/register/jobseeker", "/login?as=jobseeker")}
    return {"reply": f"JobBay has **{platform.get('live_jobs', 0):,} live jobs** across {len(platform.get('sectors') or []) or 'many'} industries. "
                     "Tell me the role and city you're interested in, and I'll look for matches!",
            "suggestions": ["Jobs for freshers", "Driver jobs", "Software jobs"],
            "links": L("/jobseeker/jobs") or L("/register/jobseeker")}


# ------------------------------------------------------------------ endpoint
@router.get("/status")
def stella_status():
    return {"name": "Stella", "ai": ai.ai_enabled()}


@router.post("/chat")
def stella_chat(body: dict, request: Request, db: Session = Depends(get_db)):
    message = str(body.get("message") or "").strip()[:1200]
    if not message:
        raise HTTPException(400, "Type a message for Stella.")
    user = _optional_user(request, db)
    client = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    _rate_limit(f"u{user.id}" if user else f"ip{client}", _LIMIT_USER if user else _LIMIT_ANON)

    role = user.role if user else None
    allowed = _allowed_links(role)
    jobs = _find_jobs(db, message)
    platform = _platform(db)
    me = _user_context(user, db)

    if ai.ai_enabled():
        context = {"user": me, "platform": platform, "matching_jobs": jobs,
                   "current_page": str(body.get("page") or "")[:80],
                   "allowed_links": allowed}
        msgs = [{"role": "system", "content": SYSTEM + "\n\nContext:\n" + json.dumps(context, default=str)[:7000]}]
        for turn in (body.get("history") or [])[-8:]:
            r = "assistant" if (turn or {}).get("role") == "assistant" else "user"
            msgs.append({"role": r, "content": str((turn or {}).get("content", ""))[:1200]})
        msgs.append({"role": "user", "content": message})
        try:
            out = ai._chat_json(msgs, temperature=0.6, max_tokens=600)
            return _clean(out, allowed) | {"mode": "ai"}
        except ai.AIUnavailable as e:
            log.warning("Stella falling back to basic mode: %s", e)
        except Exception as e:                                  # never break the widget
            log.exception("Stella AI error: %s", e)

    return _clean(_basic(message, role, jobs, platform, allowed), allowed) | {"mode": "basic"}
