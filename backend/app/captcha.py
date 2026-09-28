"""A small, self-hosted CAPTCHA for the public registration forms.

WHY NOT reCAPTCHA
-----------------
Google's reCAPTCHA would be stronger, but it needs a site key, a secret, a
third-party script on every registration page and a per-request call out to
Google from the backend. That is a deployment dependency and a privacy
decision, not something to add silently. This gives the registration form a
real bot check today with no keys and no outbound calls; swap in reCAPTCHA
later by replacing verify() and leaving the endpoints alone.

WHY STATELESS
-------------
The challenge is signed with the app's SECRET_KEY and carries its own expiry,
so nothing is stored. A DB table would need a row per page view plus a sweeper
for the ones nobody ever submits — a surprising amount of machinery for a
throwaway sum. The token proves the server issued THIS challenge and that the
answer submitted matches it.

A token is single-use in practice because it expires quickly; it is not a
replay-proof nonce. That is the right trade for a registration speed bump —
the real protections against bulk signups are email verification and the
admin approval queue, not this.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import random
import time

from .config import settings

TTL_SECONDS = 10 * 60          # long enough to fill in a whole form, twice


def _key() -> bytes:
    return (getattr(settings, "SECRET_KEY", "") or "qclonejob-dev-secret").encode()


def _sign(payload: str) -> str:
    return hmac.new(_key(), payload.encode(), hashlib.sha256).hexdigest()[:32]


def _b64e(raw: str) -> str:
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def _b64d(raw: str) -> str:
    return base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode()


def issue() -> dict:
    """Make a fresh challenge.

    Addition and multiplication of small numbers only: the point is to be
    trivial for a person and to require an actual round trip, not to be a
    puzzle. Anything harder fails accessibility and punishes the wrong people.
    """
    a, b = random.randint(1, 9), random.randint(1, 9)
    if random.random() < 0.5:
        question, answer = f"What is {a} + {b}?", a + b
    else:
        question, answer = f"What is {a} × {b}?", a * b

    body = json.dumps({"a": str(answer), "e": int(time.time()) + TTL_SECONDS},
                      separators=(",", ":"))
    encoded = _b64e(body)
    return {"question": question, "token": f"{encoded}.{_sign(encoded)}"}


def verify(token: str, answer: str) -> tuple[bool, str]:
    """Check an answer against its token. Returns (ok, message)."""
    if not (token or "").strip():
        raise_msg = "Please complete the security check."
        return False, raise_msg
    if not (answer or "").strip():
        return False, "Please answer the security check."

    try:
        encoded, signature = token.rsplit(".", 1)
    except ValueError:
        return False, "Security check failed. Please refresh it and try again."

    # compare_digest, not ==, so a forged token can't be brute-forced one
    # character at a time by timing the response.
    if not hmac.compare_digest(signature, _sign(encoded)):
        return False, "Security check failed. Please refresh it and try again."

    try:
        data = json.loads(_b64d(encoded))
    except Exception:
        return False, "Security check failed. Please refresh it and try again."

    if int(data.get("e", 0)) < time.time():
        return False, "The security check expired. Please refresh it and try again."

    if str(answer).strip() != str(data.get("a")):
        return False, "That answer isn't right. Please try the security check again."

    return True, "ok"
