-- =============================================================
-- 999-test-data-bank.sql — TEST-ONLY, NOT A SCHEMA MIGRATION
-- Populates realistic bank info on seeded registrations (event_id=1)
-- so that admin detail view + Excel exports show sensible demo values.
-- Safe to re-run: JSON_MERGE_PATCH overwrites the 4 bank keys.
--
-- Do NOT run in production — real registrations must supply their own
-- bank info via the register form.
-- =============================================================

UPDATE vol_registration
SET form_data = JSON_MERGE_PATCH(
  COALESCE(form_data, JSON_OBJECT()),
  JSON_OBJECT(
    'bank_account_number', '1234567890',
    'bank_holder_name',    'NGUYEN VAN TEST',
    'bank_name',           'Vietcombank (VCB)',
    'bank_branch',         'Ha Noi'
  )
)
WHERE event_id = 1;
