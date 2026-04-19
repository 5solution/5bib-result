-- =============================================================
-- Migration 029: v1.8 Category restructure
-- Pivots Station + Supply-Plan + Role linkage from role → category.
-- Preconditions:
--   - Migration 028 đã chạy (bảng vol_team_category tồn tại)
--   - Data: vol_station, vol_supply_plan, vol_station_assignment
--     phải rỗng hoặc admin tự clear trước khi chạy (DROP column)
--   - vol_role CÓ THỂ chứa data — chỉ thêm category_id NULL (additive)
--
-- Behavioural changes:
--   1. vol_role: thêm category_id NULL, FK ON DELETE SET NULL
--      (floater roles OK, không bắt buộc thuộc team)
--   2. vol_station: role_id → category_id (NOT NULL, RESTRICT)
--   3. vol_supply_plan: role_id → category_id (NOT NULL, RESTRICT)
--      Kèm đổi UNIQUE key uq_plan_role_item → uq_plan_category_item
--   4. vol_station_assignment: DROP assignment_role enum
--      (derive từ registration.role.is_leader_role tại read time)
--      + đổi idx_assignment_station để không include cột đã drop
-- =============================================================

-- ───────────────────────────────────────────────────────────────
-- 1. vol_role: thêm category_id (nullable, additive)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE vol_role
  ADD COLUMN category_id INT NULL
    COMMENT 'Team mà role thuộc về (NULL = floater, không thuộc team nào)'
    AFTER event_id;

ALTER TABLE vol_role
  ADD CONSTRAINT fk_role_category
    FOREIGN KEY (category_id) REFERENCES vol_team_category(id)
    ON DELETE SET NULL;

ALTER TABLE vol_role
  ADD INDEX idx_role_category (category_id);

-- ───────────────────────────────────────────────────────────────
-- 2. vol_station: role_id → category_id (destructive, bảng trống)
-- FK name `vol_station_ibfk_2` = InnoDB auto-generated in migration 019
-- (FK #1=event_id, FK #2=role_id). If a DB ops admin renamed the FK,
-- adjust before running. Run `SHOW CREATE TABLE vol_station` to verify.
-- ───────────────────────────────────────────────────────────────
ALTER TABLE vol_station DROP FOREIGN KEY vol_station_ibfk_2;
ALTER TABLE vol_station DROP INDEX idx_station_role;
ALTER TABLE vol_station DROP COLUMN role_id;

ALTER TABLE vol_station
  ADD COLUMN category_id INT NOT NULL
    COMMENT 'Team sở hữu trạm — station thuộc 1 Team duy nhất'
    AFTER event_id;

ALTER TABLE vol_station
  ADD CONSTRAINT fk_station_category
    FOREIGN KEY (category_id) REFERENCES vol_team_category(id)
    ON DELETE RESTRICT;

ALTER TABLE vol_station
  ADD INDEX idx_station_category (category_id, status, sort_order);

-- ───────────────────────────────────────────────────────────────
-- 3. vol_supply_plan: role_id → category_id
-- FK name `vol_supply_plan_ibfk_2` = InnoDB auto-generated in migration 022
-- (FK #1=event_id, FK #2=role_id, FK #3=item_id). Verify with
-- `SHOW CREATE TABLE vol_supply_plan` before running on non-standard DB.
-- ───────────────────────────────────────────────────────────────
ALTER TABLE vol_supply_plan DROP FOREIGN KEY vol_supply_plan_ibfk_2;
ALTER TABLE vol_supply_plan DROP INDEX uq_plan_role_item;
ALTER TABLE vol_supply_plan DROP COLUMN role_id;

ALTER TABLE vol_supply_plan
  ADD COLUMN category_id INT NOT NULL
    COMMENT 'Team đặt hàng — Leader của Team đại diện order cho cả team'
    AFTER event_id;

ALTER TABLE vol_supply_plan
  ADD CONSTRAINT fk_supplyplan_category
    FOREIGN KEY (category_id) REFERENCES vol_team_category(id)
    ON DELETE RESTRICT;

ALTER TABLE vol_supply_plan
  ADD UNIQUE KEY uq_plan_category_item (event_id, category_id, item_id);

-- ───────────────────────────────────────────────────────────────
-- 4. vol_station_assignment: drop assignment_role enum
-- Thứ tự: DROP column trước (auto-drop composite index),
-- sau đó ADD index mới để FK station_id còn covering index.
-- ───────────────────────────────────────────────────────────────
ALTER TABLE vol_station_assignment DROP COLUMN assignment_role;
-- Recreate simpler station index nếu chưa có (MariaDB auto-kept FK coverage
-- nhưng explicitly để sort ASC hoạt động).
ALTER TABLE vol_station_assignment
  ADD INDEX idx_assignment_station_sort (station_id, sort_order);
