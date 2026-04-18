-- =============================================================
-- Phase 3.1 — role-level approval mode
-- Adds `auto_approve` to vol_role. Default FALSE = admin must review
-- each registration before it claims a slot + gets a QR code.
-- =============================================================

ALTER TABLE vol_role
  ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN NOT NULL DEFAULT FALSE
  COMMENT 'TRUE = public register becomes approved immediately and takes a slot. FALSE = status=pending, admin must approve manually.';

-- Existing roles created before this migration keep auto-approve for
-- backward compatibility with ongoing E2E test data. New roles via UI
-- default to manual (recommended to prevent registration spam).
UPDATE vol_role SET auto_approve = TRUE WHERE auto_approve = FALSE AND created_at < NOW();
