-- =============================================================
-- Migration 026: v1.6 Option B2 — junction table for leader→role
-- Replaces single-FK vol_role.manages_role_id with N:M junction.
-- Supports nested hierarchy: Leader A → Leader B → Crew + TNV
-- (BFS resolver in service, cycle prevention via visited set.)
-- =============================================================

-- Step 1: Create junction table
CREATE TABLE IF NOT EXISTS vol_role_manages (
  leader_role_id   INT NOT NULL,
  managed_role_id  INT NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (leader_role_id, managed_role_id),
  INDEX idx_rm_leader (leader_role_id),
  INDEX idx_rm_managed (managed_role_id),
  FOREIGN KEY (leader_role_id)  REFERENCES vol_role(id) ON DELETE CASCADE,
  FOREIGN KEY (managed_role_id) REFERENCES vol_role(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Backfill existing single FK
INSERT INTO vol_role_manages (leader_role_id, managed_role_id)
SELECT id, manages_role_id
FROM vol_role
WHERE manages_role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM vol_role_manages rm
    WHERE rm.leader_role_id = vol_role.id
      AND rm.managed_role_id = vol_role.manages_role_id
  );

-- Step 3: Drop old FK + column (after backfill)
ALTER TABLE vol_role DROP FOREIGN KEY fk_role_manages;
ALTER TABLE vol_role DROP INDEX idx_role_manages;
ALTER TABLE vol_role DROP COLUMN manages_role_id;
