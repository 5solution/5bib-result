-- =============================================================
-- Rollback for migration 029.
-- WARNING: assumes tables are empty (data đã clear trước khi rollback).
-- =============================================================

-- 4. Restore vol_station_assignment.assignment_role
-- Drop the sort index added in migration 029 (not the original idx_assignment_station
-- which was auto-dropped when assignment_role column was dropped).
ALTER TABLE vol_station_assignment DROP INDEX idx_assignment_station_sort;
ALTER TABLE vol_station_assignment
  ADD COLUMN assignment_role ENUM('crew','volunteer') NOT NULL DEFAULT 'volunteer'
    AFTER registration_id;
ALTER TABLE vol_station_assignment
  ADD INDEX idx_assignment_station (station_id, assignment_role);

-- 3. Restore vol_supply_plan.role_id
ALTER TABLE vol_supply_plan DROP FOREIGN KEY fk_supplyplan_category;
ALTER TABLE vol_supply_plan DROP INDEX uq_plan_category_item;
ALTER TABLE vol_supply_plan DROP COLUMN category_id;
ALTER TABLE vol_supply_plan
  ADD COLUMN role_id INT NOT NULL AFTER event_id;
ALTER TABLE vol_supply_plan
  ADD UNIQUE KEY uq_plan_role_item (role_id, item_id);
ALTER TABLE vol_supply_plan
  ADD CONSTRAINT vol_supply_plan_ibfk_2
    FOREIGN KEY (role_id) REFERENCES vol_role(id) ON DELETE CASCADE;

-- 2. Restore vol_station.role_id
ALTER TABLE vol_station DROP FOREIGN KEY fk_station_category;
ALTER TABLE vol_station DROP INDEX idx_station_category;
ALTER TABLE vol_station DROP COLUMN category_id;
ALTER TABLE vol_station
  ADD COLUMN role_id INT NOT NULL AFTER event_id;
ALTER TABLE vol_station
  ADD INDEX idx_station_role (role_id, status, sort_order);
ALTER TABLE vol_station
  ADD CONSTRAINT vol_station_ibfk_2
    FOREIGN KEY (role_id) REFERENCES vol_role(id) ON DELETE RESTRICT;

-- 1. Remove vol_role.category_id
ALTER TABLE vol_role DROP FOREIGN KEY fk_role_category;
ALTER TABLE vol_role DROP INDEX idx_role_category;
ALTER TABLE vol_role DROP COLUMN category_id;
