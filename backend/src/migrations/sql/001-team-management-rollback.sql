-- =============================================================
-- Team Management Module — Phase 1 Rollback
-- WARNING: This drops ALL team-management tables and their data.
-- Only run if you need to fully roll back the module.
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS vol_shirt_stock;
DROP TABLE IF EXISTS vol_registration;
DROP TABLE IF EXISTS vol_role;
DROP TABLE IF EXISTS vol_contract_template;
DROP TABLE IF EXISTS vol_event;

SET FOREIGN_KEY_CHECKS = 1;
