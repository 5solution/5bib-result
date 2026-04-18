-- =============================================================
-- Migration 025: v1.6 Option A — vol_role.manages_role_id
-- Leader role có FK trỏ tới role được quản lý (crew/TNV).
-- Ví dụ: Leader Team Nước (id=1) manages TNV team Nước (id=3)
-- → leader portal query supply plan theo manages_role_id.
-- Self-reference FK, nullable (non-leader role = NULL).
-- =============================================================

ALTER TABLE vol_role
  ADD COLUMN manages_role_id INT NULL
    COMMENT 'FK self-reference: leader role trỏ tới role được quản lý (v1.6 Option A). NULL cho non-leader role.',
  ADD CONSTRAINT fk_role_manages
    FOREIGN KEY (manages_role_id) REFERENCES vol_role(id)
    ON DELETE SET NULL;

CREATE INDEX idx_role_manages ON vol_role (manages_role_id);
