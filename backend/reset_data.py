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
    # Slot rows are rotation bookkeeping, recreated on demand the next time a
    # banner is served. Leaving them behind would keep pointing the rotation
    # at banners that no longer exist.
    ("Banner slots",             models.BannerSlot,        None),
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

# Only these addresses survive. Everything else goes, including other
# institute and recruiter accounts.
#
# An ALLOW-LIST, not a block-list: with a block-list, an account registered
# tomorrow survives a wipe nobody meant it to survive. Named explicitly, the
# script can only ever keep what is written here.
#
# Override at the command line:
#   python reset_data.py --yes --keep a@x.com --keep b@x.com
# Pass --keep-all-staff to fall back to the old behaviour (every admin,
# institute and recruiter account stays).
KEEP_EMAILS = {
    "admin@qclonejob.com",
    "institute@qclonejob.com",
    "recruiter@qclonejob.com",
}


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


def _kept(u, keep_emails, keep_all_staff: bool) -> bool:
    if u.role not in KEEP_ROLES:
        return False
    if keep_all_staff:
        return True
    return (u.email or "").strip().lower() in keep_emails


def survivors(db, keep_emails, keep_all_staff=False):
    rows = db.query(models.User).filter(models.User.role.in_(KEEP_ROLES)).all()
    keep = [u for u in rows if _kept(u, keep_emails, keep_all_staff)]
    drop = [u for u in rows if not _kept(u, keep_emails, keep_all_staff)]
    return ([(u.email, u.role) for u in keep], [(u.email, u.role) for u in drop])


def run(db, dry: bool, keep_emails=None, keep_all_staff: bool = False) -> None:
    keep_emails = {e.strip().lower() for e in (keep_emails or KEEP_EMAILS)}

    print("\n--- WILL BE ERASED " + "-" * 50)
    for label, count in plan(db):
        print(f"  {label:<28} {count}")

    keep, drop = survivors(db, keep_emails, keep_all_staff)
    if drop:
        print(f"  {'Other staff accounts':<28} {len(drop)}")
        for email, role in drop:
            print(f"      {email:<38} {role}")

    print("\n--- WILL BE KEPT (same User ID, same password) " + "-" * 21)
    for email, role in keep:
        print(f"  {email:<40} {role}")
    if not keep:
        print("  (none — NOTHING would survive. Check the --keep addresses.)")
    print("-" * 69)

    # A typo in --keep would wipe every login on the platform, so stop rather
    # than carry out an instruction that was almost certainly not meant.
    missing = keep_emails - {e.lower() for e, _ in keep}
    if missing and not keep_all_staff:
        print(f"\n  NOTE: no account found for: {', '.join(sorted(missing))}")
    if not keep and not dry:
        print("\nAborted: that would delete every login, leaving nobody able to "
              "sign in. Check the addresses and try again.")
        return

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

    # Staff accounts that are not on the keep list, and their profile rows.
    #
    # The PROFILE goes before the USER: institutes.user_id and
    # enterprises.user_id point at users, so removing the user first leaves a
    # dangling reference and Postgres refuses it. (SQLite would allow it,
    # which is how this kind of thing passes locally and fails in production.)
    drop_ids = [u.id for u in db.query(models.User)
                .filter(models.User.role.in_(KEEP_ROLES)).all()
                if not _kept(u, keep_emails, keep_all_staff)]
    if drop_ids:
        for label, model in (("Institute profiles", models.Institute),
                             ("Recruiter profiles", models.Enterprise)):
            n = (db.query(model).filter(model.user_id.in_(drop_ids))
                 .delete(synchronize_session=False))
            if n:
                print(f"  deleted {n:>6}  {label} (not on the keep list)")
        n = (db.query(models.User).filter(models.User.id.in_(drop_ids))
             .delete(synchronize_session=False))
        print(f"  deleted {n:>6}  staff logins not on the keep list")

    db.commit()
    print("\nDone. The kept logins are unchanged — same User ID, same password.")


def main() -> int:
    argv = sys.argv[1:]
    dry = "--yes" not in argv
    keep_all_staff = "--keep-all-staff" in argv
    cli_keep = {argv[i + 1].strip().lower()
                for i, a in enumerate(argv) if a == "--keep" and i + 1 < len(argv)}
    keep_emails = cli_keep or KEEP_EMAILS
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
        run(db, dry, keep_emails, keep_all_staff)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
