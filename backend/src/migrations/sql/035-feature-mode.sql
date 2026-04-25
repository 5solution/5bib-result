-- 035: Per-event feature mode toggle
-- Adds feature_mode ENUM and feature_nghiem_thu BOOLEAN to vol_event

ALTER TABLE vol_event
  ADD COLUMN feature_mode ENUM('full', 'lite') NOT NULL DEFAULT 'full'
    COMMENT 'full = all features; lite = personnel + contract only (no QR, station, supply)'
    AFTER terms_conditions,
  ADD COLUMN feature_nghiem_thu BOOLEAN NOT NULL DEFAULT TRUE
    COMMENT 'true = require formal acceptance sign-off before completed; false = skip acceptance step'
    AFTER feature_mode;

ALTER TABLE vol_event
  ADD INDEX idx_event_feature_mode (feature_mode);
