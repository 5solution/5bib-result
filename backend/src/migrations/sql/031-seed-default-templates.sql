-- =============================================================
-- Migration 031: Seed default HĐDV + Biên bản nghiệm thu
--                templates converted from the DOCX master
--                (Nguyễn Thị Kim Linh-08_HĐDV_CREW.docx).
--
-- Creates:
--   - 1 default row in vol_contract_template (event_id-less,
--     rendered per-registration). Inserted only if no template
--     with template_name='5BIB HĐDV CTV (Mặc định)' exists.
--   - 1 default row in vol_acceptance_template (event_id=NULL).
--
-- Placeholders:
--   Contract: contract_number, sign_date, full_name, birth_date,
--     cccd_number, cccd_issue_date, cccd_issue_place, phone,
--     email, address, bank_account_number, bank_name, tax_code
--     (= cccd_number), work_content, work_location, work_period,
--     unit_price, unit_price_words, event_name
--   Acceptance: contract_number, acceptance_date, full_name,
--     birth_date, cccd_number, cccd_issue_date, cccd_issue_place,
--     phone, email, address, bank_account_number, bank_name,
--     tax_code, work_content, acceptance_value,
--     acceptance_value_words, event_name
--
-- Rollback: 031-seed-default-templates-rollback.sql
-- =============================================================

-- IMPORTANT: This file contains Vietnamese with diacritics. The MariaDB
-- client MUST be invoked with `--default-character-set=utf8mb4` or the
-- bytes get interpreted as Latin-1 → double-encoded → mojibake on the way
-- in (e.g. "Cộng" becomes "Cá»™ng"). `SET NAMES utf8mb4` at the top of the
-- file is a hard guard even when the client default is wrong.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────
-- 1. Contract template (HĐDV CTV)
-- ───────────────────────────────────────────────────────────────
INSERT INTO vol_contract_template (
  template_name, content_html, variables, is_active, created_by, created_at, updated_at
)
SELECT
  '5BIB HĐDV CTV (Mặc định)',
  '<div style="font-family: Times New Roman, serif; font-size: 13pt; line-height: 1.5;">
<p style="text-align: center; font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
<p style="text-align: center; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</p>
<p style="text-align: center;">-----****-----</p>
<h2 style="text-align: center; margin-top: 24px;">HỢP ĐỒNG DỊCH VỤ</h2>
<p style="text-align: center;">(Số: {{contract_number}})</p>
<p>- Căn cứ vào Bộ luật dân sự số 91/2015/QH13 được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam khóa XIII, kỳ họp thứ 10 thông qua ngày 24 tháng 11 năm 2015;</p>
<p>- Căn cứ vào khả năng nhu cầu của hai bên.</p>
<p>Hà Nội, ngày {{sign_date}} chúng tôi gồm:</p>

<p><strong>Bên A: CÔNG TY CỔ PHẦN 5BIB</strong></p>
<ul style="list-style: none; padding-left: 0;">
<li>- Địa chỉ: Tầng 9, Tòa nhà Hồ Gươm Plaza (tòa văn phòng), Số 102 Phố Trần Phú, Phường Mộ Lao, Quận Hà Đông, Thành phố Hà Nội, Việt Nam</li>
<li>- Mã số thuế: 0110398986</li>
<li>- Người đại diện: Ông Nguyễn Bình Minh &nbsp;&nbsp;&nbsp; Chức vụ: Giám đốc</li>
</ul>
<p><em>(Sau đây gọi là "Công ty")</em></p>

<p><strong>Bên B: Ông/Bà {{full_name}}</strong></p>
<ul style="list-style: none; padding-left: 0;">
<li>- Ngày sinh: {{birth_date}}</li>
<li>- Số CCCD: {{cccd_number}} &nbsp;&nbsp; Ngày cấp: {{cccd_issue_date}} &nbsp;&nbsp; Nơi cấp: {{cccd_issue_place}}</li>
<li>- Điện thoại: {{phone}}</li>
<li>- Email: {{email}}</li>
<li>- Địa chỉ: {{address}}</li>
<li>- Số tài khoản: {{bank_account_number}} - {{bank_name}}</li>
<li>- Mã số thuế: {{tax_code}}</li>
</ul>
<p><em>(Sau đây gọi là "Bên cung cấp")</em></p>

