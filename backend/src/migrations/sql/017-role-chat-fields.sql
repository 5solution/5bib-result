-- =============================================================
-- Migration 017: v1.5 Group Chat link per role
-- Admin configures zalo/telegram/whatsapp/other group link per
-- vol_role. Members see it on portal AFTER ký HĐ (gated status).
-- =============================================================

ALTER TABLE vol_role
  ADD COLUMN chat_platform ENUM('zalo', 'telegram', 'whatsapp', 'other') NULL
    COMMENT 'Group-chat platform hint for icon rendering',
  ADD COLUMN chat_group_url VARCHAR(500) NULL
    COMMENT 'Group-chat join URL — gated by registration.status IN (contract_signed, qr_sent, checked_in, completed)';
