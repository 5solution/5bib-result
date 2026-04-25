-- =============================================================
-- Rollback for migration 033: remove {{signature_image}} <img> tag from
-- seeded default contract & acceptance templates, restore the original
-- "typed name only" signature cell.
--
-- Note: won't touch user-edited templates — only reverses the exact shape
-- migration 033 wrote.
-- =============================================================

START TRANSACTION;

UPDATE vol_acceptance_template
SET content_html = REPLACE(
  content_html,
  '<p><em>(ký và ghi rõ họ tên)</em></p>\n<img src="{{signature_image}}" alt="Chữ ký" style="display:block;margin:16px auto 0;max-width:220px;max-height:90px"/>\n<p><strong>{{full_name}}</strong></p>\n</td>\n</tr>\n</table>',
  '<p><em>(ký và ghi rõ họ tên)</em></p>\n<p style="margin-top: 80px;"><strong>{{full_name}}</strong></p>\n</td>\n</tr>\n</table>'
)
WHERE id = 2 AND is_default = 1;

UPDATE vol_contract_template
SET content_html = REPLACE(
  content_html,
  '<p><em>(ký và ghi rõ họ tên)</em></p>\n<img src="{{signature_image}}" alt="Chữ ký" style="display:block;margin:16px auto 0;max-width:220px;max-height:90px"/>\n<p><strong>{{full_name}}</strong></p>\n</td>\n</tr>\n</table>',
  '<p><em>(ký và ghi rõ họ tên)</em></p>\n<p style="margin-top: 80px;"><strong>{{full_name}}</strong></p>\n</td>\n</tr>\n</table>'
)
WHERE id = 4 AND template_name = '5BIB HĐDV CTV (Mặc định)';

COMMIT;
