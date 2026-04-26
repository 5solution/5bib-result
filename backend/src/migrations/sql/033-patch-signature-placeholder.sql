-- =============================================================
-- Migration 033: Patch seeded templates to render {{signature_image}}.
--
-- BUG: Migration 031 seeded default contract (id=4) and acceptance (id=2)
-- templates WITHOUT an <img src="{{signature_image}}"/> tag in the Bên B
-- signature cell. Services (team-contract.service.ts +
-- team-acceptance.service.ts) pass `signature_image` as a PNG data URL when
-- the crew e-signs, but because the placeholder doesn't exist in the HTML,
-- the captured signature is silently dropped from the rendered PDF — only
-- the typed full_name appears. That defeats the whole e-sign flow.
--
-- FIX: Replace the "typed name only" block with "signature image above the
-- typed name". The <img> sits in the 80px empty space under "(ký và ghi rõ
-- họ tên)" — exactly where a wet signature would go.
--
-- Idempotency: uses REPLACE(...) so re-running after the fix is applied is
-- a no-op (nothing to replace).
--
-- FRAGILITY WARNING: REPLACE() is exact-string-match. If an admin edited the
-- default template between 031 and 033 (e.g. reformatted whitespace or
-- replaced the signature cell with a different layout), the REPLACE will
-- silently no-op and the placeholder will NOT be injected. The integrity
-- assertion at the bottom of this file catches that case — it aborts the
-- migration with a division-by-zero error so the DBA notices.
-- =============================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
START TRANSACTION;

-- Acceptance default template (id=2) — fix signature area
UPDATE vol_acceptance_template
SET content_html = REPLACE(
  content_html,
  '<p><em>(ký và ghi rõ họ tên)</em></p>\n<p style="margin-top: 80px;"><strong>{{full_name}}</strong></p>\n</td>\n</tr>\n</table>',
  '<p><em>(ký và ghi rõ họ tên)</em></p>\n<img src="{{signature_image}}" alt="Chữ ký" style="display:block;margin:16px auto 0;max-width:220px;max-height:90px"/>\n<p><strong>{{full_name}}</strong></p>\n</td>\n</tr>\n</table>'
),
variables = JSON_ARRAY_APPEND(
  -- Only append if not already present (defensive)
  CASE
    WHEN JSON_SEARCH(variables, 'one', 'signature_image') IS NULL
    THEN variables
    ELSE JSON_REMOVE(variables, JSON_UNQUOTE(JSON_SEARCH(variables, 'one', 'signature_image')))
  END,
  '$',
  'signature_image'
)
WHERE id = 2 AND is_default = 1;

-- Contract default template (id=4) — same fix
UPDATE vol_contract_template
SET content_html = REPLACE(
  content_html,
  '<p><em>(ký và ghi rõ họ tên)</em></p>\n<p style="margin-top: 80px;"><strong>{{full_name}}</strong></p>\n</td>\n</tr>\n</table>',
  '<p><em>(ký và ghi rõ họ tên)</em></p>\n<img src="{{signature_image}}" alt="Chữ ký" style="display:block;margin:16px auto 0;max-width:220px;max-height:90px"/>\n<p><strong>{{full_name}}</strong></p>\n</td>\n</tr>\n</table>'
),
variables = JSON_ARRAY_APPEND(
  CASE
    WHEN JSON_SEARCH(variables, 'one', 'signature_image') IS NULL
    THEN variables
    ELSE JSON_REMOVE(variables, JSON_UNQUOTE(JSON_SEARCH(variables, 'one', 'signature_image')))
  END,
  '$',
  'signature_image'
)
WHERE id = 4 AND template_name = '5BIB HĐDV CTV (Mặc định)';

-- -------------------------------------------------------------
-- Integrity assertion: after the two UPDATEs above, EVERY default
-- template MUST contain the {{signature_image}} placeholder. If any
-- default template is missing it (e.g. because an admin edited the HTML
-- and broke the REPLACE() exact-string match), fail hard so the DBA
-- notices and applies the fix manually.
--
-- Trick: wrap the failing-template IDs in a scalar subquery, duplicated
-- twice via UNION ALL. MariaDB requires a scalar subquery to return ≤1
-- row — when the integrity holds, each inner SELECT yields 0 rows so the
-- total is 0 (NULL → OK). When even ONE default template is missing the
-- placeholder, the duplication guarantees ≥2 rows, triggering
-- ERROR 1242 "Subquery returns more than 1 row" — aborting the TX.
--
-- This works in every sql_mode including non-strict, unlike 1/0 or CAST.
-- -------------------------------------------------------------
-- NOTE: vol_contract_template has no is_default column (see migration 031) —
-- the canonical default is identified by template_name = '5BIB HĐDV CTV (Mặc định)'.
-- vol_acceptance_template DOES have is_default, added in 030.
SELECT (
  SELECT id FROM vol_acceptance_template
  WHERE is_default = 1 AND content_html NOT LIKE '%{{signature_image}}%'
  UNION ALL
  SELECT id FROM vol_acceptance_template
  WHERE is_default = 1 AND content_html NOT LIKE '%{{signature_image}}%'
  UNION ALL
  SELECT id FROM vol_contract_template
  WHERE template_name = '5BIB HĐDV CTV (Mặc định)'
    AND content_html NOT LIKE '%{{signature_image}}%'
  UNION ALL
  SELECT id FROM vol_contract_template
  WHERE template_name = '5BIB HĐDV CTV (Mặc định)'
    AND content_html NOT LIKE '%{{signature_image}}%'
) AS migration_033_default_template_must_contain_signature_image;

COMMIT;
