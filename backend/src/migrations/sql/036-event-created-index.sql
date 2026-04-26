-- 036: Add composite index (event_id, created_at) to vol_registration
-- QC Phase 3 finding (CRIT-03): listForEvent uses ORDER BY created_at DESC
-- but idx_event_status only covers (event_id, status) → MariaDB falls back
-- to filesort on 1500+ rows. Adding the composite index lets the index drive
-- both the WHERE filter and the ORDER BY without sort.

ALTER TABLE vol_registration
  ADD INDEX idx_event_created (event_id, created_at);
