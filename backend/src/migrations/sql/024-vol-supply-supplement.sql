-- =============================================================
-- Migration 024: v1.6 vol_supply_supplement (OQ-D Option 2)
-- Multi-supplement table — mỗi lần bổ sung = 1 row mới, unlimited.
-- Use case: race nhiều ca (ca sáng, ca chiều, ca tối) → bổ sung
-- nhiều lần. Audit trail đầy đủ per supplement round.
-- =============================================================

CREATE TABLE IF NOT EXISTS vol_supply_supplement (
  id                           INT AUTO_INCREMENT PRIMARY KEY,
  allocation_id                INT NOT NULL
    COMMENT 'Gắn với vol_supply_allocation (parent — 1 trạm × 1 item)',
  round_number                 INT NOT NULL DEFAULT 1
    COMMENT 'Thứ tự round: 1=lần bổ sung đầu, 2=lần 2, ... (auto increment per allocation)',

  -- Leader bổ sung
  qty                          INT NOT NULL
    COMMENT 'Số lượng bổ sung lần này',
  note                         TEXT NULL
    COMMENT 'VD: "Bổ sung ca chiều", "Thêm sau 9h hết ly"',
  created_by_role_id           INT NULL
    COMMENT 'Role leader tạo (để phân quyền edit)',

  -- Crew confirm
  confirmed_qty                INT NULL
    COMMENT 'Crew confirm thực nhận — có thể < qty',
  shortage_qty                 INT GENERATED ALWAYS AS (
    CASE WHEN confirmed_qty IS NOT NULL
         THEN qty - confirmed_qty
         ELSE NULL
    END
  ) STORED,
  confirmed_at                 DATETIME NULL,
  confirmed_by_registration_id INT NULL,
  confirmation_note            TEXT NULL,

  created_at                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_supp_alloc_round (allocation_id, round_number)
    COMMENT 'Round number duy nhất per allocation để tránh duplicate',
  INDEX idx_supp_allocation (allocation_id),
  FOREIGN KEY (allocation_id) REFERENCES vol_supply_allocation(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_role_id) REFERENCES vol_role(id) ON DELETE SET NULL,
  FOREIGN KEY (confirmed_by_registration_id) REFERENCES vol_registration(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
