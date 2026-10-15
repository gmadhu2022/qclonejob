"""Erase every row in the database — keeping the tables — then create fresh logins.

    python wipe_and_seed.py                      # DRY RUN: shows the plan only
    python wipe_and_seed.py --yes                # wipe + seed with generated passwords
    python wipe_and_seed.py --yes \\
        --admin-pass 'Str0ng!admin' \\
        --institute-pass 'Str0ng!inst' \\
        --recruiter-pass 'Str0ng!rec'

WHY TRUNCATE AND NOT DELETE (Postgres)
--------------------------------------
TRUNCATE ... RESTART IDENTITY CASCADE does three things DELETE does not:
  * CASCADE walks the foreign keys itself, so there is no delete-order to get
    wrong. Hand-ordered DELETEs work on SQLite and raise FK violations on
    Postgres — the classic "passed locally, failed in production".
  * RESTART IDENTITY resets the id sequences, so the fresh database starts at
    id 1 instead of continuing from 4,312.
  * It is one statement in one transaction: it either all happens or none of
    it does. A half-wiped database is worse than a full one.

The tables themselves, their columns, indexes and constraints are untouched.

WHY THE LOGINS ARE MADE HERE AND NOT IN SQL
-------------------------------------------
Passwords are bcrypt-hashed by the application. Writing a user row with raw
SQL means inventing a hash, and anything you invent by hand will not verify at
login. This uses the app's own hasher, so the accounts genuinely work.

Each institute/recruiter login also gets its PROFILE row. A user row on its own
signs in and then 404s on its own dashboard, because every institute and
enterprise endpoint looks that row up first.

TAKE A BACKUP FIRST:  pg_dump "$DATABASE_URL" > backup.sql
"""
from __future__ import annotations

import argparse
import secrets
import string
import sys

from sqlalchemy import text

from app import models
from app.auth import hash_password
from app.config import settings
from app.database import SessionLocal, engine

CONFIRM = "ERASE EVERYTHING"

# Every application table. Order is irrelevant for the Postgres path (CASCADE
# resolves it) but is leaf-first for the SQLite fallback, which has no CASCADE.
TABLES = [
    "banner_events", "banners", "banner_slots",
    "applications", "saved_jobs", "jobs",
    "profile_views", "messages", "blocks", "notifications",
    "upload_batches",
    "institute_courses", "institute_locations", "institute_downloads",
    "jobseekers", "institutes", "enterprises",
    "subscriptions", "media_assets",
    "otp_codes", "email_logs", "password_reset_tokens",
    "users",
]


def is_postgres() -> bool:
    return engine.dialect.name.startswith("postgres")


def strong_password(n: int = 14) -> str:
    """Readable but not guessable. No l/1/O/0 — these get read off a screen
    and typed by someone else, and that is where transcription errors come
    from."""
    alphabet = ("ABCDEFGHJKLMNPQRSTUVWXYZ" "abcdefghijkmnopqrstuvwxyz" "23456789" "!@#$%*")
    return "".join(secrets.choice(alphabet) for _ in range(n))


def wipe(db) -> None:
    if is_postgres():
        # One statement, one transaction, FK order resolved by the database.
        stmt = "TRUNCATE TABLE " + ", ".join(f'public."{t}"' for t in TABLES) + \
               " RESTART IDENTITY CASCADE;"
        print("  " + stmt[:110] + ("…" if len(stmt) > 110 else ""))
        db.execute(text(stmt))
    else:
        # SQLite: no TRUNCATE, no CASCADE. Delete leaf-first, then reset the
        # AUTOINCREMENT counters so ids start from 1 as they would on Postgres.
        for t in TABLES:
            try:
                n = db.execute(text(f'DELETE FROM "{t}"')).rowcount
                print(f"  deleted {n:>6}  {t}")
            except Exception as e:
                print(f"  SKIPPED        {t}  ({e.__class__.__name__})")
        try:
            db.execute(text("DELETE FROM sqlite_sequence"))
        except Exception:
            pass          # table only exists once an AUTOINCREMENT column is used
    db.commit()


