# QCloneJob — Qualification Meets Job

> **Never commit secrets.** API keys, database passwords and SMTP credentials go in
> `backend/.env` (git-ignored). Tracked files keep empty defaults only. Run
> `python check_secrets.py` before pushing. If GitHub has already blocked a push,
> see [FIX_BLOCKED_PUSH.md](FIX_BLOCKED_PUSH.md).

A full-stack job platform with four roles — **Job Seeker, Enterprise (Recruiter), Institute, Admin** —
built on **Plan B**: React + Tailwind web frontend, FastAPI (Python) backend, Supabase/Postgres database.

This is a **runnable foundation**. The core architecture and the three emphasized flows are
implemented end-to-end and tested. The remaining CRUD screens are wired to real API endpoints
with the correct fields, ready for you to extend.

---

## What works today

**The three emphasized flows are fully implemented and tested:**

1. **Institute Excel upload → auto-resume → emailed credentials.**
   An institute uploads an `.xlsx` describing 1..N students. For each row the backend maps the
   available columns (flexible header matching), auto-builds a resume, stores it, generates a
   random password, creates the login, and emails each student their user ID + password.
   → `backend/app/resume_service.py`, `POST /api/institute/upload`

2. **Job seeker edits resume + switches template.**
   The job seeker can add additional information and edit any resume field, and switch between
   **six professional templates** — Classic (ATS-safe serif), Modern (navy sidebar), Professional
   (banner header + timeline), Executive (monogram), Minimal, and Compact. The template gallery
   shows a live scaled preview of each one rendered with the seeker's real data, with full-size
   preview and A4 print/download.
   → `frontend/src/pages/jobseeker/`, `PUT /api/jobseeker/profile`, `PUT /api/jobseeker/template`

3. **Job seeker sees who viewed their application + live status.**
   When a recruiter views or downloads a resume it's recorded; the seeker sees the company,
   recruiter and action under "Recruiter views", and the live status of each application
   (Applied → Under Review → Shortlisted → Rejected → Selected) under "Applied jobs".
   → `ProfileView` model, `GET /api/jobseeker/profile-views`, `GET /api/jobseeker/applications`

**Also implemented:** JWT auth for all four roles, a modern branded UI with your logo, home page
with header logins (no awkward middle cards), self-registration (job seeker + enterprise), admin
CRUD for institutes/enterprises/seekers with emailed credentials and password reset, enterprise
resume search + job posting + applications inbox with status control + banner posting, institute
student search + job posting, real-time **chat with block controls** between seekers and recruiters,
**live-updating** stats/statuses/badges, and an **email diagnostics** panel for Gmail setup.

---