<p>Sau khi thỏa thuận hai bên thống nhất ký kết Hợp đồng cộng tác viên với những điều khoản như sau:</p>

<p><strong>Điều 1. Nội dung công việc của Bên B</strong></p>
<p>Bên B làm cộng tác viên cho Bên A để thực hiện các công việc: {{work_content}}</p>

<p><strong>Điều 2. Địa điểm và thời giờ làm việc</strong></p>
<p>1. Địa điểm: {{work_location}}</p>
<p>2. Thời giờ làm việc: {{work_period}}</p>

<p><strong>Điều 3. Trang bị dụng cụ làm việc, phương tiện đi lại, chỗ ngủ</strong></p>
<p>Bên A sẽ trang bị cho Bên B các dụng cụ và phương tiện cần thiết đi lại để phục vụ cho công việc theo nội dung hợp đồng này.</p>

<p><strong>Điều 4. Thù lao và quyền lợi của cộng tác viên</strong></p>
<p>- Bên B được hưởng thù lao khi hoàn thành công việc theo thỏa thuận tại Điều 1 với đơn giá {{unit_price}} VND ({{unit_price_words}}) (đã bao gồm thuế TNCN)</p>

<p><strong>Điều 5. Quyền và nghĩa vụ của Bên A</strong></p>
<p><em>1. Quyền của Bên A</em></p>
<p>- Bên A có quyền đơn phương chấm dứt hợp đồng cộng tác viên với Bên B khi Bên B vi phạm nghĩa vụ bảo mật thông tin của Bên A hoặc Bên B không đáp ứng được yêu cầu công việc.</p>
<p>- Bên A không chịu trách nhiệm về các khoản chi phí khác cho Bên B trong quá trình thực hiện công việc trong hợp đồng.</p>
<p><em>2. Nghĩa vụ của Bên A:</em></p>
<p>- Thanh toán đầy đủ, đúng hạn các chế độ và quyền lợi cho bên B theo nội dung của hợp đồng và theo từng phụ lục hợp đồng cụ thể (nếu có)</p>
<p>- Tạo điều kiện để Bên B thực hiện công việc được thuận lợi nhất.</p>
<p>- Bên A cấp thẻ CTV cho Bên B để phục vụ hoạt động giao tiếp với đối tác, khách hàng trong quá trình giao dịch (nếu có)</p>

<p><strong>Điều 6. Quyền và nghĩa vụ của Bên B</strong></p>
<p><em>1. Quyền của Bên B</em></p>
<p>- Bên B được sử dụng thẻ CTV và tư cách pháp nhân trong từng vụ việc cụ thể khi được sự đồng ý bằng văn bản của Bên A để thực hiện các nội dung công việc tại Điều 1 Hợp đồng này.</p>
<p>- Yêu cầu Bên A thanh toán đầy đủ và đúng hạn các chế độ thù lao và các quyền, lợi ích vật chất khác theo Hợp đồng này.</p>
<p>- Được yêu cầu Bên A cung cấp các thông tin liên quan đến việc để phục vụ cho công việc của Bên B nhưng phải sử dụng các thông tin theo quy định, đảm bảo uy tín và thương hiệu của Bên A.</p>
<p><em>2. Nghĩa vụ của Bên B</em></p>
<p>- Hoàn thành công việc như đã thỏa thuận tại Điều 1</p>
<p>- Tự chịu các khoản chi phí đi lại, điện thoại,... và các chi phí khác không ghi trong hợp đồng này liên quan đến công việc hợp tác với Bên A</p>
<p>- Tuân thủ triệt để các quy định về bảo mật thông tin liên quan đến vụ việc thực hiện</p>

<p><strong>Điều 7. Bảo mật thông tin</strong></p>
<p>- Trong thời gian thực hiện và khi chấm dứt hợp đồng này, Bên B cam kết giữ bí mật và không tiết lộ bất kỳ các thông tin, tài liệu nào cho bên thứ ba liên quan đến vụ việc nếu không được Bên A chấp nhận.</p>
<p>- Trường hợp Bên B vi phạm quy định về bảo mật thông tin, Bên A có quyền chấm dứt hợp đồng và yêu cầu Bên B bồi thường thiệt hại theo quy định của pháp luật.</p>

