-- =============================================================
-- Migration 027: Station Assignment — add `duty` field
-- Purpose: per-assignment chuyên môn / nhiệm vụ cụ thể tại trạm
--   VD Team Nước trạm Km10: person A duty="phát nước", person B="sơ cứu"
-- Nullable free-text, max 100 chars. Legacy rows = NULL → UI hiển thị "—".
-- =============================================================

ALTER TABLE vol_station_assignment
  ADD COLUMN duty VARCHAR(100) NULL
    COMMENT 'Chuyên môn / nhiệm vụ cụ thể trong trạm (VD: phát nước, sơ cứu, timing)'
    AFTER assignment_role;
