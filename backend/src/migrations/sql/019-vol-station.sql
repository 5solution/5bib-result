-- =============================================================
-- Migration 019: v1.6 vol_station
-- Trạm/sub-team trong mỗi role. Admin/Leader gán người xuống trạm.
-- status ENUM (OQ-C): setup → active → closed — manual transition.
-- =============================================================

CREATE TABLE IF NOT EXISTS vol_station (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  event_id              INT NOT NULL,
  role_id               INT NOT NULL,
  station_name          VARCHAR(200) NOT NULL,
  location_description  TEXT NULL,
  gps_lat               DECIMAL(10, 7) NULL,
  gps_lng               DECIMAL(10, 7) NULL,
  status                ENUM('setup', 'active', 'closed') NOT NULL DEFAULT 'setup'
    COMMENT 'setup=preparing, active=race-day operational, closed=shift ended',
  sort_order            INT NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_station_role (role_id, status, sort_order),
  INDEX idx_station_event (event_id),
  FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id)  REFERENCES vol_role(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
