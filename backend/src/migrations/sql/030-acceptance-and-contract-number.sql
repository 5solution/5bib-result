-- Charset guard — this file has Vietnamese diacritics in comments/errors.
-- Forces utf8mb4 regardless of client default so comments stay readable
-- in SHOW CREATE TABLE output and error messages.
SET NAMES utf8mb4;

-- =============================================================
-- Migration 030: Acceptance (Biên bản nghiệm thu) workflow +
--                Contract number sequence per event.
--
-- Adds the post-event acceptance step that gates payment:
--   registration.payment_status='paid' will be blocked by the
--   service layer unless acceptance_status='signed'.
--
-- New tables:
--   1. vol_acceptance_template — mirror of vol_contract_template
--      for biên bản nghiệm thu. Supports event_id=NULL rows as
--      global defaults (cloneable per-event later).
--   2. vol_contract_number_sequence — atomic per-event counter.
--      Service uses SELECT ... FOR UPDATE inside transaction to
--      reserve the next contract_number without race.
--
-- vol_event:
--   - contract_code_prefix VARCHAR(10) NULL UNIQUE
--     Uppercase short-code for the event, used in contract_number
--     format: `NNN-{PREFIX}-HDDV/CTV-5BIB` (e.g. 008-HNLLT-HDDV/CTV-5BIB).
--     UNIQUE cross-event (Danny Option X — audit-friendly).
--
-- vol_registration (additive, all nullable):
--   - acceptance_status ENUM + 6 acceptance_* fields
--   - contract_number VARCHAR(50) UNIQUE — generated at
--     contract_send time, persists through the whole lifecycle
--     and is reused on the acceptance document.
--   - birth_date, cccd_issue_date, cccd_issue_place —
--     required for contract/acceptance rendering. Admin fills
--     via backfill modal if missing before sending HĐ.
--
-- Indexes:
--   - idx_reg_acceptance_status — for admin tab filters
--   - idx_reg_contract_number already UNIQUE (implicit index)
--
-- Rollback: 030-acceptance-and-contract-number-rollback.sql
-- =============================================================

-- ───────────────────────────────────────────────────────────────
-- 1. vol_acceptance_template
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vol_acceptance_template (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NULL COMMENT 'NULL = global default, cloneable per-event',
  template_name VARCHAR(255) NOT NULL,
  content_html LONGTEXT NOT NULL,
  variables JSON NOT NULL COMMENT 'List of placeholder keys used in content_html',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_acceptance_tpl_event
    FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE CASCADE,
  INDEX idx_acceptance_tpl_event (event_id),
  INDEX idx_acceptance_tpl_default (is_default, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- 2. vol_contract_number_sequence
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vol_contract_number_sequence (
  event_id INT NOT NULL PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0 COMMENT 'Last assigned contract number for this event',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contract_seq_event
    FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- 3. vol_event: contract_code_prefix
-- ───────────────────────────────────────────────────────────────
ALTER TABLE vol_event
  ADD COLUMN contract_code_prefix VARCHAR(10) NULL
    COMMENT 'Uppercase short-code for contract_number format (e.g. HNLLT). Locked after first HĐ issued.'
    AFTER event_name;

ALTER TABLE vol_event
  ADD CONSTRAINT uq_event_contract_code_prefix UNIQUE (contract_code_prefix);

-- ───────────────────────────────────────────────────────────────
-- 4. vol_registration: acceptance + Bên B + contract_number fields
-- ───────────────────────────────────────────────────────────────
ALTER TABLE vol_registration
  ADD COLUMN contract_number VARCHAR(50) NULL
    COMMENT 'Format: NNN-{PREFIX}-HDDV/CTV-5BIB. Assigned at contract_send time.'
    AFTER contract_signature_url,
  ADD COLUMN acceptance_status ENUM('not_ready','pending_sign','signed','disputed')
    NOT NULL DEFAULT 'not_ready'
    COMMENT 'Biên bản nghiệm thu state. Gate for payment_status=paid.'
    AFTER contract_number,
  ADD COLUMN acceptance_template_id INT NULL
    COMMENT 'Template used to render acceptance PDF. NULL until sent.'
    AFTER acceptance_status,
  ADD COLUMN acceptance_value INT NULL
    COMMENT 'Tổng giá trị nghiệm thu (VND). Default = role.unit_price × days_checked_in, admin editable.'
    AFTER acceptance_template_id,
  ADD COLUMN acceptance_sent_at DATETIME NULL
    AFTER acceptance_value,
  ADD COLUMN acceptance_signed_at DATETIME NULL
    AFTER acceptance_sent_at,
  ADD COLUMN acceptance_pdf_url VARCHAR(500) NULL
    COMMENT 'S3 key (not full URL). Presigned at read time.'
    AFTER acceptance_signed_at,
  ADD COLUMN acceptance_pdf_hash VARCHAR(64) NULL
    COMMENT 'SHA-256 of the rendered PDF for integrity verification.'
    AFTER acceptance_pdf_url,
  ADD COLUMN acceptance_notes TEXT NULL
    COMMENT 'Dispute reason or admin note on the acceptance.'
    AFTER acceptance_pdf_hash,
  ADD COLUMN birth_date DATE NULL
    COMMENT 'Bên B — ngày sinh (for contract rendering).'
    AFTER acceptance_notes,
  ADD COLUMN cccd_issue_date DATE NULL
    COMMENT 'Bên B — ngày cấp CCCD (optional).'
    AFTER birth_date,
  ADD COLUMN cccd_issue_place VARCHAR(255) NULL
    COMMENT 'Bên B — nơi cấp CCCD.'
    AFTER cccd_issue_date;

-- FK for acceptance_template_id
ALTER TABLE vol_registration
  ADD CONSTRAINT fk_reg_acceptance_template
    FOREIGN KEY (acceptance_template_id)
    REFERENCES vol_acceptance_template(id)
    ON DELETE SET NULL;

-- UNIQUE on contract_number (cross-event, full DB)
ALTER TABLE vol_registration
  ADD CONSTRAINT uq_reg_contract_number UNIQUE (contract_number);

-- Index for admin filter by acceptance_status
CREATE INDEX idx_reg_acceptance_status ON vol_registration (acceptance_status);

-- Composite index for event-scoped acceptance queries (admin tabs)
CREATE INDEX idx_reg_event_acceptance
  ON vol_registration (event_id, acceptance_status);
