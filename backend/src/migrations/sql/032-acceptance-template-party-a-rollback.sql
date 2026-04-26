-- Rollback 032: Remove party_a_* columns from vol_acceptance_template
-- Note: content_html reverts to hardcoded version — not worth reverting automatically;
-- the column drop is the critical undo.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE vol_acceptance_template
  DROP COLUMN IF EXISTS party_a_company_name,
  DROP COLUMN IF EXISTS party_a_address,
  DROP COLUMN IF EXISTS party_a_tax_code,
  DROP COLUMN IF EXISTS party_a_representative,
  DROP COLUMN IF EXISTS party_a_position;
