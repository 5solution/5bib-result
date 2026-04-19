-- =============================================================
-- Migration 022: v1.6 vol_supply_plan
-- Leader order (requested_qty) + Admin fulfill (fulfilled_qty) — 2
-- con số khác nhau, gap_qty tự tính.
-- =============================================================

CREATE TABLE IF NOT EXISTS vol_supply_plan (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  event_id        INT NOT NULL,
  role_id         INT NOT NULL,
  item_id         INT NOT NULL,

  -- Leader order
  requested_qty   INT NOT NULL DEFAULT 0
    COMMENT 'Leader đặt hàng: cần bao nhiêu',
  request_note    TEXT NULL,

  -- Admin fulfill
  fulfilled_qty   INT NULL DEFAULT NULL
    COMMENT 'NULL = admin chưa xử lý; 0 = không đáp ứng được; >0 = số đã cấp',
  fulfill_note    TEXT NULL,

  -- Gap tự tính
  gap_qty         INT GENERATED ALWAYS AS (
    CASE
      WHEN fulfilled_qty IS NULL THEN NULL
      ELSE requested_qty - fulfilled_qty
    END
  ) STORED,

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plan_role_item (role_id, item_id),
  INDEX idx_plan_event (event_id),
  FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id)  REFERENCES vol_role(id)  ON DELETE CASCADE,
  FOREIGN KEY (item_id)  REFERENCES vol_supply_item(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