<p><strong>Điều 8. Điều khoản chung</strong></p>
<p>1. Trong quá trình thực hiện, nếu một trong hai bên đơn phương chấm dứt hợp đồng này thì phải thông báo cho bên kia bằng văn bản trước 15 ngày làm việc để hai bên cùng thống nhất giải quyết.</p>
<p>2. Trường hợp phát sinh tranh chấp trong quá trình thực hiện hợp đồng hai bên sẽ thương lượng và đàm phán trên tinh thần hợp tác và đảm bảo quyền lợi của cả hai bên. Nếu tranh chấp không giải quyết được bằng thương lượng, các bên sẽ yêu cầu tòa án có thẩm quyền giải quyết. Phán quyết của Tòa án có tính chất bắt buộc đối với các bên.</p>

<p><strong>Điều 9. Hiệu lực và thời hạn hợp đồng</strong></p>
<p>Thời hạn hợp đồng: {{work_period}}</p>
<p>Hai bên có thể gia hạn hợp đồng theo nhu cầu thực tế công việc phát sinh.</p>

<p><strong>Điều 10. Điều khoản thi hành</strong></p>
<p>- Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận trong Hợp đồng này;</p>
<p>- Mọi sửa đổi, bổ sung liên quan đến nội dung hợp đồng này phải được hai bên thống nhất và thể hiện bằng văn bản;</p>
<p>- Hợp đồng này gồm 2 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ một bản và sẽ tự động thanh lý sau khi hai bên ký Biên bản nghiệm thu và không còn bất cứ mâu thuẫn nào.</p>

<table style="width: 100%; margin-top: 32px;">
<tr>
<td style="width: 50%; text-align: center; vertical-align: top;">
<p><strong>Đại diện Bên A</strong></p>
<p><em>(ký và ghi rõ họ tên)</em></p>
<p style="margin-top: 80px;"><strong>NGUYỄN BÌNH MINH</strong></p>
</td>
<td style="width: 50%; text-align: center; vertical-align: top;">
<p><strong>Đại diện Bên B</strong></p>
<p><em>(ký và ghi rõ họ tên)</em></p>
<p style="margin-top: 80px;"><strong>{{full_name}}</strong></p>
</td>
</tr>
</table>
</div>',
  JSON_ARRAY(
    'contract_number','sign_date','full_name','birth_date','cccd_number',
    'cccd_issue_date','cccd_issue_place','phone','email','address',
    'bank_account_number','bank_name','tax_code','work_content',
    'work_location','work_period','unit_price','unit_price_words','event_name'
  ),
  1,
  'system',
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM vol_contract_template
  WHERE template_name = '5BIB HĐDV CTV (Mặc định)'
);

-- ───────────────────────────────────────────────────────────────
-- 2. Acceptance template (Biên bản nghiệm thu)
-- ───────────────────────────────────────────────────────────────
INSERT INTO vol_acceptance_template (
  event_id, template_name, content_html, variables,
  is_default, is_active, created_by, created_at, updated_at
)
SELECT
  NULL,
  '5BIB Biên bản nghiệm thu CTV (Mặc định)',
  '<div style="font-family: Times New Roman, serif; font-size: 13pt; line-height: 1.5;">
<p style="text-align: center; font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
<p style="text-align: center; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</p>
<p style="text-align: center;">-----****-----</p>
<h2 style="text-align: center; margin-top: 24px;">BIÊN BẢN NGHIỆM THU HỢP ĐỒNG CỘNG TÁC VIÊN</h2>
<p style="text-align: center;">(Số: {{contract_number}})</p>
<p>- Căn cứ vào Hợp đồng cộng tác viên số {{contract_number}}</p>
<p>Hà Nội, ngày {{acceptance_date}} chúng tôi gồm:</p>

