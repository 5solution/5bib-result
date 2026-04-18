-- =============================================================
-- Migration 013: v1.4.1 — TNV profile edit with admin re-approval
--
-- Adds three columns to vol_registration so that TNV (approved+)
-- can submit profile edits via PATCH /public/team-registration/:token/profile.
-- Admin must review & approve/reject before the changes go live.
--
-- pending_changes: the JSON patch submitted (keys = field names,
-- values = proposed new values). Cleared on approve or reject.
-- has_pending_changes: quick boolean flag for index/filter.
-- pending_changes_submitted_at: timestamp for display + SLA tracking.
-- =============================================================

ALTER TABLE vol_registration
  ADD COLUMN pending_changes JSON NULL
    COMMENT 'JSON patch submitted by TNV via /profile endpoint; awaiting admin approval',
  ADD COLUMN has_pending_changes BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN pending_changes_submitted_at DATETIME NULL;

CREATE INDEX idx_pending_changes ON vol_registration (has_pending_changes, event_id);

-- Done — verify:
-- SHOW COLUMNS FROM vol_registration LIKE '%pending%';
-- SHOW INDEX FROM vol_registration WHERE Key_name = 'idx_pending_changes';
