# Deploying QCloneJob on Render (free)

Two services: the **backend API** (free web service) and the **frontend** (free static site).
Database stays on **Supabase** — do not use Render's free Postgres, it gets deleted after ~30 days.

Total cost: **₹0**. No credit card required.

---

## Before you start

1. Code pushed to GitHub with **no secrets committed** — run `python check_secrets.py` first.
   If a push was blocked, see [FIX_BLOCKED_PUSH.md](FIX_BLOCKED_PUSH.md).
2. A working Supabase connection string — see [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
   Verify locally with `python check_db.py` before deploying.

---

## Option A — Blueprint (both services at once, recommended)

This repo has a `render.yaml`, so Render can create both services for you.

1. Sign up at <https://render.com> (GitHub login is easiest).
2. **New → Blueprint** → connect your repo → Render detects `render.yaml` → **Apply**.
3. Render will ask for the values marked `sync: false`. Fill in:

   | Service | Key | Value |
   |---|---|---|
   | qclonejob-api | `DATABASE_URL` | your Supabase session-pooler URI |
   | qclonejob-api | `FRONTEND_URL` | `https://qclonejob-web.onrender.com` |
   | qclonejob-api | `CORS_ORIGINS` | `https://qclonejob-web.onrender.com` |
   | qclonejob-web | `VITE_API_BASE` | `https://qclonejob-api.onrender.com` |

   `JWT_SECRET` is generated automatically. Leave the AI/email keys blank for now.

4. First build takes ~5 minutes. When `qclonejob-api` is live, open
   `https://qclonejob-api.onrender.com/healthz` — you should see `{"status":"ok"}`.

**Chicken-and-egg note:** you won't know the exact URLs until the services exist. Deploy first,
then go back and set `FRONTEND_URL`, `CORS_ORIGINS` and `VITE_API_BASE` to the real URLs, and
redeploy both. The frontend **must** be redeployed after changing `VITE_API_BASE`, because Vite
bakes it into the bundle at build time.

---

## Option B — Manual (two services by hand)

### Backend

**New → Web Service** → connect repo, then:

| Field | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | **Free** |
| Region | Singapore |
| Health Check Path | `/healthz` |

Environment variables:

```
DATABASE_URL   = postgresql+psycopg2://postgres.<ref>:<password>@<host>.pooler.supabase.com:5432/postgres
JWT_SECRET     = <a long random string>
FRONTEND_URL   = https://qclonejob-web.onrender.com
CORS_ORIGINS   = https://qclonejob-web.onrender.com
PYTHON_VERSION = 3.12.4
```

`$PORT` is supplied by Render — don't hardcode 8000.

### Frontend

**New → Static Site** → same repo, then:

| Field | Value |
|---|---|
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

Environment variable:

```
VITE_API_BASE = https://qclonejob-api.onrender.com
```

**Then add the SPA rewrite rule** — Settings → Redirects/Rewrites:

| Source | Destination | Type |
|---|---|---|
| `/*` | `/index.html` | Rewrite |

Without this, refreshing on `/jobseeker/profile` gives a 404, because the static host looks for
a file at that path. This is the single most common React-on-Render mistake.

---

## After the first deploy

**Seed the database.** From your laptop, with `.env` pointing at the same Supabase database:

```bash
cd backend
python seed.py
```

That creates the tables, adds any missing columns, and inserts the demo accounts and sample jobs.
You do not need to run it on Render — both connect to the same Supabase.

**Test the chain:** open your static site URL, log in as `admin@qclonejob.com / admin123`.
If the page loads but login fails, it's almost always CORS or `VITE_API_BASE` — see below.

---

## Free tier limits, honestly

| | Free tier |
|---|---|
| Static site | Never sleeps, CDN + SSL included. Genuinely fine for production. |
| Web service | **Sleeps after 15 min idle.** First request then takes 30–60s. |
| RAM / CPU | 512 MB / 0.1 CPU |
| Hours | 750 instance-hours per month |
| Bandwidth | 100 GB/month |
| Build minutes | 500/month |

**What the spin-down means in practice:** a job seeker opening your site after a quiet hour waits
up to a minute for the first page of data, which most people read as "broken". It is fine for
demos and for showing investors; it is not fine once real users depend on it. Removing it costs
**$7/month** for a Starter instance.

Pinging your own service to keep it awake burns your 750 monthly hours (a month is ~730 hours),
so a single always-pinged service consumes essentially the whole allowance. It's not a real fix.

---

## Two things that will bite you

**1. Uploaded files disappear.** Render's disk is ephemeral: every deploy and every spin-down
wipes `backend/uploads`. Profile photos, logos and banner media will vanish. The app now prints a
warning about this at startup on Render. **Fix before real users:** move `_store()` in
`app/routers/uploads.py` to Supabase Storage — nothing else in the code depends on where the
bytes live.

**2. Never use Render's free Postgres.** It is deleted after ~30 days. Supabase's free tier
persists (it only pauses after 7 days idle, and restores with one click).

---

## Troubleshooting

**Login fails, console shows a CORS error**
`CORS_ORIGINS` on the backend must exactly match your frontend URL — including `https://` and no
trailing slash. Redeploy the backend after changing it.

**Frontend loads but every API call 404s or hits localhost**
`VITE_API_BASE` was missing or wrong at build time. Set it, then **redeploy the frontend** —
changing the variable alone does nothing until it rebuilds.

**Refreshing a page gives 404**
The SPA rewrite rule is missing (see Frontend setup above).

**Backend build fails on `psycopg2`**
Ensure `requirements.txt` has `psycopg2-binary` (it does), not `psycopg2`.

**First request times out**
That's the free-tier cold start. Wait 60 seconds and retry.

**`AttributeError: 'Settings' object has no attribute 'cors_list'` (or any missing attribute)**
Your repo has a mix of file versions — a new `app/main.py` with an older `app/config.py`. This
happens when a zip is extracted over only part of the project. Fix by making sure **both** files
came from the same package, then commit and push together:

```bash
git status --short          # see exactly which files differ
git add -A && git commit -m "Sync backend files" && git push
```

`main.py` no longer reads CORS from a Settings property, so this specific crash can't recur —
but a mismatched deploy can still cause others. Check `/healthz`: it reports `revision`,
`database`, `cors_origins`, `ai_enabled` and `email_enabled`, so you can confirm what is
actually running.

**Deploy succeeded but `/healthz` 502s**
Check the service logs. Usually `DATABASE_URL` is wrong — the startup error names the problem
and points at `check_db.py`.

---

## When to start paying

Move the backend to Starter ($7/mo) the moment you have users who aren't you. Everything else —
static site, Supabase free tier, Brevo email, Groq AI — can stay free well past that point.
