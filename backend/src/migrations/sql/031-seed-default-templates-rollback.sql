-- =============================================================
-- Rollback for migration 031 — removes the two default templates.
-- Safe to re-apply migration 031 after rollback.
-- =============================================================

DELETE FROM vol_acceptance_template
WHERE template_name = '5BIB Biên bản nghiệm thu CTV (Mặc định)'
  AND event_id IS NULL;

DELETE FROM vol_contract_template
WHERE template_name = '5BIB HĐDV CTV (Mặc định)';
