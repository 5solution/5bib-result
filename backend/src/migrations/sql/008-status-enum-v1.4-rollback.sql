-- Rollback 008: collapse v1.4 statuses back to v1.2 (5-state) enum
-- USE WITH CAUTION — destroys fine-grained state information.

ALTER TABLE vol_registration
  MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'pending';

-- Collapse: anything past 'approved' (contract_sent..completed) → approved
UPDATE vol_registration
  SET status = 'approved'
  WHERE status IN ('contract_sent','contract_signed','qr_sent','checked_in','completed');

UPDATE vol_registration
  SET status = 'pending'
  WHERE status = 'pending_approval';

ALTER TABLE vol_registration
  MODIFY COLUMN status ENUM('pending','approved','waitlisted','rejected','cancelled')
  NOT NULL DEFAULT 'pending';