<p><strong>Bên A: CÔNG TY CỔ PHẦN 5BIB</strong></p>
<ul style="list-style: none; padding-left: 0;">
<li>- Địa chỉ: Tầng 9, Tòa nhà Hồ Gươm Plaza (tòa văn phòng), Số 102 Phố Trần Phú, Phường Mộ Lao, Quận Hà Đông, Thành phố Hà Nội, Việt Nam</li>
<li>- Mã số thuế: 0110398986</li>
<li>- Người đại diện: Ông Nguyễn Bình Minh &nbsp;&nbsp;&nbsp; Chức vụ: Giám đốc</li>
</ul>
<p><em>(Sau đây gọi là "Công ty")</em></p>

<p><strong>Bên B: Ông/Bà {{full_name}}</strong></p>
<ul style="list-style: none; padding-left: 0;">
<li>- Ngày sinh: {{birth_date}}</li>
<li>- Số CCCD: {{cccd_number}} &nbsp;&nbsp; Ngày cấp: {{cccd_issue_date}} &nbsp;&nbsp; Nơi cấp: {{cccd_issue_place}}</li>
<li>- Điện thoại: {{phone}}</li>
<li>- Email: {{email}}</li>
<li>- Địa chỉ: {{address}}</li>
<li>- Số tài khoản: {{bank_account_number}} - {{bank_name}}</li>
<li>- Mã số thuế: {{tax_code}}</li>
</ul>
<p><em>(Sau đây gọi là "Bên cung cấp")</em></p>

<p>Công ty và Bên Cung cấp sau đây được gọi riêng là "Bên" và gọi chung là "Các Bên".</p>
<p>Hai bên thống nhất nghiệm thu hợp đồng số {{contract_number}} với nội dung sau:</p>

<p><strong>ĐIỀU 1: NỘI DUNG NGHIỆM THU</strong></p>
<p>Bên Cung cấp dịch vụ đã thực hiện đúng và đầy đủ các hạng mục công việc căn cứ theo điều khoản của Hợp đồng dịch vụ số {{contract_number}} với các hạng mục công việc cụ thể như sau: {{work_content}}</p>

<p><strong>ĐIỀU 2: GIÁ TRỊ NGHIỆM THU</strong></p>
<p>Tổng giá trị nghiệm thu: {{acceptance_value}} VND (đã bao gồm thuế TNCN)</p>
<p>Bằng chữ: {{acceptance_value_words}}</p>
<p>Công ty có nghĩa vụ thanh toán cho Bên Cung cấp 100% giá trị nghiệm thu theo đúng thỏa thuận trong hợp đồng sau khi đã trích nộp thuế TNCN.</p>

<p><strong>ĐIỀU 3: KẾT LUẬN</strong></p>
<p>Hai bên thống nhất ký kết Biên bản nghiệm thu Hợp đồng dịch vụ số {{contract_number}} ngày {{acceptance_date}} và cam kết thực hiện nghiêm chỉnh và đầy đủ các nội dung của Biên bản nghiệm thu này.</p>
<p>Biên bản này được lập thành 02 (hai) bản có giá trị như nhau, mỗi bên giữ 01 (một) bản để thực hiện.</p>

<table style="width: 100%; margin-top: 32px;">
<tr>
<td style="width: 50%; text-align: center; vertical-align: top;">
<p><strong>ĐẠI DIỆN BÊN A</strong></p>
<p><em>(ký và ghi rõ họ tên)</em></p>
<p style="margin-top: 80px;"><strong>NGUYỄN BÌNH MINH</strong></p>
</td>
<td style="width: 50%; text-align: center; vertical-align: top;">
<p><strong>ĐẠI DIỆN BÊN B</strong></p>
<p><em>(ký và ghi rõ họ tên)</em></p>
<p style="margin-top: 80px;"><strong>{{full_name}}</strong></p>
</td>
</tr>
</table>
</div>',
  JSON_ARRAY(
    'contract_number','acceptance_date','full_name','birth_date','cccd_number',
    'cccd_issue_date','cccd_issue_place','phone','email','address',
    'bank_account_number','bank_name','tax_code','work_content',
    'acceptance_value','acceptance_value_words','event_name'
  ),
  1,
  1,
  'system',
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM vol_acceptance_template
  WHERE template_name = '5BIB Biên bản nghiệm thu CTV (Mặc định)'
    AND event_id IS NULL
);
