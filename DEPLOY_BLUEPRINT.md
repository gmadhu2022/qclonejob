# Deploying QCloneJob on Render via Blueprint

Two services from one file: **qclonejob-api** (FastAPI) and **qclonejob-web** (React static site).
Database stays on Supabase. Total cost on the free tier: **$0**.

---

## Before you click anything

**1. Make sure `render.yaml` is on your GitHub default branch.**

```powershell
cd <your repo folder>
git pull
Test-Path render.yaml              # must be True, at the REPO ROOT
git log --oneline -1 -- render.yaml
```

If it isn't there, Render will say *"Blueprint file render.yaml not found"*. Copy the latest
files in, then:

```powershell
python check_secrets.py            # must print CLEAN
git add -A
git commit -m "Add Render blueprint"
git push
```

> **When extracting a new zip:** copy its *contents* into your existing git repo folder. Don't
> create a new folder next to it — Render deploys what's in the repo, not what's on your disk.

**1b. Verify no source file is missing from git.**

```powershell
python check_repo.py
```

This catches the failure where a file exists on your PC but was never pushed — the build works
locally and fails on Render with *"Could not resolve ../lib/api"*. It must print **OK** before
you deploy.

**2. Have your Supabase connection string ready** and verified with `python check_db.py`.
See [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

---

## Step 1 — Create the Blueprint

1. Go to <https://dashboard.render.com> → **New +** → **Blueprint**.
2. Connect your GitHub account and pick the repo.
3. Branch: **main** (or whatever `git branch --show-current` printed).
4. Blueprint Path: leave blank (defaults to `render.yaml` at the root).
5. Give the Blueprint a name, e.g. `qclonejob`, then **Apply**.

Render reads the file and shows both services. It will prompt for the variables marked
`sync: false` — these are the ones only you can know.

---

## Step 2 — Environment variables

### qclonejob-api (backend)

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://postgres.<ref>:<password>@<host>.pooler.supabase.com:5432/postgres` | **Session pooler** string. Percent-encode specials: `@`→`%40` |
| `FRONTEND_URL` | `https://qclonejob-web.onrender.com` | Fill in after step 3 |
| `CORS_ORIGINS` | `https://qclonejob-web.onrender.com` | Same value, no trailing slash |
| `GROQ_API_KEY` | your Groq key, or leave blank | Blank = AI features hidden, app still works |
| `SMTP_HOST` | `smtp-relay.brevo.com` | Or leave blank for console-only email |
| `SMTP_USER` | your Brevo SMTP login | |
| `SMTP_PASSWORD` | your Brevo SMTP key | Not your account password |
| `EMAIL_FROM` | your verified sender address | Must be verified with the provider |

Set automatically, no action needed: `PYTHON_VERSION` (3.12.4), `JWT_SECRET` (Render generates a
strong random value), `GROQ_MODEL`, `SMTP_PORT` (587), `AI_ENABLED` and `EMAIL_ENABLED` (both
`False` — flip to `True` once the keys above are filled in).

### qclonejob-web (frontend)

| Key | Value |
|---|---|
| `VITE_API_BASE` | `https://qclonejob-api.onrender.com` |

---

## Step 3 — The URL chicken-and-egg

You can't know the URLs until the services exist, so:

1. **Apply** the blueprint with placeholder values for `FRONTEND_URL`, `CORS_ORIGINS` and
   `VITE_API_BASE` (or leave them blank).
2. Wait for the first build (~5 minutes). Render assigns the real URLs.
3. Copy the actual URLs from the dashboard.
4. Update those three variables on both services.
5. **Manual Deploy → Deploy latest commit** on **both** services.

The frontend redeploy is not optional. Vite bakes `VITE_API_BASE` into the JavaScript bundle at
**build** time, so changing the variable does nothing until the site rebuilds.

---

## Step 4 — Seed the database

Run this from your laptop, with `backend/.env` pointing at the **same** Supabase database:

```powershell
cd backend
python seed.py
```

It creates the tables, adds any missing columns, and inserts the demo accounts and sample jobs.
You don't run it on Render — both connect to the same Supabase.

---

## Step 5 — Verify

Open `https://qclonejob-api.onrender.com/healthz`:

```json
{
  "status": "ok",
  "revision": "2026-08-24",
  "database": "postgres",
  "cors_origins": ["https://qclonejob-web.onrender.com", ...],
  "ai_enabled": false,
  "email_enabled": false
}
```

Check `database` says **postgres** (not sqlite) and `cors_origins` contains your frontend URL.

Then open the site and log in as `admin@qclonejob.com / admin123`. **Change that password
immediately** — it's in a public repo.

---

## Turning on AI and email after deployment

Both are just environment variables on **qclonejob-api**; no code change, no redeploy of the
frontend:

- **AI** — set `GROQ_API_KEY` and `AI_ENABLED=True`. Verify in Admin → Reports → AI model check.
- **Email** — set the four SMTP values and `EMAIL_ENABLED=True`. Verify in Admin → Reports →
  Email diagnostics, then watch the Email delivery panel for real send results.

Saving a variable restarts the service automatically.

---

## Free tier: what to expect

| | Free tier |
|---|---|
| Static site | Never sleeps. CDN + SSL. Genuinely production-grade. |
| Web service | **Sleeps after 15 min idle**; next request takes 30–60s |
| RAM / CPU | 512 MB / 0.1 CPU |
| Instance hours | 750/month |

The cold start is the one that bites: a visitor after a quiet hour waits up to a minute and
assumes the site is broken. Fine for demos; **$7/month** for a Starter instance removes it, and
that's the first upgrade worth paying for.

**Two things that will lose data:** Render's disk is ephemeral, so uploaded photos, logos and
banner media vanish on every deploy — move `_store()` in `app/routers/uploads.py` to Supabase
Storage before real users rely on it. And never use Render's free Postgres; it's deleted after
~30 days.

---

## If something fails

| Symptom | Cause and fix |
|---|---|
| "Blueprint file render.yaml not found" | Not pushed, or on a different branch. `git log -1 -- render.yaml` |
| Login works but every API call fails with CORS | `CORS_ORIGINS` doesn't exactly match the frontend URL. Fix and redeploy the API |
| Frontend loads, API calls go to localhost | `VITE_API_BASE` missing at build time. Set it, then **redeploy the frontend** |
| Refreshing a page gives 404 | SPA rewrite missing. The blueprint includes it; if you created the site manually, add `/*` → `/index.html` |
| `AttributeError` on startup | Mixed file versions in the repo. Commit the whole `backend/app` folder together |
| Build fails on psycopg2 | `requirements.txt` needs `psycopg2-binary` (it has it) |
| `Could not resolve "../lib/api"` | The file isn't in git. Run `python check_repo.py`, then `git add -f frontend/src/lib` and push |
| `/healthz` says `"database": "sqlite"` | `DATABASE_URL` didn't take. Check for a typo or a duplicate key |
| First request times out | Free-tier cold start. Wait 60s and retry |
