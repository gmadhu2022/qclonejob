"""Lightweight schema reconciliation.

`Base.metadata.create_all` creates *missing tables* but never adds *missing columns*
to tables that already exist. When you upgrade an existing database (your local
hire.db, or Supabase), any newly-added column would be missing and queries would fail.

This module compares the SQLAlchemy models against the live database and issues
`ALTER TABLE ... ADD COLUMN` for anything absent. It is deliberately additive only —
it never drops or alters existing columns, so it is safe to run on every startup.

For complex production changes (renames, type changes, data backfills) use Alembic.
"""
import logging
from sqlalchemy import inspect, text

from .database import Base, engine

logger = logging.getLogger("hire.migrate")

# SQLAlchemy type -> DDL type, kept simple and portable.
def _ddl_type(col, dialect: str) -> str:
    t = col.type.__class__.__name__.upper()
    if t in ("INTEGER", "SMALLINT", "BIGINT"):
        return "INTEGER"
    if t in ("BOOLEAN",):
        return "BOOLEAN" if dialect != "sqlite" else "INTEGER"
    if t in ("DATETIME", "TIMESTAMP"):
        return "TIMESTAMP" if dialect != "sqlite" else "DATETIME"
    if t in ("FLOAT", "NUMERIC", "DECIMAL"):
        return "FLOAT"
    if t in ("JSON",):
        return "JSONB" if dialect == "postgresql" else "JSON"
    if t in ("TEXT",):
        return "TEXT"
    return "VARCHAR"


def _rename_profile_types() -> None:
    """Existing rows may still say 'labour'; the app now uses 'worker'."""
    from sqlalchemy import text
    from .database import engine
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "UPDATE jobseekers SET profile_type='worker' WHERE profile_type='labour'"))
    except Exception:
        pass          # table may not exist yet on a first run


def sync_schema() -> None:
    """Add any model columns that are missing from existing tables."""
    inspector = inspect(engine)
    dialect = engine.dialect.name
    existing_tables = set(inspector.get_table_names())
    added = []

    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing_tables:
            continue  # create_all handles brand-new tables
        db_cols = {c["name"] for c in inspector.get_columns(table_name)}
        for col in table.columns:
            if col.name in db_cols:
                continue
            ddl = f'ALTER TABLE {table_name} ADD COLUMN {col.name} {_ddl_type(col, dialect)}'
            try:
                with engine.begin() as conn:
                    conn.execute(text(ddl))
                added.append(f"{table_name}.{col.name}")
            except Exception as e:  # never block startup on a migration hiccup
                logger.warning("Could not add column %s.%s: %s", table_name, col.name, e)

    if added:
        logger.info("Schema updated, added columns: %s", ", ".join(added))
        print(f"[migrate] Added missing columns: {', '.join(added)}")
    _sync_indexes(inspector, existing_tables)
    _relax_user_email_unique()
    _rename_profile_types()


def _sync_indexes(inspector, existing_tables) -> None:
    """Create any model index that isn't on the table yet.

    create_all() only builds indexes for tables it creates, so marking a column
    index=True does nothing to a database that already exists. Without this,
    every login would keep doing a full scan of users.email on a table that has
    been live since day one.

    CREATE INDEX IF NOT EXISTS works on both SQLite and Postgres.
    """
    made = []
    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing_tables:
            continue
        try:
            have = {ix["name"] for ix in inspector.get_indexes(table_name)}
        except Exception:
            continue
        for ix in table.indexes:
            if ix.name in have:
                continue
            cols = ", ".join(c.name for c in ix.columns)
            unique = "UNIQUE " if ix.unique else ""
            ddl = f'CREATE {unique}INDEX IF NOT EXISTS {ix.name} ON {table_name} ({cols})'
            try:
                with engine.begin() as conn:
                    conn.execute(text(ddl))
                made.append(ix.name)
            except Exception as e:
                # An index is an optimisation; never block startup for one.
                logger.warning("Could not create index %s: %s", ix.name, e)
    if made:
        logger.info("Created %d index(es): %s", len(made), ", ".join(made))
        print(f"[migrate] Created {len(made)} index(es)")

def _relax_user_email_unique() -> None:
    """Replace the global unique index on users.email with (email, role).

    WHY THIS NEEDS ITS OWN STEP
    ---------------------------
    sync_schema() only ADDS tables, columns and indexes. Dropping a constraint
    is destructive, so it is deliberately not something that happens as a side
    effect of a model edit — it gets an explicit, named migration that logs
    what it did.

    SAFETY
    ------
    The composite index is created BEFORE the old one is dropped, so there is
    never a moment where two job seeker accounts could be created on the same
    address. If the composite cannot be created because duplicates already
    exist, the old index is left in place and the problem is reported rather
    than silently removing protection.

    Idempotent: safe to run on every boot, and a no-op once applied.
    """
    from sqlalchemy import text
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if dialect.startswith("postgres"):
            # 1. Is there anything that would violate the new rule?
            dupes = conn.execute(text(
                "SELECT email, role, COUNT(*) c FROM users "
                "GROUP BY email, role HAVING COUNT(*) > 1 LIMIT 5")).fetchall()
            if dupes:
                print("[migrate] SKIPPED users.email relaxation — duplicate (email, role) "
                      f"rows exist: {[(d[0], d[1]) for d in dupes]}. "
                      "Resolve these first; the old unique index is left in place.")
                return

            # 2. New constraint first.
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_role "
                "ON users (email, role)"))

            # 3. Then drop whatever single-column unique it had. The name
            #    differs depending on whether SQLAlchemy created it as a
            #    constraint or an index, so both are handled.
            rows = conn.execute(text("""
                SELECT c.conname FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'users' AND c.contype = 'u'
                  AND array_length(c.conkey, 1) = 1
            """)).fetchall()
            for (name,) in rows:
                conn.execute(text(f'ALTER TABLE users DROP CONSTRAINT IF EXISTS "{name}"'))
                print(f"[migrate] dropped single-column unique constraint users.{name}")

            idx = conn.execute(text("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'users' AND indexdef LIKE '%UNIQUE%'
                  AND indexdef LIKE '%(email)%'
            """)).fetchall()
            for (name,) in idx:
                conn.execute(text(f'DROP INDEX IF EXISTS "{name}"'))
                print(f"[migrate] dropped unique index {name} on users.email")

        else:
            # SQLite cannot drop a column constraint; the table has to be
            # rebuilt. Done inside the surrounding transaction so a failure
            # leaves the original table untouched.
            cols = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            if not cols:
                return
            names = [c[1] for c in cols]
            sql = conn.execute(text(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")).scalar() or ""
            if "UNIQUE" not in sql.upper():
                return                      # already relaxed
            col_list = ", ".join(f'"{n}"' for n in names)
            defs = ", ".join(
                f'"{c[1]}" {c[2]}'
                + (" NOT NULL" if c[3] else "")
                + (" PRIMARY KEY" if c[5] else "")
                for c in cols)
            conn.execute(text(f"CREATE TABLE users_new ({defs})"))
            conn.execute(text(f"INSERT INTO users_new ({col_list}) SELECT {col_list} FROM users"))
            conn.execute(text("DROP TABLE users"))
            conn.execute(text("ALTER TABLE users_new RENAME TO users"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_role "
                              "ON users (email, role)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)"))
            print("[migrate] rebuilt users table: email is now unique per role")
