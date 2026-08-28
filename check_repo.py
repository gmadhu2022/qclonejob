"""Verify every source file the build needs is actually tracked by git.

Catches the failure mode where a .gitignore pattern silently excludes real code:
the app builds locally (the file is on disk) but fails on the server (it was never
pushed). Run this before deploying.

    python check_repo.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Files/folders the build genuinely cannot do without.
REQUIRED = [
    "render.yaml",
    "frontend/package.json",
    "frontend/vite.config.js",
    "frontend/index.html",
    "frontend/src/main.jsx",
    "frontend/src/App.jsx",
    "frontend/src/index.css",
    "frontend/src/lib/api.js",
    "frontend/src/lib/options.js",
    "frontend/src/context/AuthContext.jsx",
    "backend/requirements.txt",
    "backend/seed.py",
    "backend/app/main.py",
    "backend/app/config.py",
    "backend/app/models.py",
    "backend/app/database.py",
]
REQUIRED_DIRS = [
    "frontend/src/components",
    "frontend/src/pages",
    "frontend/src/assets",
    "backend/app/routers",
]


def git(*args) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True).stdout


def main() -> int:
    tracked = set(git("ls-files").splitlines())
    if not tracked:
        print("Not a git repository (or nothing committed yet).")
        return 1

    problems = []

    for rel in REQUIRED:
        on_disk = (ROOT / rel).exists()
        in_git = rel in tracked
        if not on_disk:
            problems.append((rel, "missing from disk"))
        elif not in_git:
            why = git("check-ignore", "-v", rel).strip() or "not added"
            problems.append((rel, f"on disk but NOT in git — {why}"))

    for d in REQUIRED_DIRS:
        disk_files = {str(p.relative_to(ROOT)).replace("\\", "/")
                      for p in (ROOT / d).rglob("*")
                      if p.is_file() and p.suffix in (".js", ".jsx", ".py", ".css", ".png")}
        untracked = sorted(disk_files - tracked)
        for f in untracked:
            why = git("check-ignore", "-v", f).strip()
            problems.append((f, f"NOT in git — {why or 'not added'}"))

    if not problems:
        print(f"OK — all required source files are tracked ({len(tracked)} files in git).")
        print("Safe to push and deploy.")
        return 0

    print("=" * 72)
    print(f"  {len(problems)} FILE(S) WOULD BREAK THE DEPLOY")
    print("=" * 72)
    for rel, why in problems:
        print(f"\n  {rel}\n     {why}")
    print("\n" + "-" * 72)
    print("  Fix:")
    print("   1. If a .gitignore rule is to blame, correct the rule.")
    print("   2. Force-add anything wrongly excluded:  git add -f <path>")
    print("   3. Commit and push, then redeploy.")
    print("-" * 72)
    return 1


if __name__ == "__main__":
    sys.exit(main())
