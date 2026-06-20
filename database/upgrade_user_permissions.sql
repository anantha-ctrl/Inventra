-- ============================================================================
--  Inventra — Per-user permissions
--  Each user can have their own module access (JSON) that overrides the
--  role defaults. NULL = inherit the role's permissions.
--  Run in MySQL Workbench on the `stockhive` database. Safe to re-run.
-- ============================================================================
USE stockhive;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions TEXT NULL AFTER status;
