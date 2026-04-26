-- Migration 034: Add Party A (Bên A) configurable fields to vol_contract_template.
-- Allows each template to carry its own legal entity info so different roles
-- can sign contracts with different companies (5BIB, 5Solution, Thành An, …).
-- The 5 columns are nullable — existing templates work unchanged (renderer
-- falls back to empty string, so any hardcoded HTML in content_html still renders).

ALTER TABLE vol_contract_template
  ADD COLUMN party_a_company_name  VARCHAR(200) NULL AFTER is_active,
  ADD COLUMN party_a_address       VARCHAR(500) NULL AFTER party_a_company_name,
  ADD COLUMN party_a_tax_code      VARCHAR(20)  NULL AFTER party_a_address,
  ADD COLUMN party_a_representative VARCHAR(100) NULL AFTER party_a_tax_code,
  ADD COLUMN party_a_position      VARCHAR(100) NULL AFTER party_a_representative;
