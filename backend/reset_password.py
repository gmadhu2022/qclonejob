"""Password admin tool — use when you can't get into the app.

  python reset_password.py --list
  python reset_password.py admin@hire.com
  python reset_password.py admin@hire.com --password MyNewPass123
  python reset_password.py admin@hire.com --link          (print a reset link instead)

Passwords are stored as bcrypt hashes and CANNOT be decoded — that's what stops
anyone who steals the database from reading them. So there is no "recover"; you
set a new password instead. This tool does that directly against the database.
"""
import argparse
import secrets
import string
import sys
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.config import settings
from app import models
from app.auth import hash_password


def generate(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def list_users(db) -> None:
    users = db.query(models.User).order_by(models.User.role, models.User.email).all()
    if not users:
        print("No users found. Run:  python seed.py")
        return
    print(f"{'EMAIL':<38} {'ROLE':<12} {'ACTIVE':<7} MUST CHANGE PW")
    print("-" * 78)
    for u in users:
        print(f"{u.email:<38} {u.role:<12} {str(bool(u.is_active)):<7} {bool(u.must_change_password)}")
    print(f"\n{len(users)} user(s).")


def main() -> int:
    ap = argparse.ArgumentParser(description="Reset a Hire user's password.")
    ap.add_argument("email", nargs="?", help="user's email (their User ID)")
    ap.add_argument("--password", help="set this exact password (otherwise one is generated)")
    ap.add_argument("--list", action="store_true", help="list all users and exit")
    ap.add_argument("--link", action="store_true",
                    help="don't change the password; print a reset link the user can open")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        if args.list or not args.email:
            list_users(db)
            if not args.email:
                print("\nUsage:  python reset_password.py <email> [--password NEW] [--link]")
            return 0

        user = db.query(models.User).filter(models.User.email == args.email).first()
        if not user:
            print(f"No user with email '{args.email}'.\n")
            list_users(db)
            return 1

        if args.link:
            token = secrets.token_urlsafe(32)
            db.add(models.PasswordResetToken(
                user_id=user.id, token=token,
                expires_at=datetime.utcnow() + timedelta(hours=2),
            ))
            db.commit()
            print("\nReset link (valid 2 hours) — open it in your browser:\n")
            print(f"  {settings.FRONTEND_URL}/reset-password?token={token}\n")
            return 0

        new_password = args.password or generate()
        if len(new_password) < 6:
            print("Password must be at least 6 characters.")
            return 1

        user.password_hash = hash_password(new_password)
        user.must_change_password = False
        user.is_active = True
        db.commit()

        print("\n" + "=" * 60)
        print("  PASSWORD UPDATED")
        print("=" * 60)
        print(f"  User ID  : {user.email}")
        print(f"  Password : {new_password}")
        print(f"  Role     : {user.role}")
        print("=" * 60)
        print("  Log in at:", settings.FRONTEND_URL)
        print()
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
