-- =============================================================
-- Migration 028: v1.8 vol_team_category
-- "Team" layer above roles. Groups Leader/Crew/TNV roles of the
-- same operational team (VD: Team Nước, Team Y tế, Team Timing).
-- Stations + supply-plans sẽ thuộc về Category thay vì Role cụ thể
-- (xem migration 029). Role vẫn giữ FK event_id riêng.
-- =============================================================

CREATE TABLE IF NOT EXISTS vol_team_category (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  event_id      INT NOT NULL,
  name          VARCHAR(100) NOT NULL
    COMMENT 'Tên hiển thị, VD "Team Nước", "Team Y tế"',
  slug          VARCHAR(60) NOT NULL
    COMMENT 'Slug unique/event — dùng cho URL + lookup',
  color         VARCHAR(7) NOT NULL DEFAULT '#3B82F6'
    COMMENT 'Hex color #RRGGBB cho UI color-dot',
  sort_order    INT NOT NULL DEFAULT 0,
  description   TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_category_event_slug (event_id, slug),
  INDEX idx_category_event (event_id, sort_order),
  FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