## Run it locally

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # defaults run on SQLite, emails print to console
python seed.py                     # creates demo accounts
uvicorn app.main:app --reload      # http://localhost:8000  (docs at /docs)
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173  (proxies /api to :8000)
```

**Before committing, run `npm run verify`.** `vite build` alone does *not* catch undefined
identifiers (bundlers treat unknown names as globals), so a missing import passes the build and
then blanks the page at runtime with `X is not defined`. `npm run verify` runs an ESLint
`no-undef` pass first, then the build, which catches exactly that.

### Locked out? Reset a password

Passwords are bcrypt-hashed and **cannot be decoded** — that's the protection. Set a new one instead:

```bash
cd backend
python reset_password.py --list                          # see every account
python reset_password.py admin@qclonejob.com                  # generate a new password
python reset_password.py admin@qclonejob.com --password Abc123 # set a specific one
python reset_password.py admin@qclonejob.com --link           # print a reset link instead
```

**Why "forgot password" seems broken:** with `EMAIL_ENABLED=False` (the default) no email is
sent — the reset link prints in the **backend terminal** instead, in a banner marked
`PASSWORD RESET LINK`. Scroll your uvicorn window. To get real emails, configure SMTP
(see the email section) or just use `reset_password.py`.

## Demo logins (from `seed.py`)

| Role       | Email           | Password |
|------------|-----------------|----------|
| Admin      | admin@qclonejob.com  | admin123 |
| Institute  | coco@qclonejob.com   | inst123  |
| Enterprise | hr@campus.com   | ent123   |

Job-seeker accounts are created by uploading an Excel in the Institute portal (Data upload) —
the generated passwords appear in the results table **and** print to the backend console
(console email mode). Log in as one to see the resume/template/application flows.

---

## Deploying

Free deployment on Render (API + static frontend, Supabase for the database):
**[DEPLOY_RENDER.md](DEPLOY_RENDER.md)**. The repo includes a `render.yaml` blueprint, so
Render can create both services in one step.

## Database

Local dev runs on SQLite with zero setup. To move to Supabase Postgres, follow
**[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** — it's one line in `.env` plus a verification step.

Two commands worth knowing:

```bash
python check_db.py    # shows what you'll connect to, and names the fix if it fails
python seed.py        # creates tables, adds missing columns, seeds demo data
```

`seed.py` runs the schema migration automatically, so if you ever hit
`no such column: jobs.sector` after pulling an update, re-running `python seed.py`
repairs the database in place — on SQLite and on Supabase.

## Switch to Supabase (production database)

The backend uses plain SQLAlchemy, so moving from SQLite to Supabase's Postgres is one line.
In `backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://postgres:YOUR-PASSWORD@db.YOUR-REF.supabase.co:5432/postgres
```

Get the string from **Supabase dashboard → Project Settings → Database → Connection string (URI)**.
Tables are created automatically on startup. For real schema management later, add Alembic migrations.

## Email setup — one command

```bash
cd backend
python setup_email.py          # interactive: pick a provider, it tests and saves
python setup_email.py --test   # test what's already configured
python setup_email.py --show   # show settings + warn about duplicate keys
```

The wizard **tests the connection before saving**, so it never writes settings that don't
work, and it removes duplicate keys from `.env` (a repeated key silently overrides the
earlier one — a common cause of "my settings are being ignored").

**Free options that send from your own address, no domain needed:**

| Provider | Free tier | Notes |
|---|---|---|
| **Brevo** | 300/day forever | Recommended. Verify your Gmail as sender, done in 5 min. |
| Mailjet | 6,000/month | Same idea, slightly lower daily cap. |
| Gmail | ~500/day | Requires 2-Step Verification + App Password. Not suited to bulk. |
| Zoho Mail | free tier | Good if you later add your own domain. |

**Gmail note:** App Passwords only appear after 2-Step Verification is fully enabled. If the
App Passwords page says "not available for your account", 2SV isn't on. Google allows no way
around this — which is why Brevo (sending *from* your Gmail address) is the easier free path.

With email off, everything still works: messages print to the backend terminal, and the
password-reset link appears there in a marked banner.

## Chat & safety

Job seekers and recruiters can message each other in real time:
- Recruiters start a chat from **Applications** or **Resume search** (Message button).
- Job seekers start a chat from **Recruiter views** (companies that viewed them).
- Either side can **block** the other; a blocked sender is refused with a clear message.
- Unread counts drive the live badge in the sidebar/header (polled every few seconds).

Endpoints live in `backend/app/routers/chat.py`; the shared UI is `frontend/src/components/Chat.jsx`.
This is polling-based for simplicity and reliability — swap to WebSockets later if you want instant push.

## Live updates

Dashboard stats, applied-job statuses, recruiter-view lists, the applications inbox and the message
badges all refresh on a short interval, so "resume seen", "job posted" and new messages appear without
a manual reload.

---

## Project structure

```
hire/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app + routers + CORS
│   │   ├── config.py          settings (DATABASE_URL, JWT, email)
│   │   ├── database.py        SQLAlchemy engine/session
│   │   ├── models.py          all tables (User, Institute, Enterprise, JobSeeker, Job,
│   │   │                       Application, ProfileView, Banner)
│   │   ├── schemas.py         Pydantic request/response models
│   │   ├── auth.py            bcrypt hashing, JWT, role guards
│   │   ├── email_utils.py     email sending (console fallback)
│   │   ├── resume_service.py  Excel → resume + credentials (emphasized flow)
│   │   └── routers/           auth, admin, enterprise, institute, jobseeker, public
│   ├── seed.py                demo data
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.jsx            routes + role guards
        ├── lib/api.js         fetch wrapper with JWT
        ├── context/AuthContext.jsx
        ├── components/ui.jsx  Toast, ProtectedRoute, DashboardLayout, StatusBadge
        └── pages/
            ├── Home.jsx, Login.jsx, Misc.jsx
            ├── jobseeker/     JobSeeker.jsx (dashboard) + ResumeView.jsx (3 templates)
            ├── enterprise/    Enterprise.jsx
            ├── institute/     Institute.jsx (incl. Data upload)
            └── admin/         Admin.jsx
```

---

## How to extend (where to pick up)

- **Logo/photo uploads** → add a `POST /upload` that stores files in Supabase Storage; save the
  returned URL on `logo_url` / `profile_picture_url`.
- **Reports (SQL query form)** → the admin/enterprise "Reports" user story. Add a safe,
  parameterized query endpoint; the summary endpoint (`/api/admin/reports/summary`) is a start.
- **Job alerts / new-job counter** → the `dashboard` endpoints return `new_jobs`; wire a badge and
  a scheduled mailer.
- **GST/PAN verification** → fields exist on `Enterprise`; add a verification step at registration.
- **Resume PDF export** → currently uses browser print-to-PDF of the selected template; swap for a
  server-side PDF (e.g. WeasyPrint) if you need pixel-perfect files with attachments in emails.
- **Mobile app** → the FastAPI backend is shared. Build the React Native + Expo client against the
  same endpoints; credentials already work across web and mobile by design.

## Notes

- Colors are intentionally plain/neutral for now (per the brief) — styling lives in
  `frontend/src/index.css` and Tailwind classes, easy to rebrand with your blue/green palette.
- JSON columns (skills, education, experience) keep the schema portable across SQLite and Postgres.
  On Supabase you can later push resume search into JSONB queries for performance at scale.
