"""Database connection checker.  Run:  python check_db.py

Tells you exactly what your backend will connect to, whether it works, and what
to fix if it doesn't — before you waste time debugging the app itself.
"""
import sys
import re
from urllib.parse import urlparse, unquote

from app.config import settings


def redact(url: str) -> str:
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:****@", url)


def main() -> int:
    url = settings.DATABASE_URL
    print("=" * 68)
    print("QCloneJob — database check")
    print("=" * 68)
    print(f"DATABASE_URL : {redact(url)}")

    if url.startswith("sqlite"):
        print("Driver       : SQLite (local file)")
        print("\nThis is the local dev database. To use Supabase, set DATABASE_URL")
        print("in backend/.env to your Supabase connection string.")
    else:
        p = urlparse(url)
        print(f"Driver       : {p.scheme}")
        print(f"Host         : {p.hostname}")
        print(f"Port         : {p.port}")
        print(f"Database     : {(p.path or '').lstrip('/')}")
        print(f"User         : {p.username}")

        # --- Placeholder detection: the #1 cause of "tenant not found" ---
        PLACEHOLDERS = [
            "abcdefghijklm", "yourref", "your-ref", "yourpassword", "your-password",
            "youpassword", "[your-password]", "yourencodedpassword", "projectref",
            "xxxx", "example", "changeme",
        ]
        blob = f"{p.username or ''} {p.password or ''} {p.hostname or ''}".lower()
        hits = [ph for ph in PLACEHOLDERS if ph in blob]
        if hits:
            print("\n" + "!" * 68)
            print("STOP: your connection string still contains EXAMPLE text.")
            print(f"Found: {', '.join(hits)}")
            print("")
            print("You copied the sample from the docs instead of your own string.")
            print("Get yours from: Supabase > your project > Connect >")
            print("                Connection string > URI > Session pooler")
            print("Your username looks like  postgres.<your-project-ref>  where the ref")
            print("is the ~20-character ID in your project URL, not 'abcdefghijklm'.")
            print("!" * 68)
            return 1

        # Common Supabase mistakes, checked before we even connect.
        if p.password and p.password != unquote(p.password):
            print("\n[!] Your password appears to be URL-encoded already — good.")
        if p.password and re.search(r"[@/:?#\[\]]", unquote(p.password or "")):
            print("\n[!] WARNING: your password contains a special character (@ / : ? # [ ]).")
            print("    It must be percent-encoded in the URL, e.g. @ becomes %40.")
        # Pooler connections require the username to be  postgres.<project-ref>
        if p.hostname and "pooler.supabase.com" in (p.hostname or ""):
            if not (p.username or "").startswith("postgres."):
                print("\n[!] WARNING: pooler connections need the user to be 'postgres.<project-ref>',")
                print(f"    but yours is '{p.username}'. Copy the URI from Supabase > Connect again.")
            else:
                ref = (p.username or "").split(".", 1)[1]
                if ref in ("abcdefghijklm", "YOURREF", "yourref", ""):
                    print(f"\n[!] '{ref}' is the EXAMPLE placeholder, not your project ref.")
                    print("    Replace it with your real ref (the random string in your")
                    print("    Supabase dashboard URL: /dashboard/project/<THIS-PART>).")
                elif len(ref) < 15:
                    print(f"\n[!] Project ref '{ref}' looks short — Supabase refs are ~20 characters.")

        if p.hostname and "supabase" in p.hostname and p.port == 5432 and "pooler" not in p.hostname:
            print("\n[i] You are using the DIRECT connection host.")
            print("    If this fails with a network/DNS error, use the POOLER string from")
            print("    Supabase instead (Connect > Session pooler) — it works on IPv4.")

    print("-" * 68)
    print("Connecting…")
    try:
        from sqlalchemy import text
        from app.database import engine
        with engine.connect() as conn:
            if url.startswith("sqlite"):
                ver = "SQLite " + conn.execute(text("select sqlite_version()")).scalar()
            else:
                ver = conn.execute(text("select version()")).scalar().split(",")[0]
            print(f"CONNECTED ✓  {ver}")

            tables = conn.execute(text(
                "select name from sqlite_master where type='table' order by name"
                if url.startswith("sqlite") else
                "select table_name from information_schema.tables "
                "where table_schema='public' order by table_name"
            )).fetchall()
            names = [t[0] for t in tables if not t[0].startswith("sqlite_")]
            print(f"Tables       : {len(names)}" + (f" ({', '.join(names[:8])}…)" if names else " — run: python seed.py"))
        return 0
    except Exception as e:
        msg = str(e)
        print(f"FAILED ✗\n\n{msg[:400]}\n")
        print("-" * 68)
        low = msg.lower()
        if "tenant or user not found" in low or "enotfound" in low or "tenant/user" in low:
            print("Cause: Supabase doesn't recognise that username.")
            print("       The connection reached Supabase fine — only the user is wrong.")
            print("")
            print("Fix  : your username must be  postgres.<your-project-ref>")
            print("       Find the ref in your Supabase project URL:")
            print("         https://supabase.com/dashboard/project/THIS-PART-HERE")
            print("       Or just re-copy the whole URI from Connect > Session pooler")
            print("       and only replace [YOUR-PASSWORD].")
        elif "could not translate host name" in low or "name or service not known" in low or "getaddrinfo" in low:
            print("Cause: the host name could not be resolved.")
            print("Fix  : copy the connection string again from Supabase > Connect.")
            print("       Prefer the 'Session pooler' string — the direct host is IPv6-only")
            print("       on many networks, which breaks on home/office IPv4 connections.")
        elif "password authentication failed" in low:
            print("Cause: wrong password.")
            print("Fix  : Supabase > Project Settings > Database > Reset database password,")
            print("       then percent-encode any special characters (@ -> %40).")
        elif "timeout" in low or "timed out" in low:
            print("Cause: the connection timed out.")
            print("Fix  : your network may block port 5432/6543. Try the pooler string,")
            print("       or a different network.")
        elif "no module named" in low and "psycopg2" in low:
            print("Cause: the Postgres driver isn't installed.")
            print("Fix  : pip install psycopg2-binary")
        elif "does not exist" in low:
            print("Cause: that database name doesn't exist. For Supabase it should be 'postgres'.")
        else:
            print("Check the DATABASE_URL format:")
            print("  postgresql+psycopg2://USER:PASSWORD@HOST:PORT/postgres")
        return 1


if __name__ == "__main__":
    sys.exit(main())