def seed(db, admin_pw: str, inst_pw: str, rec_pw: str, seeker_pw: str | None) -> list[tuple]:
    """Create one working account per portal."""
    made = []

    admin = models.User(email="admin@qclonejob.com", password_hash=hash_password(admin_pw),
                        role=models.ROLE_ADMIN, is_active=True, must_change_password=False)
    db.add(admin)
    made.append(("Admin", admin.email, admin_pw))

    inst_user = models.User(email="institute@qclonejob.com", password_hash=hash_password(inst_pw),
                            role=models.ROLE_INSTITUTE, is_active=True, must_change_password=False)
    db.add(inst_user)
    db.flush()
    inst = models.Institute(user_id=inst_user.id, name="Demo Institute",
                            email=inst_user.email, phone="9000000001",
                            authorised_person_name="Institute Admin",
                            city="Hyderabad", state="Telangana", pincode="500072",
                            country="INDIA", approval_status="approved",
                            registration_source="seed",
                            total_capacity=100, current_strength=0, present_strength=0,
                            courses=[])
    db.add(inst)
    db.flush()
    # The primary campus, so "Add new location" has something to be additional
    # to and the profile's location list is never empty.
    db.add(models.InstituteLocation(
        institute_id=inst.id, name="Main campus", is_primary=True,
        city=inst.city, state=inst.state, pincode=inst.pincode, country="INDIA",
        contact_person=inst.authorised_person_name, contact_email=inst.email,
        contact_phone=inst.phone))
    made.append(("Institute", inst_user.email, inst_pw))

    rec_user = models.User(email="recruiter@qclonejob.com", password_hash=hash_password(rec_pw),
                           role=models.ROLE_ENTERPRISE, is_active=True, must_change_password=False)
    db.add(rec_user)
    db.flush()
    db.add(models.Enterprise(user_id=rec_user.id, name="Demo Recruiter",
                             email=rec_user.email, phone="9000000002",
                             authorised_person_name="Hiring Manager",
                             city="Hyderabad", state="Telangana", pincode="500081",
                             country="INDIA", approval_status="approved",
                             registration_source="seed"))
    made.append(("Recruiter", rec_user.email, rec_pw))

    if seeker_pw:
        sk_user = models.User(email="jobseeker@qclonejob.com",
                              password_hash=hash_password(seeker_pw),
                              role=models.ROLE_JOBSEEKER, is_active=True,
                              must_change_password=False)
        db.add(sk_user)
        db.flush()
        db.add(models.JobSeeker(user_id=sk_user.id, first_name="Demo", last_name="Seeker",
                                email=sk_user.email, phone="9000000003",
                                city="Hyderabad", state="Telangana",
                                approval_status="approved", key_skills=[]))
        made.append(("Job seeker", sk_user.email, seeker_pw))

    db.commit()
    return made


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--yes", action="store_true", help="actually do it")
    ap.add_argument("--admin-pass"); ap.add_argument("--institute-pass")
    ap.add_argument("--recruiter-pass"); ap.add_argument("--seeker-pass")
    ap.add_argument("--no-seeker", action="store_true",
                    help="don't create the demo job seeker login")
    a = ap.parse_args()

    target = settings.DATABASE_URL
    masked = target.split("@")[-1] if "@" in target else target
    print(f"\nDatabase : {engine.dialect.name} → {masked}")
    print(f"Method   : {'TRUNCATE … RESTART IDENTITY CASCADE' if is_postgres() else 'DELETE per table'}")
    print(f"Tables   : {len(TABLES)} emptied, none dropped")

    if not a.yes:
        print("\nWould erase every row in:\n  " + ", ".join(TABLES))
        print("\nWould then create: admin@qclonejob.com, institute@qclonejob.com, "
              "recruiter@qclonejob.com"
              + ("" if a.no_seeker else ", jobseeker@qclonejob.com"))
        print("\nDRY RUN — nothing was changed. Re-run with --yes. Back up first.")
        return 0

    print("\n*** THIS DELETES EVERY ROW AND CANNOT BE UNDONE. ***")
    print(f"Type exactly  {CONFIRM}  to proceed.")
    try:
        if input("> ").strip() != CONFIRM:
            print("Aborted. Nothing was changed.")
            return 1
    except EOFError:
        print("Aborted (no confirmation given).")
        return 1

    db = SessionLocal()
    try:
        print("\nErasing…")
        wipe(db)
        print("\nCreating logins…")
        made = seed(db,
                    a.admin_pass or strong_password(),
                    a.institute_pass or strong_password(),
                    a.recruiter_pass or strong_password(),
                    None if a.no_seeker else (a.seeker_pass or strong_password()))
    finally:
        db.close()

    print("\n" + "=" * 68)
    print("  FRESH LOGINS — copy these now, the passwords are not stored anywhere")
    print("=" * 68)
    for label, email, pw in made:
        print(f"  {label:<11} {email:<28} {pw}")
    print("=" * 68)
    print("  User ID is the email address. Sign in at /login and pick the")
    print("  matching portal; the admin account works on any of the three.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
