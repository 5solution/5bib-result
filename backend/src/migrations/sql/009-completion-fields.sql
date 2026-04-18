-- =============================================================
-- Migration 009: v1.4 Completion + anti-fraud fields
-- Adds rejection_reason, completion_confirmed_*, checkout_at,
-- suspicious_checkin, and a snapshot of compensation at completion
-- time (so later edits to vol_role don't retroactively change pay).
-- =============================================================

ALTER TABLE vol_registration
  ADD COLUMN rejection_reason            TEXT         NULL
    COMMENT 'Reason admin rejected registration (required on reject)',
  ADD COLUMN completion_confirmed_at     DATETIME     NULL
    COMMENT 'When completion was confirmed (by leader or admin)',
  ADD COLUMN completion_confirmed_by     ENUM('leader','admin') NULL,
  ADD COLUMN completion_confirmed_id     INT          NULL
    COMMENT 'vol_registration.id of the leader who confirmed (if by=leader)',
  ADD COLUMN checkout_at                 DATETIME     NULL
    COMMENT 'Optional check-out timestamp',
  ADD COLUMN suspicious_checkin          BOOLEAN      NOT NULL DEFAULT FALSE
    COMMENT 'TRUE if completion_confirmed_at - checked_in_at < min_work_hours',
  -- Snapshot at completion (Danny Q4: Y — lock compensation when confirmed)
  ADD COLUMN snapshot_daily_rate         DECIMAL(12,0) NULL
    COMMENT 'Copied from vol_role.daily_rate at completion time',
  ADD COLUMN snapshot_working_days       INT          NULL
    COMMENT 'Copied from vol_role.working_days at completion time',
  ADD CONSTRAINT fk_completion_by_leader
    FOREIGN KEY (completion_confirmed_id)
    REFERENCES vol_registration(id)
    ON DELETE SET NULL;

-- Index for admin "review suspicious" query
CREATE INDEX idx_suspicious ON vol_registration (suspicious_checkin, event_id);

-- Done — verify:
-- DESCRIBE vol_registration;
