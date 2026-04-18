-- =============================================================
-- Migration 023: v1.6 vol_supply_allocation
-- Round 1: Leader phân bổ vật tư xuống từng trạm (allocated_qty),
-- Crew confirm nhận (confirmed_qty), shortage_qty auto-compute.
-- Supplement rounds (OQ-D) → table riêng 024 (Danny chọn Option 2).
-- =============================================================

CREATE TABLE IF NOT EXISTS vol_supply_allocation (
  id                           INT AUTO_INCREMENT PRIMARY KEY,
  station_id                   INT NOT NULL,
  item_id                      INT NOT NULL,

  -- Round 1: Initial allocation + confirmation
  allocated_qty                INT NOT NULL DEFAULT 0,
  confirmed_qty                INT NULL,
  shortage_qty                 INT GENERATED ALWAYS AS (
    CASE WHEN confirmed_qty IS NOT NULL
         THEN allocated_qty - confirmed_qty
         ELSE NULL
    END
  ) STORED
    COMMENT 'âm = nhận nhiều hơn phân bổ (hiếm)',
  confirmed_at                 DATETIME NULL,
  confirmed_by_registration_id INT NULL,
  confirmation_note            TEXT NULL,

  -- Lock flag — TRUE sau khi crew confirm lần đầu.
  -- Admin unlock để cho phép edit lại allocated_qty.
  is_locked                    BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_by_admin_id         VARCHAR(100) NULL,
  unlock_note                  TEXT NULL,
  unlocked_at                  DATETIME NULL,

  created_at                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_alloc_station_item (station_id, item_id),
  INDEX idx_alloc_station (station_id),
  INDEX idx_alloc_item (item_id),
  FOREIGN KEY (station_id) REFERENCES vol_station(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id)    REFERENCES vol_supply_item(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmed_by_registration_id) REFERENCES vol_registration(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
