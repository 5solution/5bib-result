-- =============================================================
-- Migration 008: v1.4 State Machine — expand vol_registration.status enum
-- BREAKING CHANGE — coordinate with backend+admin+crew deploy
-- Target DB: MySQL volunteer (named TypeORM connection 'volunteer')
-- Rollback: 008-status-enum-v1.4-rollback.sql
-- =============================================================
--
-- 3-step ALTER (enum → varchar → update → enum) to avoid
-- "Data truncated" error on enum widening.
-- Backfill rules (confirmed by Danny 2026-04-18):
--   pending              → pending_approval
--   approved + contract=signed + checked_in → checked_in
--   approved + contract=signed              → qr_sent
--   approved + contract=sent                → contract_sent
--   approved (no contract)                  → approved (stays)
--   waitlisted / rejected / cancelled       → unchanged
-- =============================================================

-- Step 1: widen column to varchar so we can update to new values
ALTER TABLE vol_registration
  MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'pending_approval';

-- Step 2: backfill status values
-- Note: order matters — most-specific case first (checked_in) before more-general (qr_sent).
UPDATE vol_registration
  SET status = 'checked_in'
  WHERE status = 'approved'
    AND contract_status = 'signed'
    AND checked_in_at IS NOT NULL;

UPDATE vol_registration
  SET status = 'qr_sent'
  WHERE status = 'approved'
    AND contract_status = 'signed'
    AND checked_in_at IS NULL;

UPDATE vol_registration
  SET status = 'contract_sent'
  WHERE status = 'approved'
    AND contract_status = 'sent';

UPDATE vol_registration
  SET status = 'pending_approval'
  WHERE status = 'pending';

-- (approved with contract_status='not_sent' stays as 'approved' — will auto-transition
--  to 'contract_sent' when backend's new send-contract job picks it up.)

-- Step 3: re-apply narrow ENUM with new 10 values
ALTER TABLE vol_registration
  MODIFY COLUMN status ENUM(
    'pending_approval',
    'approved',
    'contract_sent',
    'contract_signed',
    'qr_sent',
    'checked_in',
    'completed',
    'waitlisted',
    'rejected',
    'cancelled'
  ) NOT NULL DEFAULT 'pending_approval';

-- Keep existing index `idx_event_status (event_id, status)` — still covers new values.
-- No schema change on UNIQUE/INDEX required.

-- Done. Verify with:
-- SELECT status, COUNT(*) FROM vol_registration GROUP BY status;
