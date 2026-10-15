-- QCloneJob — erase ALL DATA, keep every table.
-- Paste into the Supabase SQL Editor (Database -> SQL Editor -> New query).
--
-- TAKE A BACKUP FIRST. There is no undo.
--   Supabase Dashboard -> Database -> Backups, or:
--   pg_dump "$DATABASE_URL" > backup.sql
--
-- One statement, one transaction:
--   CASCADE           the database resolves foreign-key order itself, so
--                     there is no delete sequence to get wrong.
--   RESTART IDENTITY  id sequences go back to 1 instead of continuing from
--                     wherever the old data left off.
-- Tables, columns, indexes and constraints are untouched - only rows go.

TRUNCATE TABLE
  public."banner_events",
  public."banners",
  public."banner_slots",
  public."applications",
  public."saved_jobs",
  public."jobs",
  public."profile_views",
  public."messages",
  public."blocks",
  public."notifications",
  public."upload_batches",
  public."institute_courses",
  public."institute_locations",
  public."institute_downloads",
  public."jobseekers",
  public."institutes",
  public."enterprises",
  public."subscriptions",
  public."media_assets",
  public."otp_codes",
  public."email_logs",
  public."password_reset_tokens",
  public."users"
RESTART IDENTITY CASCADE;

-- Verify: every count below should be 0.
SELECT 'users' AS tbl, COUNT(*) FROM public."users"
UNION ALL SELECT 'jobs',         COUNT(*) FROM public."jobs"
UNION ALL SELECT 'jobseekers',   COUNT(*) FROM public."jobseekers"
UNION ALL SELECT 'institutes',   COUNT(*) FROM public."institutes"
UNION ALL SELECT 'enterprises',  COUNT(*) FROM public."enterprises"
UNION ALL SELECT 'applications', COUNT(*) FROM public."applications";
