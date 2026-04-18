-- =============================================================
-- Migration 014: Expand vol_registration.checkin_method ENUM to
-- include 'leader_checkin' (v1.4 Leader portal flow).
-- Caught at runtime: "Data truncated for column 'checkin_method'".
-- =============================================================

ALTER TABLE vol_registration
  MODIFY COLUMN checkin_method
  ENUM('qr_scan', 'gps_verify', 'leader_checkin') NULL;
