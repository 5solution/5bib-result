-- =============================================================
-- Phase 3.2 — backfill cccd_photo + avatar_photo form fields
-- Roles seeded before the photo-upload fix have form_fields that
-- lack cccd_photo (required) and avatar_photo (optional). Without
-- these entries the public register form never renders file inputs
-- so admins never receive CCCD photos — blocking contract signing.
--
-- We only touch rows whose form_fields JSON does NOT already contain
-- an entry with the respective key (JSON_SEARCH returns NULL when
-- missing). Running the migration multiple times is safe.
--
-- NOTE on `type` value: the crew register form (crew/app/events/[id]
-- /register/register-form.tsx) switches on field.type === 'photo' to
-- render the <input type="file"> upload control. We therefore use
-- `type: "photo"` here — the label "Ảnh CCCD" / "Ảnh đại diện" is what
-- the human sees; the schema stays consistent with DEFAULT_FORM_FIELDS
-- in admin/src/lib/team-api.ts.
-- =============================================================

-- Add cccd_photo if missing
UPDATE vol_role
SET form_fields = JSON_ARRAY_APPEND(
  form_fields,
  '$',
  JSON_OBJECT(
    'key',      'cccd_photo',
    'label',    'Ảnh CCCD',
    'type',     'photo',
    'required', TRUE,
    'hint',     'Chụp rõ mặt CCCD — bắt buộc để lập hợp đồng'
  )
)
WHERE JSON_SEARCH(form_fields, 'one', 'cccd_photo', NULL, '$[*].key') IS NULL;

-- Add avatar_photo if missing
UPDATE vol_role
SET form_fields = JSON_ARRAY_APPEND(
  form_fields,
  '$',
  JSON_OBJECT(
    'key',      'avatar_photo',
    'label',    'Ảnh đại diện',
    'type',     'photo',
    'required', FALSE,
    'hint',     'Không bắt buộc. Nếu có sẽ dùng làm avatar.'
  )
)
WHERE JSON_SEARCH(form_fields, 'one', 'avatar_photo', NULL, '$[*].key') IS NULL;
