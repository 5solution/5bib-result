-- =============================================================
-- Migration 010: v1.4 — vol_role.is_leader_role
-- Marks a role whose holders can check-in / confirm completion
-- for other members of the SAME event.
-- =============================================================

ALTER TABLE vol_role
  ADD COLUMN is_leader_role BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT 'TRUE = holders of this role can check-in and confirm completion for team members';

-- Done — verify:
-- DESCRIBE vol_role;
