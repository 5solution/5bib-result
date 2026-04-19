-- =============================================================
-- Migration 021: v1.6 vol_supply_item
-- Admin hoặc leader tạo item khi order (Danny Q4).
-- Mỗi item gắn với event (scope per-event, không share cross-event).
-- =============================================================

CREATE TABLE IF NOT EXISTS vol_supply_item (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  event_id    INT NOT NULL,
  item_name   VARCHAR(200) NOT NULL
    COMMENT 'VD: "Nước (ly)", "Chuối", "Gel năng lượng"',
  unit        VARCHAR(50) NOT NULL
    COMMENT 'VD: "ly", "quả", "gói", "bộ"',
  created_by_role_id INT NULL
    COMMENT 'Role của leader tạo item — NULL nếu admin tạo. Dùng để phân quyền edit (Danny Q7: ông nào item ông đó sửa).',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_item_event_name (event_id, item_name),
  INDEX idx_supply_event (event_id, sort_order),
  FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_role_id) REFERENCES vol_role(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
