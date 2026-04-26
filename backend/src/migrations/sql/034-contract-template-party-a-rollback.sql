-- Rollback 034: Remove Party A columns from vol_contract_template.

ALTER TABLE vol_contract_template
  DROP COLUMN party_a_position,
  DROP COLUMN party_a_representative,
  DROP COLUMN party_a_tax_code,
  DROP COLUMN party_a_address,
  DROP COLUMN party_a_company_name;
