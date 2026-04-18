-- =============================================================
-- v1.3 Addendum — Role Import (Feature 1)
-- Add UNIQUE constraint on (event_id, role_name) so the bulk-import
-- flow can detect duplicates deterministically at the DB level and
-- so two admins can't both create a role with the same name for
-- the same event in a race condition.
--
-- NOTE: role_name is varchar(100) with default collation
-- utf8mb4_0900_ai_ci (accent-insensitive on MariaDB/MySQL), which
-- means "Crew - Y Tế" and "Crew - Y Te" are considered the same
-- — this matches the case-insensitive match the import preview
-- performs in code.
-- =============================================================

ALTER TABLE vol_role
  ADD UNIQUE KEY uq_role_name_event (event_id, role_name);
