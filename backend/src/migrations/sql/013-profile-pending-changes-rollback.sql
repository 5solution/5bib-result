-- =============================================================
-- Migration 013 Rollback
-- Drops the pending-changes columns + index added by 013.
-- =============================================================

DROP INDEX idx_pending_changes ON vol_registration;

ALTER TABLE vol_registration
  DROP COLUMN pending_changes_submitted_at,
  DROP COLUMN has_pending_changes,
  DROP COLUMN pending_changes;
