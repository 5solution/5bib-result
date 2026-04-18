-- =============================================================
-- Migration 016: Event terms & conditions
-- Admin-configurable text shown on the public register page before
-- the TNV can submit. TNV must tick an agree checkbox to proceed.
-- =============================================================

ALTER TABLE vol_event
  ADD COLUMN terms_conditions TEXT NULL
    COMMENT 'Plain-text terms & conditions shown on crew register page; TNV must agree before submitting';
