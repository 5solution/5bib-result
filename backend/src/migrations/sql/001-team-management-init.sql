-- =============================================================
-- Team Management Module — Phase 1 Migration
-- Target DB: MySQL volunteer (named TypeORM connection 'volunteer')
-- Run: mysql -h <host> -u <user> -p <volunteer_db> < 001-team-management-init.sql
-- Rollback: see 001-team-management-rollback.sql
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- CLEANUP — drop tables from the deprecated volunteer module
-- (safe IF EXISTS — confirmed by Danny 2026-04-17)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS volunteer_user;
DROP TABLE IF EXISTS volunteer_team;
DROP TABLE IF EXISTS volunteer_registration;
DROP TABLE IF EXISTS volunteer_task;
DROP TABLE IF EXISTS volunteer_supply_log;
DROP TABLE IF EXISTS volunteer_message;
DROP TABLE IF EXISTS volunteer_check_in;
DROP TABLE IF EXISTS volunteer_event;
DROP TABLE IF EXISTS vol_users;
DROP TABLE IF EXISTS vol_teams;
DROP TABLE IF EXISTS vol_tasks;
DROP TABLE IF EXISTS vol_messages;
DROP TABLE IF EXISTS vol_supply_logs;

-- -------------------------------------------------------------
-- Table 1: vol_contract_template (no FK dependencies → create first)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vol_contract_template (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  template_name   VARCHAR(255) NOT NULL,
  content_html    LONGTEXT NOT NULL COMMENT 'HTML template with placeholders {{full_name}} etc.',
  variables       JSON NOT NULL COMMENT 'Available placeholders',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      VARCHAR(100) NOT NULL COMMENT 'Admin username',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 2: vol_event
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vol_event (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  race_id             VARCHAR(100) NULL COMMENT 'Link to race on 5BIB platform (MongoDB ObjectId)',
  event_name          VARCHAR(255) NOT NULL,
  description         TEXT NULL,
  location            VARCHAR(255) NULL,
  location_lat        DECIMAL(10,8) NULL,
  location_lng        DECIMAL(11,8) NULL,
  checkin_radius_m    INT NOT NULL DEFAULT 500 COMMENT 'GPS checkin radius in meters',
  event_start_date    DATE NOT NULL,
  event_end_date      DATE NOT NULL,
  registration_open   DATETIME NOT NULL,
  registration_close  DATETIME NOT NULL,
  status              ENUM('draft','open','closed','completed') NOT NULL DEFAULT 'draft',
  contact_email       VARCHAR(255) NULL,
  contact_phone       VARCHAR(20) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_dates (event_start_date, event_end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 3: vol_role
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vol_role (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  event_id              INT NOT NULL,
  role_name             VARCHAR(100) NOT NULL COMMENT 'Volunteer / Crew / Leader',
  description           TEXT NULL,
  max_slots             INT NOT NULL DEFAULT 0,
  filled_slots          INT NOT NULL DEFAULT 0 COMMENT 'Cached count — atomic update',
  waitlist_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  daily_rate            DECIMAL(12,0) NOT NULL DEFAULT 0 COMMENT 'VND per day. 0 = unpaid volunteer',
  working_days          INT NOT NULL DEFAULT 1,
  total_compensation    DECIMAL(12,0) GENERATED ALWAYS AS (daily_rate * working_days) STORED,
  form_fields           JSON NOT NULL COMMENT 'Dynamic form field config',
  contract_template_id  INT NULL,
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE RESTRICT,
  FOREIGN KEY (contract_template_id) REFERENCES vol_contract_template(id) ON DELETE SET NULL,
  INDEX idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 4: vol_registration
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vol_registration (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  role_id                 INT NOT NULL,
  event_id                INT NOT NULL,
  -- Basic info
  full_name               VARCHAR(255) NOT NULL,
  email                   VARCHAR(255) NOT NULL,
  phone                   VARCHAR(20) NOT NULL,
  -- Dynamic form data
  form_data               JSON NOT NULL COMMENT 'All answers per role.form_fields',
  -- Shirt size (extracted for aggregate queries)
  shirt_size              ENUM('XS','S','M','L','XL','XXL','XXXL') NULL,
  -- Photos (S3 URLs)
  avatar_photo_url        VARCHAR(500) NULL COMMENT 'Avatar — public S3 URL',
  cccd_photo_url          VARCHAR(500) NULL COMMENT 'ID photo — private, presigned on read',
  -- Status
  status                  ENUM('pending','approved','waitlisted','rejected','cancelled') NOT NULL DEFAULT 'pending',
  waitlist_position       INT NULL,
  -- Magic link
  magic_token             VARCHAR(64) NOT NULL,
  magic_token_expires     DATETIME NOT NULL,
  -- Single-use sign token flag (Danger Zone: prevent replay signing)
  contract_sign_token_used BOOLEAN NOT NULL DEFAULT FALSE,
  -- QR
  qr_code                 VARCHAR(255) NULL COMMENT 'QR payload (same as magic_token)',
  -- Check-in
  checked_in_at           DATETIME NULL,
  checked_out_at          DATETIME NULL,
  checkin_method          ENUM('qr_scan','gps_verify') NULL,
  checkin_lat             DECIMAL(10,8) NULL,
  checkin_lng             DECIMAL(11,8) NULL,
  -- Contract
  contract_status         ENUM('not_sent','sent','signed','expired') NOT NULL DEFAULT 'not_sent',
  contract_signed_at      DATETIME NULL,
  contract_pdf_url        VARCHAR(500) NULL COMMENT 'S3 URL of signed PDF',
  contract_pdf_hash       VARCHAR(64) NULL COMMENT 'SHA-256 for tamper check',
  -- Payment
  actual_working_days     INT NULL,
  actual_compensation     DECIMAL(12,0) NULL COMMENT '= daily_rate * actual_working_days',
  payment_status          ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  -- Meta
  notes                   TEXT NULL,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES vol_role(id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE RESTRICT,
  INDEX idx_role_status (role_id, status),
  INDEX idx_event_status (event_id, status),
  UNIQUE KEY uq_magic_token (magic_token),
  INDEX idx_qr_code (qr_code),
  UNIQUE KEY uq_email_role (email, role_id) COMMENT 'one email can register a role only once'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table 5: vol_shirt_stock
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vol_shirt_stock (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  event_id          INT NOT NULL,
  size              ENUM('XS','S','M','L','XL','XXL','XXXL') NOT NULL,
  quantity_planned  INT NOT NULL DEFAULT 0,
  quantity_ordered  INT NOT NULL DEFAULT 0,
  quantity_received INT NOT NULL DEFAULT 0,
  notes             TEXT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES vol_event(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_event_size (event_id, size)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Done — verify with:
-- SHOW TABLES LIKE 'vol\_%';
