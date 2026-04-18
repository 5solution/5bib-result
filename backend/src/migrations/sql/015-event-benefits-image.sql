-- =============================================================
-- Migration 015: Event benefits image
-- Admin uploads an image shown on the public register page to
-- advertise what TNV gets for participating (áo, ăn uống, thù lao…).
-- =============================================================

ALTER TABLE vol_event
  ADD COLUMN benefits_image_url VARCHAR(500) NULL
    COMMENT 'Public S3 URL of a benefits/perks banner, shown on crew register page';
