# Moving QCloneJob from SQLite to Supabase (Postgres)

The app uses plain SQLAlchemy, so switching databases is **one line in `.env`** — no code
changes. Follow these steps in order.

---

## 1. Create the project

1. Sign up at <https://supabase.com> (free tier is fine).
2. **New project** → give it a name, choose a region close to you (Mumbai/Singapore for India),
   and set a **database password**.
3. **Copy that password now** and keep it safe — Supabase only shows it once. If you lose it:
   Project Settings → Database → *Reset database password*.

Wait ~2 minutes for the project to finish provisioning.

---

## 2. Get the connection string

In your project, click **Connect** (top bar) → **Connection string** → **URI**.

You'll see several options. **Use the Session pooler string.** It looks like:

```
postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
```

> **Why the pooler and not the direct connection?**
> The direct host (`db.<ref>.supabase.co`) is **IPv6-only** on the free tier. Most home and
> office networks in India are IPv4, so the direct string fails with
> *"could not translate host name"*. The pooler works on IPv4 and is the safer default.

---

## 3. Adapt it for this app

Two edits to the string you copied:

**a) Change the scheme** so SQLAlchemy uses psycopg2:

```
postgresql://...        →  postgresql+psycopg2://...
```

**b) Replace `[YOUR-PASSWORD]`** with your real password — and **percent-encode special
characters**, or the URL will parse wrongly:

| Character | Replace with |
|---|---|
| `@` | `%40` |
| `#` | `%23` |
| `/` | `%2F` |
| `:` | `%3A` |
| `?` | `%3F` |
| `%` | `%25` |

Example: password `p@ss#1` becomes `p%40ss%231`.

Final result in `backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://postgres.abcdefghijklmnopqrst:MyRealP%40ssword@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

> Everything in that line must come from **your** dashboard. `abcdefghijklmnopqrst` above is an
> illustration — using it verbatim produces `tenant/user not found`. The app now refuses to start
> if it detects leftover example text, rather than failing with a long stack trace.

```
```

Make sure there is **only one** `DATABASE_URL` line — the last one wins, so a leftover
SQLite line further down will silently override it.

---

## 4. Install the driver and verify

```powershell
cd backend
pip install -r requirements.txt      # includes psycopg2-binary
python check_db.py
```

`check_db.py` prints exactly what it will connect to and either confirms success or names
the specific problem and its fix. Do not move on until you see **CONNECTED ✓**.

---

## 5. Create the schema and seed

```powershell
python seed.py
uvicorn app.main:app --reload
```

`seed.py` creates all tables, adds any missing columns, and inserts the demo accounts plus
30 sample jobs. You can safely re-run it — it won't duplicate data.

Check it worked: in Supabase, **Table Editor** should now list `users`, `jobs`, `jobseekers`,
`applications`, and the rest.

---

## Troubleshooting

**`no such column: jobs.sector`** (or any missing column)
Your database predates a code update. `python seed.py` now runs the migration automatically —
just re-run it. This is also what fixes it on Supabase.

**`tenant/user postgres.xxxx not found`**
The part after `postgres.` isn't your project ref — this is what you get if you copy the
example verbatim. Your ref is the ~20-character ID in your dashboard URL:

```
https://supabase.com/dashboard/project/abcdefghijklmnopqrst
                                       ^^^^^^^^^^^^^^^^^^^^ this is your ref
```

So the user becomes `postgres.abcdefghijklmnopqrst`. Easiest fix: copy the whole URI again from
**Connect → Connection string → URI**, then change only two things — `postgresql://` to
`postgresql+psycopg2://`, and `[YOUR-PASSWORD]` to your password.

**`could not translate host name`**
You're on the direct (IPv6) host. Use the **Session pooler** string from step 2.

**`password authentication failed`**
Wrong password, or an unencoded special character. Reset it in Supabase and percent-encode it.

**`connection timed out`**
Your network blocks the port. Try the pooler string, mobile hotspot, or a different network.

**Everything connects but the app shows no data**
You connected to a fresh database — run `python seed.py`.

---

## Notes for production

- **Free tier limits:** 500 MB database, 1 GB file storage, and the project **pauses after
  7 days of inactivity** (one click to restore). Fine for development; move to Pro ($25/mo)
  before real users depend on uptime.
- **File uploads** still write to `backend/uploads` on local disk. That directory is wiped on
  every deploy on Render. Before launch, move `_store()` in `app/routers/uploads.py` to
  Supabase Storage.
- **Migrations:** `sync_schema()` only *adds* columns. It never renames, drops, or backfills.
  For those, adopt Alembic before you have production data worth protecting.
- **Keep `.env` out of git.** It contains your database password. It's already in `.gitignore`.
- **Going back to SQLite** for local work is just a matter of commenting the Supabase line and
  restoring `DATABASE_URL=sqlite:///./hire.db`.
