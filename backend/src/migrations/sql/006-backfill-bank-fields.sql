-- =============================================================
-- Phase 3.3 — backfill bank_* form fields
-- Adds 4 bank-info fields (account_number / holder_name / bank / branch)
-- to every role's form_fields JSON so that accountants can pay via
-- bank transfer without phone-calling each volunteer.
--
-- Mirrors 003 pattern: JSON_ARRAY_APPEND guarded by JSON_SEARCH so the
-- migration is fully idempotent. Do NOT make the fields `required:true`
-- retroactively on existing regs — the registration service only validates
-- new submissions.
--
-- `bank_name` is type `select` with a hard-coded VN bank preset list; the
-- list in sync with backend/src/modules/team-management/constants/banks.ts,
-- crew/lib/banks.ts, and admin/src/lib/banks.ts. If the frontend preset
-- list grows, we do NOT need to re-run a migration — the options array is
-- resolved client-side from DEFAULT_FORM_FIELDS for new roles; existing
-- roles keep the options embedded in form_fields.
-- =============================================================

-- 1. bank_account_number — required text, 6–20 digits.
UPDATE vol_role
SET form_fields = JSON_ARRAY_APPEND(
  form_fields,
  '$',
  JSON_OBJECT(
    'key',      'bank_account_number',
    'label',    'Số tài khoản ngân hàng',
    'type',     'text',
    'required', TRUE,
    'hint',     'Chỉ số, 6–20 chữ số'
  )
)
WHERE JSON_SEARCH(form_fields, 'one', 'bank_account_number', NULL, '$[*].key') IS NULL;

-- 2. bank_holder_name — required text, must match registration full_name
-- (diacritic-insensitive) — server-side validation enforces this.
UPDATE vol_role
SET form_fields = JSON_ARRAY_APPEND(
  form_fields,
  '$',
  JSON_OBJECT(
    'key',      'bank_holder_name',
    'label',    'Tên chủ tài khoản',
    'type',     'text',
    'required', TRUE,
    'hint',     'Phải khớp với họ tên ở trên (viết hoa không dấu)'
  )
)
WHERE JSON_SEARCH(form_fields, 'one', 'bank_holder_name', NULL, '$[*].key') IS NULL;

-- 3. bank_name — required select, preset VN banks list.
UPDATE vol_role
SET form_fields = JSON_ARRAY_APPEND(
  form_fields,
  '$',
  JSON_OBJECT(
    'key',      'bank_name',
    'label',    'Ngân hàng',
    'type',     'select',
    'required', TRUE,
    'options',  JSON_ARRAY(
      'Vietcombank (VCB)',
      'VietinBank (CTG)',
      'BIDV',
      'Agribank',
      'Techcombank (TCB)',
      'MB Bank (MBB)',
      'ACB',
      'VPBank',
      'Sacombank (STB)',
      'SHB',
      'HDBank',
      'TPBank',
      'OCB',
      'VIB',
      'MSB',
      'SeABank',
      'Eximbank',
      'LienVietPostBank (LPB)',
      'Bac A Bank',
      'DongA Bank',
      'OceanBank',
      'SCB',
      'Viet Capital Bank',
      'PVcomBank',
      'Nam A Bank',
      'Kienlongbank',
      'VietBank',
      'NCB',
      'ABBank',
      'Saigonbank',
      'CBBank',
      'BaoViet Bank',
      'GPBank',
      'Standard Chartered',
      'HSBC Vietnam',
      'UOB Vietnam',
      'Shinhan Bank',
      'Woori Bank',
      'Cake by VPBank',
      'Timo Plus (Bản Việt)',
      'Ubank by VPBank',
      'Khác'
    )
  )
)
WHERE JSON_SEARCH(form_fields, 'one', 'bank_name', NULL, '$[*].key') IS NULL;

-- 4. bank_branch — optional text.
UPDATE vol_role
SET form_fields = JSON_ARRAY_APPEND(
  form_fields,
  '$',
  JSON_OBJECT(
    'key',      'bank_branch',
    'label',    'Chi nhánh',
    'type',     'text',
    'required', FALSE
  )
)
WHERE JSON_SEARCH(form_fields, 'one', 'bank_branch', NULL, '$[*].key') IS NULL;
