-- =============================================================
-- Migration 011: v1.4 — vol_event.min_work_hours_for_completion
-- Minimum hours between check-in and completion-confirm before
-- we flag the record as suspicious (anti-fraud).
-- Default 2h — admin can override per event.
-- =============================================================

ALTER TABLE vol_event
  ADD COLUMN min_work_hours_for_completion DECIMAL(4,1) NOT NULL DEFAULT 2.0
    COMMENT 'Hours required between check-in and completion to avoid suspicious_checkin flag';

-- Done — verify:
-- DESCRIBE vol_event;
