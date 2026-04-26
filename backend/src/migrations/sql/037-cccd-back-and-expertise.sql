-- 037: Add CCCD back photo + expertise/qualification fields to volunteer registrations
-- Both surfaced on the public TNV register form.
-- - cccd_back_photo_url: REQUIRED on register (validated server-side, parallel
--   to cccd_photo_url which holds the front face).
-- - expertise: free-text qualification / professional background (TNV writes
--   things like "Bác sĩ đa khoa, 5 năm kinh nghiệm cấp cứu" — used by admin
--   to match TNV with leader/medic roles).

ALTER TABLE vol_registration
  ADD COLUMN cccd_back_photo_url VARCHAR(500) NULL
    COMMENT 'TNV-uploaded CCCD/CMND back-side photo URL (S3). Required at register.'
    AFTER cccd_photo_url,
  ADD COLUMN expertise TEXT NULL
    COMMENT 'TNV professional background / qualification. Optional free text.'
    AFTER cccd_back_photo_url;
