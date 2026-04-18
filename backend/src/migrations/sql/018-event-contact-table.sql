-- =============================================================
-- Migration 018: v1.5 Emergency contacts per event
-- Admin configures BTC / Y tế / Cứu hộ / Công an / Khác contacts.
-- Publicly readable by any registration with a valid magic token
-- (no status gate — this is safety info).
-- =============================================================

CREATE TABLE IF NOT EXISTS vol_event_contact (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  event_id         INT NOT NULL,
  contact_type     ENUM('btc', 'medical', 'rescue', 'police', 'other') NOT NULL,
  contact_name     VARCHAR(200) NOT NULL,
  phone            VARCHAR(20) NOT NULL,
  phone2           VARCHAR(20) NULL,
  note             TEXT NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_contacts (event_id, is_active, sort_order),
  FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
