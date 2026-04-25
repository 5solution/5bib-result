-- =============================================================
-- Rollback for migration 032.
-- Drops the force-paid audit columns + index.
-- =============================================================

DROP INDEX idx_reg_payment_forced_at ON vol_registration;

ALTER TABLE vol_registration
  DROP COLUMN payment_forced_by,
  DROP COLUMN payment_forced_at,
  DROP COLUMN payment_forced_reason;
