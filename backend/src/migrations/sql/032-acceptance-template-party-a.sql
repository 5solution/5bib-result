-- =============================================================
-- Migration 032: Add party_a_* columns to vol_acceptance_template
--
-- Mirrors the party_a_* fields already present on vol_contract_template.
-- Allows each acceptance template to carry its own legal entity info
-- (company name, address, tax code, representative, position) so the
-- placeholder {{party_a_company_name}} etc. render dynamically in the
-- biên bản nghiệm thu document — same as in HĐDV templates.
--
-- Also updates the seeded default template (id from migration 031) to
-- replace the hardcoded "CÔNG TY CỔ PHẦN 5BIB / Nguyễn Bình Minh"
-- text with {{party_a_*}} placeholders, and seeds the column values
-- with the canonical 5BIB legal entity data.
--
-- Rollback: 032-acceptance-template-party-a-rollback.sql
-- =============================================================
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- 1. Add party_a_* columns (all nullable — old templates unaffected)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE vol_acceptance_template
  ADD COLUMN party_a_company_name  VARCHAR(200) NULL AFTER is_active,
  ADD COLUMN party_a_address       VARCHAR(500) NULL AFTER party_a_company_name,
  ADD COLUMN party_a_tax_code      VARCHAR(20)  NULL AFTER party_a_address,
  ADD COLUMN party_a_representative VARCHAR(100) NULL AFTER party_a_tax_code,
  ADD COLUMN party_a_position      VARCHAR(100) NULL AFTER party_a_representative;

-- ───────────────────────────────────────────────────────────────
-- 2. Update default template: seed party_a values + replace
--    hardcoded text with {{party_a_*}} placeholders
-- ───────────────────────────────────────────────────────────────
UPDATE vol_acceptance_template
SET
  party_a_company_name   = 'CÔNG TY CỔ PHẦN 5BIB',
  party_a_address        = 'Tầng 9, Tòa nhà Hồ Gươm Plaza (tòa văn phòng), Số 102 Phố Trần Phú, Phường Mộ Lao, Quận Hà Đông, Thành phố Hà Nội, Việt Nam',
  party_a_tax_code       = '0110398986',
  party_a_representative = 'Nguyễn Bình Minh',
  party_a_position       = 'Giám đốc',
  variables = JSON_ARRAY(
    'contract_number','acceptance_date','full_name','birth_date',
    'cccd_number','cccd_issue_date','cccd_issue_place','phone','email',
    'address','bank_account_number','bank_name','tax_code',
    'work_content','work_location','work_period',
    'acceptance_value','acceptance_value_words','event_name','signature_image',
    'party_a_company_name','party_a_address','party_a_tax_code',
    'party_a_representative','party_a_position'
  ),
  content_html = '<div style="font-family: Times New Roman, serif; font-size: 13pt; line-height: 1.5;">\n<p style="text-align: center; font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>\n<p style="text-align: center; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</p>\n<p style="text-align: center;">-----****-----</p>\n<h2 style="text-align: center; margin-top: 24px;">BIÊN BẢN NGHIỆM THU HỢP ĐỒNG CỘNG TÁC VIÊN</h2>\n<p style="text-align: center;">(Số: {{contract_number}})</p>\n<p>- Căn cứ vào Hợp đồng cộng tác viên số {{contract_number}}</p>\n<p>Hà Nội, ngày {{acceptance_date}} chúng tôi gồm:</p>\n\n<p><strong>Bên A: {{party_a_company_name}}</strong></p>\n<ul style="list-style: none; padding-left: 0;">\n<li>- Địa chỉ: {{party_a_address}}</li>\n<li>- Mã số thuế: {{party_a_tax_code}}</li>\n<li>- Người đại diện: Ông {{party_a_representative}} &nbsp;&nbsp;&nbsp; Chức vụ: {{party_a_position}}</li>\n</ul>\n<p><em>(Sau đây gọi là "Công ty")</em></p>\n\n<p><strong>Bên B: Ông/Bà {{full_name}}</strong></p>\n<ul style="list-style: none; padding-left: 0;">\n<li>- Ngày sinh: {{birth_date}}</li>\n<li>- Số CCCD: {{cccd_number}} &nbsp;&nbsp; Ngày cấp: {{cccd_issue_date}} &nbsp;&nbsp; Nơi cấp: {{cccd_issue_place}}</li>\n<li>- Điện thoại: {{phone}}</li>\n<li>- Email: {{email}}</li>\n<li>- Địa chỉ: {{address}}</li>\n<li>- Số tài khoản: {{bank_account_number}} - {{bank_name}}</li>\n<li>- Mã số thuế: {{tax_code}}</li>\n</ul>\n<p><em>(Sau đây gọi là "Bên cung cấp")</em></p>\n\n<p>Công ty và Bên Cung cấp sau đây được gọi riêng là "Bên" và gọi chung là "Các Bên".</p>\n<p>Hai bên thống nhất nghiệm thu hợp đồng số {{contract_number}} với nội dung sau:</p>\n\n<p><strong>ĐIỀU 1: NỘI DUNG NGHIỆM THU</strong></p>\n<p>Bên Cung cấp dịch vụ đã thực hiện đúng và đầy đủ các hạng mục công việc căn cứ theo điều khoản của Hợp đồng dịch vụ số {{contract_number}} với các hạng mục công việc cụ thể như sau: {{work_content}}</p>\n\n<p><strong>ĐIỀU 2: GIÁ TRỊ NGHIỆM THU</strong></p>\n<p>Tổng giá trị nghiệm thu: {{acceptance_value}} VND (đã bao gồm thuế TNCN)</p>\n<p>Bằng chữ: {{acceptance_value_words}}</p>\n<p>Công ty có nghĩa vụ thanh toán cho Bên Cung cấp 100% giá trị nghiệm thu theo đúng thỏa thuận trong hợp đồng sau khi đã trích nộp thuế TNCN.</p>\n\n<p><strong>ĐIỀU 3: KẾT LUẬN</strong></p>\n<p>Hai bên thống nhất ký kết Biên bản nghiệm thu Hợp đồng dịch vụ số {{contract_number}} ngày {{acceptance_date}} và cam kết thực hiện nghiêm chỉnh và đầy đủ các nội dung của Biên bản nghiệm thu này.</p>\n<p>Biên bản này được lập thành 02 (hai) bản có giá trị như nhau, mỗi bên giữ 01 (một) bản để thực hiện.</p>\n\n<table style="width: 100%; margin-top: 32px;">\n<tr>\n<td style="width: 50%; text-align: center; vertical-align: top;">\n<p><strong>ĐẠI DIỆN BÊN A</strong></p>\n<p><em>(ký và ghi rõ họ tên)</em></p>\n<p style="margin-top: 80px;"><strong>{{party_a_representative}}</strong></p>\n</td>\n<td style="width: 50%; text-align: center; vertical-align: top;">\n<p><strong>ĐẠI DIỆN BÊN B</strong></p>\n<p><em>(ký và ghi rõ họ tên)</em></p>\n<img src="{{signature_image}}" alt="Chữ ký" style="display:block;margin:16px auto 0;max-width:220px;max-height:90px"/>\n<p><strong>{{full_name}}</strong></p>\n</td>\n</tr>\n</table>\n</div>'
WHERE is_default = 1 AND event_id IS NULL;
