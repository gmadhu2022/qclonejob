"""Email setup wizard.  Run:  python setup_email.py

Walks you through configuring outgoing email, writes backend/.env safely
(no duplicate keys), then actually connects and sends a test message so you
know it works before you rely on it.

  python setup_email.py            interactive setup
  python setup_email.py --test     just test what's already configured
  python setup_email.py --show     show current settings (password hidden)
"""
import os
import re
import smtplib
import ssl
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / ".env"

PROVIDERS = {
    "1": {
        "name": "Brevo  (recommended — free 300 emails/day, works with your Gmail address)",
        "host": "smtp-relay.brevo.com", "port": 587,
        "user_label": "Brevo SMTP login (shown on the SMTP & API page)",
        "pass_label": "Brevo SMTP key (NOT your account password)",
        "steps": [
            "1. Sign up free at https://www.brevo.com",
            "2. Senders, Domains & IPs > Senders > Add a sender",
            "   -> enter YOUR OWN Gmail address, then click the link Brevo emails you",
            "3. SMTP & API > SMTP tab > copy the 'login' and generate an 'SMTP key'",
            "4. Your emails will arrive FROM your own address. No domain needed.",
        ],
    },
    "2": {
        "name": "Mailjet  (free 6,000/month, 200/day)",
        "host": "in-v3.mailjet.com", "port": 587,
        "user_label": "Mailjet API Key",
        "pass_label": "Mailjet Secret Key",
        "steps": [
            "1. Sign up free at https://www.mailjet.com",
            "2. Account settings > Sender domains & addresses > Add a sender address",
            "   -> enter YOUR OWN email, confirm via the link they send",
            "3. Account settings > REST API > API Key Management > copy API Key + Secret Key",
        ],
    },
    "3": {
        "name": "Gmail  (needs 2-Step Verification + an App Password)",
        "host": "smtp.gmail.com", "port": 587,
        "user_label": "Your full Gmail address",
        "pass_label": "16-character App Password (spaces removed)",
        "steps": [
            "1. Turn ON 2-Step Verification: https://myaccount.google.com/security",
            "   App Passwords DO NOT EXIST until this is fully enabled.",
            "2. Create one: https://myaccount.google.com/apppasswords  (choose 'Mail')",
            "3. Copy the 16 characters and remove the spaces.",
            "NOTE: Gmail allows only ~500 emails/day and dislikes bulk sending.",
        ],
    },
    "4": {
        "name": "Zoho Mail  (free, good if you later add your own domain)",
        "host": "smtp.zoho.in", "port": 587,
        "user_label": "Your Zoho email address",
        "pass_label": "Zoho app password",
        "steps": [
            "1. Sign up at https://www.zoho.com/mail/ (free plan)",
            "2. Security > App Passwords > generate one for 'Mail'",
            "3. If outside India, change the host to smtp.zoho.com",
        ],
    },
    "5": {
        "name": "Outlook / Hotmail",
        "host": "smtp-mail.outlook.com", "port": 587,
        "user_label": "Your Outlook address",
        "pass_label": "App password (2FA must be on)",
        "steps": [
            "1. Turn on 2-step verification in your Microsoft account",
            "2. Create an app password under Security > Advanced security options",
        ],
    },
}


# ---------------------------------------------------------------- .env writing
def read_env() -> dict:
    if not ENV_PATH.exists():
        return {}
    out = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip()   # later keys overwrite earlier — same as dotenv
    return out


