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
    _rename_profile_types()
