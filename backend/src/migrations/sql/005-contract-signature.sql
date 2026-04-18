-- 005-contract-signature.sql
-- Adds a nullable S3 key column that stores the PNG of the signatory's
-- handwritten signature captured via signature_pad on the crew sign form.
-- Served via short-lived presigned URL only (private bucket).
ALTER TABLE vol_registration
  ADD COLUMN contract_signature_url VARCHAR(512) NULL
  AFTER contract_pdf_hash;