def write_env(updates: dict) -> None:
    """Update keys in place, removing duplicates (a repeated key silently wins)."""
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines() if ENV_PATH.exists() else []
    seen = set()
    out = []
    for line in lines:
        m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=", line)
        if not m:
            out.append(line)
            continue
        key = m.group(1)
        if key in updates:
            if key in seen:
                continue                      # drop the duplicate entirely
            out.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, val in updates.items():
        if key not in seen:
            out.append(f"{key}={val}")
    ENV_PATH.write_text("\n".join(out) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- SMTP testing
def test_smtp(host, port, user, password, sender, to_addr) -> tuple[bool, str]:
    msg = MIMEMultipart()
    msg["From"] = sender
    msg["To"] = to_addr
    msg["Subject"] = "QCloneJob — test email"
    msg.attach(MIMEText(
        "This is a test from your QCloneJob backend.\n\n"
        "If you're reading this, outgoing email works.\n", "plain"))
    try:
        ctx = ssl.create_default_context()
        if int(port) == 465:
            with smtplib.SMTP_SSL(host, int(port), context=ctx, timeout=25) as s:
                s.login(user, password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, int(port), timeout=25) as s:
                s.ehlo(); s.starttls(context=ctx); s.ehlo()
                s.login(user, password)
                s.send_message(msg)
        return True, "sent"
    except smtplib.SMTPAuthenticationError as e:
        code = getattr(e, "smtp_code", "")
        detail = (getattr(e, "smtp_error", b"") or b"").decode(errors="ignore")
        hint = "Authentication failed.\n"
        if "gmail" in host:
            hint += ("  Gmail rejects normal passwords. You need a 16-char App Password,\n"
                     "  which only appears after 2-Step Verification is fully enabled.\n"
                     "  https://myaccount.google.com/apppasswords")
        elif "brevo" in host:
            hint += ("  Use the SMTP KEY from Brevo's 'SMTP & API' page — not your\n"
                     "  Brevo account password, and not your Gmail password.")
        else:
            hint += "  Double-check the username and key/app-password."
        return False, f"{hint}\n\n  Server said: {code} {detail[:200]}"
    except smtplib.SMTPSenderRefused as e:
        return False, ("The sender address was refused.\n"
                       f"  '{sender}' must be VERIFIED with your provider first.\n"
                       f"  Server said: {e}")
    except smtplib.SMTPRecipientsRefused as e:
        return False, f"The recipient was refused: {e}"
    except (smtplib.SMTPConnectError, OSError, TimeoutError) as e:
        return False, ("Could not reach the mail server.\n"
                       "  Your network or firewall may block this port.\n"
                       "  Try a mobile hotspot, or port 465 instead of 587.\n"
                       f"  Detail: {e}")
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def show_current() -> None:
    env = read_env()
    print("\nCurrent email settings in .env")
    print("-" * 56)
    for k in ("EMAIL_ENABLED", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "EMAIL_FROM"):
        print(f"  {k:<15} {env.get(k, '(not set)')}")
    print(f"  {'SMTP_PASSWORD':<15} {'(set)' if env.get('SMTP_PASSWORD') else '(not set)'}")
    dupes = _duplicate_keys()
    if dupes:
        print(f"\n  [!] Duplicate keys found: {', '.join(dupes)}")
        print("      The LAST one wins — that alone can make settings look ignored.")
        print("      Re-running this wizard removes duplicates.")
    print()


def _duplicate_keys() -> list:
    if not ENV_PATH.exists():
        return []
    counts = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=", line)
        if m:
            counts[m.group(1)] = counts.get(m.group(1), 0) + 1
    return [k for k, n in counts.items() if n > 1]


def run_test_only() -> int:
    env = read_env()
    missing = [k for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD") if not env.get(k)]
    if missing:
        print(f"Not configured yet (missing {', '.join(missing)}). Run: python setup_email.py")
        return 1
    to = input("Send a test email to which address? ").strip()
    if not to:
        return 1
    print("\nSending…")
    ok, detail = test_smtp(env["SMTP_HOST"], env.get("SMTP_PORT", 587),
                           env["SMTP_USER"], env["SMTP_PASSWORD"],
                           env.get("EMAIL_FROM") or env["SMTP_USER"], to)
    print("\nSUCCESS — check the inbox (and spam folder)." if ok else f"\nFAILED\n\n{detail}")
    return 0 if ok else 1


def main() -> int:
    if "--show" in sys.argv:
        show_current(); return 0
    if "--test" in sys.argv:
        return run_test_only()

    print("=" * 66)
    print("  QCloneJob — email setup")
    print("=" * 66)
    print("\nSend from YOUR OWN email address, for free.\n")
    for key, p in PROVIDERS.items():
        print(f"  {key}. {p['name']}")
    print("  0. Turn email OFF (print to console instead — fine for development)\n")

    choice = input("Choose [1]: ").strip() or "1"

    if choice == "0":
        write_env({"EMAIL_ENABLED": "False"})
        print("\nEmail disabled. Messages will print in the backend terminal.")
        return 0
    if choice not in PROVIDERS:
        print("Unknown choice.")
        return 1

    p = PROVIDERS[choice]
    print("\n" + "-" * 66)
    print(f"  {p['name']}")
    print("-" * 66)
    for step in p["steps"]:
        print("  " + step)
    print("-" * 66 + "\n")
    input("Press Enter once you've done the steps above… ")

    user = input(f"\n{p['user_label']}: ").strip()
    password = input(f"{p['pass_label']}: ").strip().replace(" ", "")
    sender = input("Send emails FROM which address (your verified address): ").strip()
    if not (user and password and sender):
        print("All three values are required.")
        return 1

    host = input(f"SMTP host [{p['host']}]: ").strip() or p["host"]
    port = input(f"SMTP port [{p['port']}]: ").strip() or str(p["port"])

    to = input("\nSend a test email to which address? ").strip() or sender
    print("\nTesting the connection…")
    ok, detail = test_smtp(host, port, user, password, sender, to)

    if not ok:
        print(f"\nFAILED — nothing was saved.\n\n{detail}\n")
        print("Fix the issue above and run this wizard again.")
        return 1

    write_env({
        "EMAIL_ENABLED": "True",
        "SMTP_HOST": host,
        "SMTP_PORT": port,
        "SMTP_USER": user,
        "SMTP_PASSWORD": password,
        "EMAIL_FROM": sender,
    })
    print("\n" + "=" * 66)
    print("  SUCCESS — test email sent and settings saved to .env")
    print("=" * 66)
    print(f"  Check the inbox of {to} (look in Spam the first time).")
    print("  Restart the backend for the change to take effect:")
    print("      uvicorn app.main:app --reload")
    print("=" * 66 + "\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)
