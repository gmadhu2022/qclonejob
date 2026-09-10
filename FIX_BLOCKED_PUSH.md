# Fixing a blocked push (secret detected)

GitHub refused your push because a real API key was found in committed files.
Work through these steps in order.

---

## Step 1 — Revoke the key (do this first)

The key is in your local git history and was seen by GitHub's scanner. Assume it is
compromised. Revoking is free and takes seconds.

- **Groq:** <https://console.groq.com/keys> → delete the key → create a new one
- Supabase password: Project Settings → Database → Reset database password
- Any other provider: revoke and reissue

**Do not click the "allow the secret" unblock link GitHub offered.** That publishes the key.

---

## Step 2 — Remove the key from your files

Real values belong in `backend/.env` (which is git-ignored), never in tracked source.

`backend/app/config.py` — the default must stay empty:

```python
GROQ_API_KEY: str = ""
```

`backend/.env.example` — a template, so no value:

```
GROQ_API_KEY=
```

Your new key goes in `backend/.env` only:

```
GROQ_API_KEY=your_new_key_here
```

Then confirm nothing else is leaking:

```bash
python check_secrets.py
```

Don't continue until it prints **CLEAN**.

---

## Step 3 — Remove it from git history

Deleting the key from the file isn't enough — the old commit still contains it. Since nothing
was ever accepted by GitHub, you can safely rewrite.

### If this was your first push (nothing on GitHub yet) — simplest

Squash everything into one clean commit:

```bash
git add -A
git reset --soft $(git rev-list --max-parents=0 HEAD)   # back to the very first commit, files kept
git add -A
git commit -m "Initial commit: QCloneJob job platform"
git push -u origin main --force
```

### If you have commits on GitHub you want to keep

Use `git filter-repo` (safer and faster than filter-branch):

```bash
pip install git-filter-repo
git filter-repo --path backend/.env --path backend/.env.example --invert-paths --force
# then re-add the cleaned .env.example and commit
git push --force
```

---

## Step 4 — Check what else you committed

Your push was **40 MB / 6,051 objects**, which is far larger than this codebase. That usually
means a virtual environment or `node_modules` got committed.

```bash
git ls-files | Select-String "site-packages|node_modules|Lib/"   # PowerShell
```

If that returns anything, the hardened `.gitignore` in this repo now covers it (including a venv
created as `python -m venv hire`). Remove them from tracking:

```bash
git rm -r --cached hire frontend/node_modules backend/venv 2>$null
git add -A
git commit -m "Remove virtual environment and node_modules from tracking"
```

A healthy repo here is a few MB, not 40.

---

## Step 5 — Prevent it happening again

Run the scanner before every push:

```bash
python check_secrets.py            # everything git would track
python check_secrets.py --staged   # only what's staged
```

To make it automatic, add a pre-commit hook — create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
python check_secrets.py --staged || exit 1
```

(On Windows with Git Bash this works as-is; the file needs no extension.)

---

## The rule

Anything secret — API keys, database passwords, SMTP credentials — lives in `.env`, which is
git-ignored. Tracked files contain only empty defaults and placeholders. `.env.example`
documents the *shape* of the config; `.env` holds the real values and never leaves your machine.
