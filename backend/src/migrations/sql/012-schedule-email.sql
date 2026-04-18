-- =============================================================
-- Migration 012: v1.4 — vol_team_schedule_email table
-- Per-role scheduling email config (one row per event+role).
-- Admin fills operational details (reporting_time, gathering_point,
-- team_contact_phone, special_note) + subject + body_html; bulk-send
-- to members whose status ∈ (contract_signed, qr_sent, checked_in, completed).
-- =============================================================

CREATE TABLE IF NOT EXISTS vol_team_schedule_email (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  event_id            INT NOT NULL,
  role_id             INT NOT NULL,
  subject             VARCHAR(500) NOT NULL,
  body_html           LONGTEXT NOT NULL
    COMMENT 'HTML body with {{placeholders}}',
  -- Role-level custom variables (admin-filled, substituted at send time)
  reporting_time      VARCHAR(100) NULL
    COMMENT 'e.g. "06:00 AM on 02/05/2026"',
  gathering_point     VARCHAR(255) NULL,
  team_contact_phone  VARCHAR(20)  NULL,
  special_note        TEXT         NULL,
  -- Send tracking
  last_sent_at        DATETIME NULL,
  last_sent_count     INT NOT NULL DEFAULT 0
    COMMENT 'Recipients in the most recent bulk send',
  total_sent_count    INT NOT NULL DEFAULT 0
    COMMENT 'Cumulative recipient count across all sends',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id)  REFERENCES vol_role(id)  ON DELETE CASCADE,
  UNIQUE KEY uq_event_role (event_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Done — verify:
-- SHOW TABLES LIKE 'vol_team_schedule_email';
