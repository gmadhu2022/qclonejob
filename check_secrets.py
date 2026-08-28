"""Scan the repo for secrets BEFORE you commit.

  python check_secrets.py            scan files git is tracking (or would track)
  python check_secrets.py --staged   scan only what's staged for commit

Catches the mistake that gets pushes blocked: a real API key pasted into a file
that isn't ignored, such as config.py or .env.example.

Exit code 1 means something was found — do not commit until it's clean.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# name, regex, note
PATTERNS = [
    ("Groq API key",      r"[A-Za-z0-9]{20,}",                    "console.groq.com/keys"),
    ("OpenAI API key",    r"sk-(?:proj-)?[A-Za-z0-9_\-]{20,}",        "platform.openai.com"),
    ("Anthropic API key", r"sk-ant-[A-Za-z0-9_\-]{20,}",              "console.anthropic.com"),
    ("AWS access key",    r"AKIA[0-9A-Z]{16}",                        "AWS IAM"),
    ("Google API key",    r"AIza[0-9A-Za-z_\-]{35}",                  "Google Cloud console"),
    ("Slack token",       r"xox[baprs]-[A-Za-z0-9\-]{10,}",           "Slack"),
    ("GitHub token",      r"gh[pousr]_[A-Za-z0-9]{36,}",              "GitHub settings"),
    ("Supabase JWT",      r"eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}", "Supabase"),
    ("Postgres password in URL",
     r"postgres(?:ql)?(?:\+\w+)?://[^:\s]+:(?!\[|<|YOUR|password\b|\s)[^@\s]{6,}@", "database credentials"),
    ("Private key block", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "private key"),
]

# Files that legitimately describe secret *formats* without containing one.
# Matched case-insensitively. These indicate a documented FORMAT, not a real secret.
DOC_HINTS = ("your", "<", "[", "xxx", "example", "placeholder", "abcdef",
             "password@", "user:password", ":password", "my-password", "changeme")

SKIP_DIRS = {".git", "node_modules", "venv", ".venv", "__pycache__", "dist",
             "site-packages", "Lib", "Scripts", "uploads"}
SKIP_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mp3", ".zip",
            ".pdf", ".woff", ".woff2", ".ico", ".db", ".sqlite3"}


def git_files(staged: bool) -> list[Path]:
    cmd = (["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"]
           if staged else ["git", "ls-files", "--cached", "--others", "--exclude-standard"])
    try:
        out = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Not a git repo (or git unavailable) — scanning all files instead.\n")
        return [p for p in ROOT.rglob("*") if p.is_file()]
    return [ROOT / line for line in out.splitlines() if line.strip()]


def should_scan(p: Path) -> bool:
    if not p.is_file():
        return False
    if any(part in SKIP_DIRS for part in p.parts):
        return False
    if p.suffix.lower() in SKIP_EXT:
        return False
    try:
        if p.stat().st_size > 2_000_000:
            return False
    except OSError:
        return False
    return True


def main() -> int:
    staged = "--staged" in sys.argv
    files = [p for p in git_files(staged) if should_scan(p)]
    print(f"Scanning {len(files)} file(s){' (staged only)' if staged else ''}…\n")

    findings = []
    for path in files:
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            for name, pattern, note in PATTERNS:
                m = re.search(pattern, line)
                if not m:
                    continue
                # ignore obvious documentation placeholders
                if any(h.lower() in line.lower() for h in DOC_HINTS):
                    continue
                secret = m.group(0)
                masked = secret[:7] + "…" + secret[-4:] if len(secret) > 14 else "…"
                rel = path.relative_to(ROOT)
                findings.append((str(rel), lineno, name, masked, note))

    if not findings:
        print("CLEAN — no secrets detected. Safe to commit.\n")
        return 0

    print("=" * 70)
    print(f"  {len(findings)} POSSIBLE SECRET(S) FOUND — DO NOT COMMIT")
    print("=" * 70)
    for rel, lineno, name, masked, note in findings:
        print(f"\n  {name}")
        print(f"    file  : {rel}:{lineno}")
        print(f"    value : {masked}")
        print(f"    source: {note}")
    print("\n" + "-" * 70)
    print("  What to do:")
    print("   1. REVOKE the key at the provider — assume it is already compromised.")
    print("   2. Remove it from the file (use an empty default; real values go in .env).")
    print("   3. Make sure .env is in .gitignore — it is, in this repo.")
    print("   4. If it was already committed, rewrite history (see README).")
    print("-" * 70 + "\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
