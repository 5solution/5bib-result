-- =============================================================
-- Migration 020: v1.6 vol_station_assignment
-- BR-STN-01: 1 người → 1 trạm (UNIQUE registration_id enforced DB-level)
-- BR-STN-03: Leader không được gán vào trạm (service-level check)
-- =============================================================

CREATE TABLE IF NOT EXISTS vol_station_assignment (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  station_id        INT NOT NULL,
  registration_id   INT NOT NULL,
  assignment_role   ENUM('crew', 'volunteer') NOT NULL,
  sort_order        INT NOT NULL DEFAULT 0,
  note              TEXT NULL
    COMMENT 'Task-specific note: "Phụ trách backup nước, canh giờ"',
  assigned_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_one_station_per_person (registration_id),
  INDEX idx_assignment_station (station_id, assignment_role),
  FOREIGN KEY (station_id)      REFERENCES vol_station(id)      ON DELETE RESTRICT,
  FOREIGN KEY (registration_id) REFERENCES vol_registration(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
