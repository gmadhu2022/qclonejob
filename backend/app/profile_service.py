"""Profile completeness scoring.

Scoring is role-aware (item 1): a graduate/professional profile is judged on projects,
work experience and education; a worker/skilled profile is judged on work experience,
skills and availability — asking a daily-wage worker for "projects" or a career
objective would be noise, so those checks simply don't apply to them.

Each check has a weight so the score reflects what actually gets a candidate hired,
rather than treating every field as equally important.
"""
from . import models

# (key, label, weight, getter)
def _has(v) -> bool:
    if v is None:
        return False
    if isinstance(v, (list, dict)):
        return len(v) > 0
    return bool(str(v).strip())


PROFESSIONAL_CHECKS = [
    ("photo",       "Profile photo",      6,  lambda s: s.profile_picture_url),
    ("name",        "Full name",          8,  lambda s: s.first_name),
    ("headline",    "Professional headline", 7, lambda s: s.headline),
    ("phone",       "Phone number",       8,  lambda s: s.phone),
    ("location",    "Current location",   7,  lambda s: s.location),
    ("objective",   "Career objective",   8,  lambda s: s.career_objective),
    ("skills",      "Key skills",        12,  lambda s: s.key_skills),
    ("education",   "Education",         12,  lambda s: s.education),
    ("experience",  "Work experience",   12,  lambda s: s.experience),
    ("projects",    "Projects",          10,  lambda s: s.projects),
    ("certifications", "Certifications",  4,  lambda s: s.certifications),
    ("languages",   "Languages",          3,  lambda s: s.languages),
    ("preferences", "Job preferences",    3,  lambda s: s.preferred_locations or s.expected_salary),
]

WORKER_CHECKS = [
    ("photo",       "Profile photo",      8,  lambda s: s.profile_picture_url),
    ("name",        "Full name",         10,  lambda s: s.first_name),
    ("phone",       "Phone number",      14,  lambda s: s.phone),
    ("location",    "Location",          12,  lambda s: s.location),
    ("skills",      "Work / trade skills", 18, lambda s: s.key_skills),
    ("experience",  "Work experience",   18,  lambda s: s.experience),
    ("availability", "Availability",       8,  lambda s: s.availability),
    ("expected_salary", "Expected pay",   6,  lambda s: s.expected_salary),
    ("languages",   "Languages spoken",   6,  lambda s: s.languages),
]


def checks_for(seeker: models.JobSeeker):
    return WORKER_CHECKS if (seeker.profile_type or "professional") == "worker" else PROFESSIONAL_CHECKS


def profile_strength(seeker: models.JobSeeker) -> dict:
    checks = checks_for(seeker)
    total = sum(w for _, _, w, _ in checks)
    earned, done, missing = 0, [], []
    for key, label, weight, getter in checks:
        if _has(getter(seeker)):
            earned += weight
            done.append(label)
        else:
            missing.append({"key": key, "label": label, "weight": weight})

    score = int(round(100 * earned / total)) if total else 0
    # Biggest wins first, so the nudge is always the most valuable next action.
    missing.sort(key=lambda m: m["weight"], reverse=True)

    if score >= 90:
        level, message = "Excellent", "Your profile stands out to recruiters."
    elif score >= 70:
        level, message = "Good", "Almost there — a couple more fields will lift you above most candidates."
    elif score >= 40:
        level, message = "Average", "Recruiters filter on these fields. Filling them in gets you seen more."
    else:
        level, message = "Needs work", "Incomplete profiles are rarely shortlisted. Start with the items below."

    return {
        "score": score,
        "level": level,
        "message": message,
        "completed": done,
        "missing": missing,
        "next_best": missing[0]["label"] if missing else None,
        "profile_type": seeker.profile_type or "professional",
    }
