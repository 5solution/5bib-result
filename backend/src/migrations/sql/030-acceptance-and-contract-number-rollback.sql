-- =============================================================
-- Rollback for migration 030.
-- WARNING: destroys acceptance data + contract_number + Bên B
-- fields. Only run if the feature is being fully reverted.
-- =============================================================

-- 4. Drop indexes + columns on vol_registration
DROP INDEX idx_reg_event_acceptance ON vol_registration;
DROP INDEX idx_reg_acceptance_status ON vol_registration;

ALTER TABLE vol_registration DROP FOREIGN KEY fk_reg_acceptance_template;
ALTER TABLE vol_registration DROP INDEX uq_reg_contract_number;

ALTER TABLE vol_registration
  DROP COLUMN cccd_issue_place,
  DROP COLUMN cccd_issue_date,
  DROP COLUMN birth_date,
  DROP COLUMN acceptance_notes,
  DROP COLUMN acceptance_pdf_hash,
  DROP COLUMN acceptance_pdf_url,
  DROP COLUMN acceptance_signed_at,
  DROP COLUMN acceptance_sent_at,
  DROP COLUMN acceptance_value,
  DROP COLUMN acceptance_template_id,
  DROP COLUMN acceptance_status,
  DROP COLUMN contract_number;

-- 3. Drop contract_code_prefix from vol_event
ALTER TABLE vol_event DROP INDEX uq_event_contract_code_prefix;
ALTER TABLE vol_event DROP COLUMN contract_code_prefix;

-- 2. Drop sequence table
DROP TABLE IF EXISTS vol_contract_number_sequence;

-- 1. Drop acceptance template table
DROP TABLE IF EXISTS vol_acceptance_template;
