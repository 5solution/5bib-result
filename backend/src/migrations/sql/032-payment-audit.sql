-- =============================================================
-- Migration 032: Payment force-paid audit columns.
--
-- Adds 3 columns to vol_registration to record the exception path
-- where an admin marks payment_status='paid' WITHOUT a signed
-- acceptance (crew unreachable, legacy data, post-hoc fix, etc.).
--
-- TeamPaymentService.forcePaid() writes all 3 atomically; the
-- standard markPaid() gate (acceptance_status='signed') leaves
-- them NULL.
--
-- The Logger also emits a structured audit line
-- (PAYMENT_FORCE_PAID admin=... reg=... reason=...) so the action
-- is captured in app logs in addition to the DB row.
--
-- Rollback: 032-payment-audit-rollback.sql
-- =============================================================

ALTER TABLE vol_registration
  ADD COLUMN payment_forced_reason TEXT NULL
    COMMENT 'Admin-supplied justification when payment was marked paid without a signed acceptance.'
    AFTER payment_status,
  ADD COLUMN payment_forced_at DATETIME NULL
    COMMENT 'Timestamp when force-paid was invoked. NULL for standard gated payments.'
    AFTER payment_forced_reason,
  ADD COLUMN payment_forced_by VARCHAR(100) NULL
    COMMENT 'Admin identity (JWT sub or email) who invoked force-paid.'
    AFTER payment_forced_at;

-- Index for admin audit queries: "show me all force-paid rows".
CREATE INDEX idx_reg_payment_forced_at
  ON vol_registration (payment_forced_at);
