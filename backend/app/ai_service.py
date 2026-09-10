"""Groq-powered AI helpers.

Groq exposes an OpenAI-compatible chat-completions API, so this is a thin wrapper
around a single HTTP call plus a JSON-mode helper.

Configuration (backend/.env):
    AI_ENABLED=True
    GROQ_API_KEY=
    GROQ_MODEL=llama-3.3-70b-versatile

Model names change over time — if you get a "model not found" error, check
https://console.groq.com/docs/models and set GROQ_MODEL accordingly.

Every helper degrades gracefully: if AI is off or the call fails, callers get a
clear error rather than a crash, and the app keeps working without AI.
"""
import json
import logging
import httpx

from .config import settings

logger = logging.getLogger("hire.ai")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"


def list_models() -> list[str]:
    """Ask Groq which models THIS key can actually use.

    Model IDs change over time, so never hardcode a list — read it live.
    """
    if not settings.GROQ_API_KEY:
        raise AIUnavailable("Set GROQ_API_KEY in backend/.env first.")
    try:
        with httpx.Client(timeout=20) as client:
            r = client.get(GROQ_MODELS_URL,
                           headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"})
    except httpx.RequestError as e:
        raise AIUnavailable(f"Could not reach Groq: {e}") from e
    if r.status_code == 401:
        raise AIUnavailable("Groq rejected the API key. Check GROQ_API_KEY in backend/.env.")
    if r.status_code >= 400:
        raise AIUnavailable(f"Groq returned {r.status_code} listing models.")
    return sorted(m["id"] for m in r.json().get("data", []))


class AIUnavailable(Exception):
    """Raised when AI is disabled or misconfigured."""


def ai_enabled() -> bool:
    return bool(settings.AI_ENABLED and settings.GROQ_API_KEY)


def _chat(messages: list[dict], *, json_mode: bool = False,
          temperature: float = 0.4, max_tokens: int = 900) -> str:
    if not ai_enabled():
        raise AIUnavailable(
            "AI features are turned off. Set AI_ENABLED=True and GROQ_API_KEY in backend/.env."
        )

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        with httpx.Client(timeout=45) as client:
            r = client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.RequestError as e:
        logger.error("Groq request failed: %s", e)
        raise AIUnavailable(f"Could not reach the AI service: {e}") from e

    if r.status_code == 401:
        raise AIUnavailable("Groq rejected the API key. Check GROQ_API_KEY in backend/.env.")
    if r.status_code == 404:
        raise AIUnavailable(
            f"Model '{settings.GROQ_MODEL}' is not available on your Groq key. "
            "Call GET /api/ai/models to see the models your key supports, then set "
            "GROQ_MODEL in backend/.env to one of them and restart."
        )
    if r.status_code == 429:
        raise AIUnavailable("AI rate limit reached. Please try again in a moment.")
    if r.status_code >= 400:
        logger.error("Groq error %s: %s", r.status_code, r.text[:400])
        raise AIUnavailable(f"AI service error ({r.status_code}).")

    try:
        return r.json()["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, ValueError) as e:
        raise AIUnavailable("Unexpected response from the AI service.") from e


def _chat_json(messages: list[dict], **kw) -> dict:
    """Chat call that must return a JSON object."""
    raw = _chat(messages, json_mode=True, **kw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Some models wrap JSON in prose or fences — salvage the object.
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except json.JSONDecodeError:
                pass
        raise AIUnavailable("The AI returned a response that couldn't be read.")


SYSTEM_CAREER = (
    "You are a careers assistant for Hire, an Indian job platform serving everyone from "
    "daily-wage workers to postgraduate professionals. Write in clear, simple English. "
    "Never invent qualifications, employers, or experience the user did not provide. "
    "Be concise and practical."
)


# ---------------------------------------------------------------- job seeker
def improve_objective(profile: dict) -> dict:
    """Rewrite / draft a career objective from the seeker's own details."""
    msg = [
        {"role": "system", "content": SYSTEM_CAREER + " Return JSON only."},
        {"role": "user", "content":
            "Write a career objective for this candidate, 2 sentences maximum, first person, "
            "no clichés like 'dynamic professional'. Base it ONLY on the details given.\n\n"
            f"Details: {json.dumps(profile, default=str)}\n\n"
            'Return JSON: {"objective": "...", "tips": ["short improvement tip", ...]}'},
    ]
    return _chat_json(msg, temperature=0.5, max_tokens=400)


def suggest_skills(profile: dict) -> dict:
    """Suggest additional relevant skills based on education / existing skills."""
    msg = [
        {"role": "system", "content": SYSTEM_CAREER + " Return JSON only."},
        {"role": "user", "content":
            "Suggest up to 10 additional skills this candidate could realistically list, "
            "based on their education and current skills. Do not repeat skills they already have. "
            "Prefer concrete, searchable skills (tools, software, techniques, certifications).\n\n"
            f"Candidate: {json.dumps(profile, default=str)}\n\n"
            'Return JSON: {"skills": ["...", ...]}'},
    ]
    return _chat_json(msg, temperature=0.4, max_tokens=350)


def parse_resume_text(text: str) -> dict:
    """Turn pasted resume text into structured profile fields."""
    msg = [
        {"role": "system", "content":
            "You extract structured data from resumes. Return JSON only. "
            "Use null or empty arrays for anything not present. Never invent data."},
        {"role": "user", "content":
            f"Extract fields from this resume text:\n\n{text[:6000]}\n\n"
            'Return JSON: {"first_name": "", "last_name": "", "email": "", "phone": "", '
            '"location": "", "career_objective": "", "key_skills": [], '
            '"education": [{"degree": "", "branch": "", "institute": "", "year_of_passing": "", "percentage": ""}], '
            '"experience": [{"company": "", "role": "", "years": "", "description": ""}], '
            '"certifications": [], "languages": []}'},
    ]
    return _chat_json(msg, temperature=0.1, max_tokens=1600)


def explain_match(profile: dict, job: dict, score: int, matched: list) -> dict:
    """Explain why a job fits (or doesn't) and what to do about the gaps."""
    msg = [
        {"role": "system", "content": SYSTEM_CAREER + " Return JSON only."},
        {"role": "user", "content":
            f"Candidate: {json.dumps(profile, default=str)}\n\n"
            f"Job: {json.dumps(job, default=str)}\n\n"
            f"System match score: {score}%. Overlapping skills: {matched}.\n\n"
            "Explain the fit in one short paragraph, then list concrete gaps and how to close them.\n"
            'Return JSON: {"summary": "...", "strengths": ["..."], "gaps": ["..."], '
            '"application_tip": "one sentence"}'},
    ]
    return _chat_json(msg, temperature=0.4, max_tokens=650)


def interview_prep(profile: dict, job: dict) -> dict:
    """Likely interview questions for this candidate and this job."""
    msg = [
        {"role": "system", "content": SYSTEM_CAREER + " Return JSON only."},
        {"role": "user", "content":
            f"Candidate: {json.dumps(profile, default=str)}\n\nJob: {json.dumps(job, default=str)}\n\n"
            "Give 6 likely interview questions with a one-line hint on how to answer each, "
            "plus 3 questions the candidate should ask the interviewer.\n"
            'Return JSON: {"questions": [{"q": "...", "hint": "..."}], "ask_them": ["..."]}'},
    ]
    return _chat_json(msg, temperature=0.5, max_tokens=900)


def cover_letter(profile: dict, job: dict) -> dict:
    msg = [
        {"role": "system", "content": SYSTEM_CAREER + " Return JSON only."},
        {"role": "user", "content":
            f"Candidate: {json.dumps(profile, default=str)}\n\nJob: {json.dumps(job, default=str)}\n\n"
            "Write a short cover letter (max 180 words), first person, specific to this job, "
            "using only the candidate's real details.\n"
            'Return JSON: {"letter": "..."}'},
    ]
    return _chat_json(msg, temperature=0.6, max_tokens=600)


# ---------------------------------------------------------------- recruiter
def generate_job_description(brief: dict) -> dict:
    """Draft a full job posting from a short brief."""
    msg = [
        {"role": "system", "content":
            "You write job postings for an Indian job platform. Clear, inclusive, "
            "no discriminatory requirements (no age, gender, marital status). Return JSON only."},
        {"role": "user", "content":
            f"Draft a job posting from this brief: {json.dumps(brief, default=str)}\n\n"
            'Return JSON: {"description": "2-4 short paragraphs", '
            '"requirement_education": "...", "requirement_technical": "...", '
            '"key_skills": ["..."], "responsibilities": ["..."]}'},
    ]
    return _chat_json(msg, temperature=0.5, max_tokens=1100)


def candidate_summary(profile: dict, job: dict | None = None) -> dict:
    """Recruiter-facing summary of a candidate, optionally against a specific job."""
    msg = [
        {"role": "system", "content":
            "You brief recruiters on candidates. Be factual and neutral — never speculate about "
            "age, gender, religion, caste or any protected attribute. Return JSON only."},
        {"role": "user", "content":
            f"Candidate: {json.dumps(profile, default=str)}\n"
            + (f"Role being hired for: {json.dumps(job, default=str)}\n" if job else "")
            + "Summarise for a recruiter in 3 sentences, then list strengths, gaps and 3 screening questions.\n"
            'Return JSON: {"summary": "...", "strengths": ["..."], "gaps": ["..."], '
            '"screening_questions": ["..."]}'},
    ]
    return _chat_json(msg, temperature=0.3, max_tokens=800)


# ---------------------------------------------------------------- shared
def parse_search(query: str) -> dict:
    """Natural-language search -> structured filters."""
    msg = [
        {"role": "system", "content":
            "You convert natural-language job searches into filters for an Indian job site. "
            "Return JSON only. Use null for anything not mentioned."},
        {"role": "user", "content":
            f'Search: "{query}"\n\n'
            'Return JSON: {"q": null, "location": null, "category": null, '
            '"experience": null, "skills": []}'},
    ]
    return _chat_json(msg, temperature=0.1, max_tokens=300)


def suggest_options(field: str, context: str = "") -> dict:
    """Free-form suggestions used by the smart dropdowns (e.g. courses, designations)."""
    msg = [
        {"role": "system", "content": SYSTEM_CAREER + " Return JSON only."},
        {"role": "user", "content":
            f'Suggest up to 12 realistic options for the field "{field}" '
            f'in the Indian job market. Context: {context or "none"}.\n'
            'Return JSON: {"options": ["..."]}'},
    ]
    return _chat_json(msg, temperature=0.3, max_tokens=400)


def parse_job_description(text: str) -> dict:
    """Turn a pasted/uploaded job description into structured posting fields (item 12)."""
    msg = [
        {"role": "system", "content":
            "You extract structured job-posting fields from a raw job description for an "
            "Indian job platform. Return JSON only. Use null/empty for anything not stated. "
            "Never invent salary or company details that are not in the text. "
            "Do not carry over discriminatory requirements (age, gender, marital status)."},
        {"role": "user", "content":
            f"Job description:\n\n{text[:7000]}\n\n"
            'Return JSON: {"title": "", "job_code": "", "category": "", "location": "", '
            '"no_of_positions": null, "experience": "", "salary": "", '
            '"requirement_education": "", "requirement_technical": "", '
            '"key_skills": [], "description": "", "responsibilities": [], '
            '"recruiter_name": "", "recruiter_email": "", "recruiter_phone": ""}'},
    ]
    return _chat_json(msg, temperature=0.1, max_tokens=1800)


def resume_review(profile: dict) -> dict:
    """Actionable critique of a resume, scored like a recruiter would."""
    msg = [
        {"role": "system", "content": SYSTEM_CAREER + " Return JSON only."},
        {"role": "user", "content":
            f"Review this candidate profile as an experienced recruiter would.\n\n"
            f"{json.dumps(profile, default=str)}\n\n"
            'Return JSON: {"score": 0-100, "verdict": "one sentence", '
            '"fix_now": ["highest-impact fixes"], "good": ["what already works"], '
            '"rewrite_suggestions": [{"field": "", "suggestion": ""}]}'},
    ]
    return _chat_json(msg, temperature=0.35, max_tokens=1100)


def career_advice(profile: dict) -> dict:
    """Suggest realistic next roles and the skills needed to reach them."""
    msg = [
        {"role": "system", "content": SYSTEM_CAREER + " Return JSON only."},
        {"role": "user", "content":
            f"Candidate: {json.dumps(profile, default=str)}\n\n"
            "Suggest 4 realistic job titles they could target now, and 3 they could reach "
            "within two years with upskilling. For each future role list the skills to learn.\n"
            'Return JSON: {"now": ["..."], "next": [{"role": "", "skills": ["..."]}], '
            '"advice": "one short paragraph"}'},
    ]
    return _chat_json(msg, temperature=0.5, max_tokens=900)


def classify_role(title: str, sectors: list[dict]) -> dict:
    """Pick the right sector, education level and wage basis for a job title.

    Lets a recruiter type "cook" or "borewell operator" and have the form configure
    itself correctly, instead of hunting through 300 roles.
    """
    catalogue = [{"key": s["key"], "name": s["name"], "examples": s["roles"][:8]} for s in sectors]
    msg = [
        {"role": "system", "content":
            "You classify job titles for an Indian job platform covering every kind of work, "
            "from daily-wage and domestic roles to postgraduate professions. Return JSON only."},
        {"role": "user", "content":
            f'Job title: "{title}"\n\nSectors: {json.dumps(catalogue)}\n\n'
            "Pick the best sector key. Choose a realistic education level from "
            "[none, 8th, 10th, 12th, iti, diploma, graduate, pg] and wage basis from "
            "[daily, weekly, monthly, annual, contract, piece_rate]. "
            "For worker, domestic and farm work prefer 'none' education and daily/monthly wages.\n"
            'Return JSON: {"sector": "", "education_level": "", "wage_basis": "", '
            '"job_type": "", "suggested_skills": [], "similar_titles": []}'},
    ]
    return _chat_json(msg, temperature=0.2, max_tokens=500)


def banner_copy(brief: dict) -> dict:
    """Write short, punchy banner copy for a promotion."""
    msg = [
        {"role": "system", "content":
            "You write short promotional banner copy for an Indian job platform. "
            "Plain, inclusive language readable by someone with basic English. Return JSON only."},
        {"role": "user", "content":
            f"Brief: {json.dumps(brief, default=str)}\n\n"
            "Write banner copy. Title max 8 words, body max 25 words, CTA max 3 words.\n"
            'Return JSON: {"title": "", "text_content": "", "cta_label": "", '
            '"alternatives": [{"title": "", "text_content": ""}]}'},
    ]
    return _chat_json(msg, temperature=0.7, max_tokens=600)


# ============================================================================
#  Conversational copilot
# ============================================================================
COPILOT_SEEKER = (
    "You are the Hire Career Copilot, helping a job seeker in India. You can see their "
    "profile and the jobs available to them. Be warm, specific and practical. Give short "
    "answers (under 120 words) unless asked for detail. Never invent jobs, employers or "
    "qualifications not present in the context. If they ask something you can't know, say so "
    "and suggest what would help. Speak plainly — many users have basic English."
)
COPILOT_RECRUITER = (
    "You are the Hire Recruiting Copilot, helping a recruiter in India. You can see their "
    "open jobs and applicant pipeline. Be concise and decision-oriented. Never speculate about "
    "a candidate's age, gender, religion, caste, marital status or any protected attribute, and "
    "never suggest screening on them. Base every claim on the supplied data."
)


def copilot(role: str, context: dict, history: list[dict], question: str) -> dict:
    """Multi-turn assistant grounded in the user's own data."""
    system = COPILOT_SEEKER if role == "jobseeker" else COPILOT_RECRUITER
    msgs = [{"role": "system", "content":
             f"{system}\n\nContext you may use:\n{json.dumps(context, default=str)[:6000]}"}]
    for turn in (history or [])[-8:]:          # keep the last 8 turns for continuity
        r = "assistant" if turn.get("role") == "assistant" else "user"
        msgs.append({"role": r, "content": str(turn.get("content", ""))[:1500]})
    msgs.append({"role": "user", "content": question[:1500]})
    return {"reply": _chat(msgs, temperature=0.5, max_tokens=700)}


# ============================================================================
#  Vernacular / low-literacy support  (the worker-market differentiator)
# ============================================================================
INDIAN_LANGUAGES = [
    "English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi",
    "Gujarati", "Bengali", "Punjabi", "Odia", "Urdu", "Assamese",
]


def profile_from_speech(text: str, language: str = "auto") -> dict:
    """Turn a plain spoken/typed self-description in any Indian language into a profile.

    Lets a worker who can't write a resume simply say what they do — in their own
    language — and get a structured, searchable profile out of it.
    """
    msg = [
        {"role": "system", "content":
            "You build job profiles for Indian workers, including those with no formal "
            "education, from a plain description they gave about themselves. The input may be "
            "in ANY Indian language or transliterated (e.g. Hinglish). Understand it, then "
            "return ENGLISH field values so recruiters can search them. Never invent "
            "qualifications. Return JSON only."},
        {"role": "user", "content":
            f'The person said (language hint: {language}):\n"""{text[:3000]}"""\n\n'
            'Return JSON: {"detected_language": "", "first_name": "", "last_name": "", '
            '"headline": "", "profile_type": "worker or professional", '
            '"key_skills": [], "experience": [{"company": "", "role": "", "years": "", "description": ""}], '
            '"education": [{"degree": "", "institute": "", "year_of_passing": ""}], '
            '"location": "", "availability": "", "expected_salary": "", "languages": [], '
            '"career_objective": "", "suggested_sectors": [], '
            '"summary_in_their_language": "one friendly sentence back in their own language"}'},
    ]
    return _chat_json(msg, temperature=0.2, max_tokens=1500)


def translate_job(job: dict, language: str) -> dict:
    """Translate a job posting so non-English speakers can understand it."""
    msg = [
        {"role": "system", "content":
            f"Translate Indian job postings into {language}. Use simple, everyday words a "
            "worker with basic schooling would understand. Keep company names, place names "
            "and numbers as they are. Return JSON only."},
        {"role": "user", "content":
            f"Job: {json.dumps(job, default=str)}\n\n"
            'Return JSON: {"title": "", "description": "", "requirements": "", '
            '"pay": "", "how_to_apply": "one short line"}'},
    ]
    return _chat_json(msg, temperature=0.3, max_tokens=1200)


# ============================================================================
#  Recruiter intelligence
# ============================================================================
def rank_candidates(job: dict, candidates: list[dict]) -> dict:
    """Rank a whole applicant pool for one job, with a reason per candidate."""
    msg = [
        {"role": "system", "content":
            "You rank job applicants for Indian recruiters. Judge ONLY on skills, experience, "
            "education and location fit. Never consider or mention age, gender, religion, caste, "
            "marital status or any protected attribute. Return JSON only."},
        {"role": "user", "content":
            f"Job: {json.dumps(job, default=str)}\n\n"
            f"Candidates: {json.dumps(candidates, default=str)[:8000]}\n\n"
            "Rank them best-first. For each give a 0-100 fit score, one-line reason, and a "
            "recommendation from [interview, maybe, not_now].\n"
            'Return JSON: {"ranked": [{"id": 0, "name": "", "score": 0, "reason": "", '
            '"recommendation": ""}], "summary": "one line about the pool overall"}'},
    ]
    return _chat_json(msg, temperature=0.25, max_tokens=2000)


def jd_quality(job: dict) -> dict:
    """Score a job posting and say how to attract more applicants."""
    msg = [
        {"role": "system", "content":
            "You audit Indian job postings for clarity, inclusiveness and appeal. Flag any "
            "discriminatory or legally risky wording (age, gender, marital status, caste, "
            "region). Return JSON only."},
        {"role": "user", "content":
            f"Job posting: {json.dumps(job, default=str)}\n\n"
            'Return JSON: {"score": 0-100, "verdict": "one line", '
            '"strengths": [], "improvements": [], "risky_wording": [], '
            '"missing_fields": [], "suggested_title": ""}'},
    ]
    return _chat_json(msg, temperature=0.3, max_tokens=900)


def salary_insight(role: str, location: str, experience: str, sector: str = "") -> dict:
    """Indicative pay guidance for a role, clearly marked as an estimate."""
    msg = [
        {"role": "system", "content":
            "You give indicative salary guidance for the Indian job market. Be honest that "
            "these are estimates, not verified survey data. Use the correct basis for the "
            "role: daily wages for worker, monthly for most jobs, LPA for corporate/IT. "
            "Return JSON only."},
        {"role": "user", "content":
            f"Role: {role}\nLocation: {location}\nExperience: {experience}\nSector: {sector}\n\n"
            'Return JSON: {"basis": "daily|monthly|annual", "low": "", "typical": "", '
            '"high": "", "currency": "INR", "notes": "one or two lines", '
            '"factors": ["what moves pay up or down"], "confidence": "low|medium|high"}'},
    ]
    return _chat_json(msg, temperature=0.3, max_tokens=700)


# ============================================================================
#  Interview simulator
# ============================================================================
def mock_interview(profile: dict, job: dict, history: list[dict], answer: str | None) -> dict:
    """Conduct a mock interview one question at a time, scoring each answer."""
    msg = [
        {"role": "system", "content":
            "You are a friendly interviewer running a practice interview for an Indian "
            "candidate. Ask ONE question at a time. When the candidate answers, score it out "
            "of 10, give one specific improvement, then ask the next question. Keep it "
            "encouraging — this is practice. After 5 questions, finish with an overall verdict. "
            "Return JSON only."},
        {"role": "user", "content":
            f"Candidate: {json.dumps(profile, default=str)[:2500]}\n"
            f"Job: {json.dumps(job, default=str)[:2000]}\n"
            f"Interview so far: {json.dumps(history, default=str)[:3000]}\n"
            f"Their latest answer: {answer or '(interview is starting)'}\n\n"
            'Return JSON: {"feedback": "on their last answer, empty if starting", '
            '"score": 0, "improvement": "", "next_question": "", "question_number": 1, '
            '"finished": false, "final_verdict": "", "overall_score": 0}'},
    ]
    return _chat_json(msg, temperature=0.5, max_tokens=900)


def skill_roadmap(profile: dict, target_role: str) -> dict:
    """A concrete, time-boxed plan to reach a target role."""
    msg = [
        {"role": "system", "content": SYSTEM_CAREER + " Return JSON only."},
        {"role": "user", "content":
            f"Candidate: {json.dumps(profile, default=str)}\n\n"
            f'Target role: "{target_role}"\n\n'
            "Build a realistic plan. Prefer free or low-cost Indian options (NSDC, SWAYAM, "
            "ITI, YouTube, employer training). Do not invent specific course URLs.\n"
            'Return JSON: {"readiness": 0-100, "gap_summary": "one line", '
            '"steps": [{"step": "", "how": "", "weeks": 0}], '
            '"skills_to_learn": [], "certifications": [], "first_action": ""}'},
    ]
    return _chat_json(msg, temperature=0.45, max_tokens=1200)
