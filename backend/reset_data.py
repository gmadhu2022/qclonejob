"""Wipe the platform's DATA while keeping institute and recruiter logins.

WHAT SURVIVES
-------------
  * users          — institute, enterprise and admin rows, untouched. The
                     password_hash is never rewritten, so every one of those
                     accounts logs in afterwards with exactly the same User ID
                     and password as before.
  * institutes     — kept, because deleting the row while keeping the login
  * enterprises      gives an account that signs in and then 404s on its own
                     dashboard. The profile text stays; only their DATA goes.

WHAT IS ERASED
--------------
  Job seekers and their logins, jobs, applications, saved jobs, messages,
  blocks, profile views, upload batches, institute courses / locations /
  download logs, banners and their events, notifications, OTP codes, email
  logs, password-reset tokens, media assets and subscriptions.

WHY A SCRIPT AND NOT A FEW DELETE STATEMENTS
--------------------------------------------
Order matters: a child row deleted after its parent leaves a foreign-key error
on Postgres (SQLite is laxer, which is exactly how this kind of thing passes
locally and fails in production). The order below is deliberate — leaves
first, parents last.

SAFETY
------
Dry run by default. It prints what it WOULD delete and changes nothing.
Deleting requires BOTH --yes and typing the confirmation phrase, because this
is irreversible and there is no undo.

    python reset_data.py                  # dry run, shows the plan
    python reset_data.py --yes            # asks for the phrase, then deletes

TAKE A BACKUP FIRST. On Postgres:  pg_dump "$DATABASE_URL" > backup.sql
"""
from __future__ import annotations

import sys

from app import models
from app.database import SessionLocal

CONFIRM_PHRASE = "ERASE DATA"

# Leaves first, parents last. Each entry: (label, model, optional filter fn).
DELETE_ORDER = [
    ("Banner events",            models.BannerEvent,       None),
    ("Banners / ads",            models.Banner,            None),
    ("Applications",             models.Application,       None),
    ("Saved jobs",               models.SavedJob,          None),
    ("Jobs",                     models.Job,               None),
    ("Profile views",            models.ProfileView,       None),
    ("Messages",                 models.Message,           None),
    ("Blocks",                   models.Block,             None),
    ("Notifications",            models.Notification,      None),
    ("Upload batches",           models.UploadBatch,       None),
    ("Institute course rows",    models.InstituteCourse,   None),
    ("Institute locations",      models.InstituteLocation, None),
    ("Institute download logs",  models.InstituteDownloadLog, None),
    ("Job seekers",              models.JobSeeker,         None),
    ("Subscriptions",            models.Subscription,      None),
    ("Media assets",             models.MediaAsset,        None),
    ("OTP codes",                models.OtpCode,           None),
    ("Email logs",               models.EmailLog,          None),
    ("Password reset tokens",    models.PasswordResetToken, None),
]

KEEP_ROLES = {models.ROLE_INSTITUTE, models.ROLE_ENTERPRISE,
              models.ROLE_ADMIN, models.ROLE_MANAGER}


def plan(db):
    """What would be removed, counted but not touched."""
    rows = []
    for label, model, _ in DELETE_ORDER:
        try:
            rows.append((label, db.query(model).count()))
        except Exception as e:                       # table may not exist yet
            rows.append((label, f"skipped ({e.__class__.__name__})"))

    seekers = db.query(models.User).filter(models.User.role == models.ROLE_JOBSEEKER).count()
    rows.append(("Job seeker LOGINS", seekers))
    return rows


def survivors(db):
    keep = db.query(models.User).filter(models.User.role.in_(KEEP_ROLES)).all()
    return [(u.email, u.role) for u in keep]


def run(db, dry: bool) -> None:
    print("\n--- WILL BE ERASED " + "-" * 50)
    for label, count in plan(db):
        print(f"  {label:<28} {count}")

    keep = survivors(db)
    print("\n--- WILL BE KEPT (same User ID, same password) " + "-" * 21)
    for email, role in keep:
        print(f"  {email:<40} {role}")
    if not keep:
        print("  (none — there are no institute/recruiter/admin accounts to keep)")
    print("-" * 69)

    if dry:
        print("\nDRY RUN — nothing was changed.")
        print("Re-run with --yes to erase. Take a backup first.")
        return

    # Child rows first, so a foreign key is never left pointing at nothing.
    for label, model, _ in DELETE_ORDER:
        try:
            n = db.query(model).delete(synchronize_session=False)
            print(f"  deleted {n:>6}  {label}")
        except Exception as e:
            db.rollback()
            print(f"  SKIPPED        {label}  ({e.__class__.__name__}: {e})")

    # Job seeker logins go last: everything referencing them is gone by now.
    n = (db.query(models.User)
         .filter(models.User.role == models.ROLE_JOBSEEKER)
         .delete(synchronize_session=False))
    print(f"  deleted {n:>6}  Job seeker logins")

    db.commit()
    print("\nDone. Institute and recruiter logins are unchanged — same User ID, "
          "same password.")


def main() -> int:
    dry = "--yes" not in sys.argv
    db = SessionLocal()
    try:
        if not dry:
            print("\n*** THIS PERMANENTLY DELETES DATA AND CANNOT BE UNDONE. ***")
            print(f"Type exactly  {CONFIRM_PHRASE}  to proceed, or anything else to abort.")
            try:
                typed = input("> ").strip()
            except EOFError:
                typed = ""
            if typed != CONFIRM_PHRASE:
                print("Aborted. Nothing was changed.")
                return 1
        run(db, dry)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
