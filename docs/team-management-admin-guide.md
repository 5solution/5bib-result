# Hướng dẫn Admin 5BIB: Quản lý Nhân sự Sự kiện (Team Management)

> **Dành cho:** Admin nội bộ 5BIB  
> **Cập nhật lần cuối:** 2026-04-27  
> **Phiên bản module:** v2.0 (Acceptance workflow)

---

## Mục lục

1. [Tổng quan quy trình](#1-tổng-quan-quy-trình)
2. [Tạo và quản lý Sự kiện](#2-sự-kiện)
3. [Tạo Vai trò (Roles)](#3-vai-trò-roles)
4. [Quản lý Đăng ký (Nhân sự)](#4-quản-lý-đăng-ký-nhân-sự)
5. [Hợp đồng](#5-hợp-đồng)
6. [Check-in / Scan QR](#6-check-in--scan-qr)
7. [Nghiệm thu (Biên bản)](#7-nghiệm-thu-biên-bản)
8. [Thanh toán](#8-thanh-toán)
9. [Teams & Trạm](#9-teams--trạm)
10. [Import & Export](#10-import--export)
11. [Template Hợp đồng & Biên bản](#11-template-hợp-đồng--biên-bản)

---

## 1. Tổng quan quy trình

Toàn bộ vòng đời của một CTV trong hệ thống đi theo luồng:

```
Tạo sự kiện → Tạo vai trò → CTV đăng ký → Admin duyệt
→ Gửi hợp đồng → CTV ký HĐ → Admin gửi QR
→ CTV check-in → Admin xác nhận hoàn thành
→ Admin gửi biên bản nghiệm thu → CTV ký BNN
→ Admin đánh dấu đã thanh toán
```

> **Lưu ý:** Tùy theo cấu hình **Chế độ** của sự kiện, một số bước có thể được bỏ qua (xem Mục 2.3).

---

## 2. Sự kiện

### 2.1 Tạo sự kiện mới

**Đường dẫn:** `admin-dev.5bib.com/team-management`

1. Nhấn nút **"Sự kiện mới"** (góc trên phải)
2. Điền thông tin:

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Tên sự kiện | ✅ | Ví dụ: "Ha Noi Lô Lô Trail 2026" |
| Ngày bắt đầu | ✅ | Ngày diễn ra sự kiện |
| Ngày kết thúc | ✅ | Ngày kết thúc sự kiện |
| Địa điểm | | Tên địa điểm tự do |
| Mở đăng ký | ✅ | Thời điểm CTV bắt đầu đăng ký được |
| Đóng đăng ký | ✅ | Thời điểm đóng form đăng ký |
| Bán kính check-in (m) | | Mặc định 500m — khoảng cách GPS cho phép |

3. Nhấn **Tạo** → sự kiện được tạo ở trạng thái **Draft**

### 2.2 Chuyển trạng thái sự kiện

| Trạng thái | Màu | Ý nghĩa | Hành động tiếp theo |
|-----------|-----|---------|-------------------|
| Draft | Xám | Mới tạo, chưa mở đăng ký | "Mở đăng ký" |
| Open | Xanh | CTV có thể đăng ký qua web | "Đóng đăng ký" |
| Closed | Vàng | Đã đóng form, đang vận hành | "Hoàn thành" |
| Completed | Tím | Sự kiện đã kết thúc | — |

> **Quan trọng:** Chỉ xoá được sự kiện ở trạng thái **Draft**. Các trạng thái khác KHÔNG xoá được.

### 2.3 Cài đặt nâng cao (Settings)

Vào **Settings** của từng sự kiện để chỉnh:

- **Chế độ (Feature Mode):**
  - `Full` — luồng đầy đủ: Đăng ký → HĐ → QR → Check-in → Nghiệm thu
  - `Lite` — bỏ qua QR + Check-in, admin xác nhận thủ công

- **Bắt buộc Nghiệm thu:** Bật/tắt yêu cầu CTV ký biên bản trước khi thanh toán

- **Mã tiền tố hợp đồng:** Ví dụ `HNLT` → số HĐ sẽ là `001-HNLT-HDDV/CTV-5BIB`

- **Thời gian tối thiểu để hoàn thành:** Số giờ check-in tối thiểu để không bị đánh dấu "nghi ngờ"

---

## 3. Vai trò (Roles)

### 3.1 Tạo vai trò

**Đường dẫn:** `team-management/[id]/roles`

1. Nhấn **"Thêm vai trò"**
2. Điền thông tin:

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Tên vai trò | ✅ | Ví dụ: "Ban Đích", "CTV Y tế", "Team Leader" |
| Số lượng | ✅ | Số slot tối đa |
| Thù lao/ngày | | VNĐ/ngày, dùng để tính giá trị biên bản |
| Số ngày làm | | Tổng ngày làm, mặc định 1 |
| Auto-approve | | Bật → đăng ký được duyệt ngay lập tức |
| Cho phép waitlist | | Bật → đăng ký quá slot vẫn được chấp nhận, xếp danh sách chờ |
| Template HĐ | | Chọn template hợp đồng sẽ dùng cho vai trò này |

### 3.2 Cấu hình form đăng ký (Form Fields)

Mỗi vai trò có thể có các câu hỏi riêng. Nhấn **"Cấu hình form"** trong dialog chỉnh sửa vai trò:

- Thêm trường: Text, Số điện thoại, Email, Lựa chọn (Select), Ngày, Textarea, Upload ảnh, Cỡ áo
- Đặt trường bắt buộc/không bắt buộc
- Kéo thả để sắp xếp thứ tự

> **Mẹo:** Trường **"Ảnh CCCD"** và **"Ảnh đại diện"** có type đặc biệt — hệ thống sẽ tự lưu vào S3 và hiển thị preview trong admin.

### 3.3 Vai trò Leader

Bật **"Là vai trò Leader"** để:
- Leader có thể check-in thay cho các CTV trong nhóm quản lý
- Leader thấy tab **"Quản lý"** trên trang status cá nhân
- Chọn các vai trò Leader này quản lý (Managed Roles)

### 3.4 Nhóm chat

Điền URL nhóm Zalo/Telegram/WhatsApp → CTV sẽ thấy link tham gia nhóm sau khi ký hợp đồng.

---

## 4. Quản lý Đăng ký (Nhân sự)

### 4.1 Màn hình tổng quan

**Đường dẫn:** `team-management/[id]/registrations`

Màn hình hiển thị toàn bộ CTV với các tab lọc nhanh:

| Tab | Ý nghĩa |
|-----|---------|
| Tất cả | Toàn bộ danh sách |
| Chờ duyệt | Mới đăng ký, chờ admin xử lý |
| Đã duyệt | Đã approve, chưa gửi HĐ |
| Chờ ký HĐ | Đã gửi HĐ, chưa ký |
| Đã ký HĐ | HĐ đã ký, chờ gửi QR |
| QR đã gửi | Sẵn sàng check-in |
| Checked-in | Đã check-in tại sự kiện |
| Hoàn thành | Admin đã xác nhận làm đủ |
| Waitlist | Hết slot, đang chờ |
| Từ chối | Đã bị từ chối |
| Huỷ | Đã huỷ |

### 4.2 Duyệt đăng ký

**Duyệt từng người:**
1. Nhấn icon ✅ trên hàng CTV → trạng thái chuyển sang **Đã duyệt**
2. Hoặc nhấn tên → mở panel chi tiết → nhấn **"Duyệt"**

**Duyệt hàng loạt:**
1. Tick chọn nhiều CTV
2. Nhấn **"Duyệt"** trên thanh bulk action

**Từ chối:**
1. Nhấn icon ❌ → bắt buộc nhập lý do từ chối
2. Hệ thống gửi email thông báo cho CTV

### 4.3 Chi tiết đăng ký (Detail Panel)

Nhấn tên CTV để mở panel bên phải, gồm 3 tab:

**Tab Thông tin:**
- Họ tên, email, SĐT, ngày sinh, CCCD
- Ảnh CCCD (mặt trước/sau) — có thể click xem to
- Ảnh đại diện
- Toàn bộ câu trả lời form đăng ký
- Ghi chú admin (chỉnh sửa được)
- Lịch sử trạng thái

**Tab Hợp đồng:**
- Số HĐ, trạng thái, ngày ký
- Link xem/tải PDF hợp đồng
- Nút gửi/gửi lại HĐ

**Tab Thanh toán:**
- Trạng thái thanh toán
- Giá trị nghiệm thu
- Nút đánh dấu đã thanh toán (chỉ được nhấn khi đã ký biên bản)
- Lịch sử payment

### 4.4 Thêm nhân sự thủ công

Dùng khi CTV không tự đăng ký qua web:

1. Nhấn **"Thêm thủ công"**
2. Chọn vai trò
3. Điền thông tin bắt buộc (tên, email, SĐT)
4. CTV được tạo ngay với trạng thái **Đã duyệt**

---

## 5. Hợp đồng

### 5.1 Gửi hợp đồng

**Gửi cho 1 người:**
- Vào chi tiết CTV → tab Hợp đồng → **"Gửi hợp đồng"**

**Gửi hàng loạt:**
1. Tab **"Đã duyệt"** → tick chọn → **"Gửi hợp đồng"**
2. Hoặc trong trang Roles → nút **"Gửi HĐ cho tất cả"** bên cạnh vai trò

> Hệ thống tự động điền thông tin CTV + số HĐ vào template. CTV nhận email với link ký HĐ.

### 5.2 Theo dõi trạng thái HĐ

| Trạng thái | Ý nghĩa |
|-----------|---------|
| Chưa gửi | HĐ chưa được gửi |
| Đã gửi | CTV nhận email nhưng chưa ký |
| Đã ký | CTV đã ký, PDF được lưu |
| Hết hạn | Link ký đã quá hạn |

### 5.3 Sau khi CTV ký

Hệ thống tự động:
- Tạo PDF có chữ ký, lưu lên S3
- Cập nhật trạng thái → **Đã ký HĐ**
- Admin gửi QR: Vào chi tiết → **"Gửi QR check-in"** → trạng thái chuyển **QR đã gửi**

---

## 6. Check-in / Scan QR

### 6.1 Scan bằng webcam

**Đường dẫn:** `team-management/[id]/scan`

1. Mở trang Scan trên thiết bị có camera
2. Nhấn **"Bật camera"**
3. Hướng QR code của CTV vào khung
4. Hệ thống tự nhận diện và check-in

**Kết quả hiển thị:**
- ✅ Xanh: Check-in thành công — hiện tên, vai trò, thời điểm
- ⚠️ Vàng: CTV đã check-in trước đó
- ❌ Đỏ: Token không hợp lệ hoặc CTV chưa được duyệt

### 6.2 Nhập thủ công

Dán link status hoặc token của CTV vào ô tìm kiếm → nhấn Enter để check-in.

### 6.3 Lịch sử phiên scan

Màn hình Scan hiển thị 10 check-in gần nhất trong phiên làm việc.

---

## 7. Nghiệm thu (Biên bản)

> **Tính năng này chỉ hoạt động** khi sự kiện bật **"Bắt buộc Nghiệm thu"** trong Settings.

### 7.1 Quy trình tổng quan

```
Admin xác nhận "Hoàn thành" → Gửi biên bản nghiệm thu
→ CTV ký biên bản tại crew.5bib.com → Thanh toán được mở khoá
```

### 7.2 Các trạng thái biên bản

| Trạng thái | Ý nghĩa |
|-----------|---------|
| not_ready | CTV chưa hoàn thành hoặc biên bản chưa được gửi |
| pending_sign | Đã gửi, chờ CTV ký |
| signed | CTV đã ký — thanh toán được mở |
| disputed | Admin đánh dấu tranh chấp — CTV không ký được cho đến khi gửi lại |

### 7.3 Gửi biên bản

**Gửi cho 1 người:**
1. Nhấn **"Gửi biên bản"** bên cạnh tên CTV
2. Kiểm tra giá trị thù lao (mặc định = thù lao/ngày × số ngày làm)
3. Chỉnh giá trị nếu cần
4. Xác nhận → CTV nhận email

**Gửi hàng loạt:**
1. Tick chọn nhiều CTV trong tab "Sẵn sàng gửi"
2. Nhấn **"Gửi biên bản hàng loạt"**
3. Nhập giá trị mặc định → có thể override từng người

### 7.4 Xử lý tranh chấp

Khi CTV phản ánh thông tin sai:
1. Nhấn **"Đánh dấu tranh chấp"** (Dispute)
2. Nhập lý do (VD: "Số tiền không đúng, cần điều chỉnh từ 1,500,000 → 1,800,000")
3. CTV nhận thông báo và thấy lý do tranh chấp
4. Admin chỉnh lại giá trị → gửi lại biên bản mới → CTV ký lại

### 7.5 Force thanh toán (Bypass)

> **Chỉ dùng khi thực sự cần thiết** — hành động này được ghi lại đầy đủ trong audit log.

Trong trường hợp không thể chờ CTV ký biên bản (VD: đã chuyển khoản tay):
1. Vào chi tiết CTV → tab Thanh toán
2. Nhấn **"Force thanh toán"**
3. Bắt buộc nhập lý do ≥ 10 ký tự
4. Xác nhận

---

## 8. Thanh toán

**Điều kiện đánh dấu "Đã thanh toán":**
- Nếu event bật Nghiệm thu: CTV **bắt buộc** phải ký biên bản trước
- Nếu event tắt Nghiệm thu: Admin đánh dấu bất kỳ lúc nào sau khi hoàn thành

**Cách đánh dấu:**
1. Vào chi tiết CTV → tab Thanh toán
2. Nhấn **"Đánh dấu đã thanh toán"**
3. Xác nhận → CTV nhận email thông báo

**Đánh dấu hàng loạt:**
1. Lọc tab "Hoàn thành" + filter đã ký biên bản
2. Tick chọn → **"Đánh dấu đã TT"**

---

## 9. Teams & Trạm

> Tính năng Teams giúp nhóm các vai trò thành các đội vận hành (VD: "Đội Đích", "Đội Y tế") và phân công trạm làm việc. Dành cho sự kiện lớn nhiều nhóm.

### 9.1 Tạo Team

**Đường dẫn:** `team-management/[id]/teams`

1. Nhấn **"Thêm team"**
2. Điền: Tên, Slug (auto-tạo), Màu đại diện, Mô tả
3. Vào trang team → tab **"Roles"** → gán vai trò vào team

### 9.2 Tạo Trạm (Station)

**Đường dẫn:** `team-management/[id]/teams/[teamId]/stations`

1. Nhấn **"Thêm trạm"**
2. Điền: Tên trạm, Địa điểm, GPS (lat/lng)
3. Nhấn **"Phân công nhân sự"** → chọn CTV từ danh sách đã duyệt
4. CTV được phân công sẽ thấy trạm của họ trên trang status cá nhân

### 9.3 Kế hoạch vật tư

**Đường dẫn:** `team-management/[id]/supply-items`

- Thêm vật tư cấp event (áo, nước, thiết bị...)
- Vào từng team → tab **"Supply"** → phân bổ số lượng cho team
- Team leader có thể cập nhật trạng thái nhận vật tư qua trang status của họ

---

## 10. Import & Export

### 10.1 Import đăng ký từ file

**Đường dẫn:** `team-management/[id]/registrations` → **"Nhập từ file"**

1. Tải template XLSX mẫu (nút **"Tải template"**)
2. Điền thông tin vào file Excel
3. Upload file → hệ thống **Preview** trước khi import
4. Kiểm tra các hàng hợp lệ / hàng lỗi
5. Nhấn **"Xác nhận import"** → dữ liệu được lưu

> File tối đa 2MB. Chỉ hỗ trợ `.xlsx` và `.csv`.

### 10.2 Export nhân sự

**Đường dẫn:** `team-management/[id]/registrations` → **"Xuất file"**

- Export theo bộ lọc hiện tại (tab + search)
- File Excel đầy đủ tất cả cột: thông tin cá nhân, trạng thái, HĐ, check-in, thanh toán

---

## 11. Template Hợp đồng & Biên bản

**Đường dẫn:** `team-management/contract-templates`

### 11.1 Tạo / Chỉnh template

1. Nhấn **"Template mới"** hoặc chỉnh sửa template có sẵn
2. Điền:
   - Tên template
   - Nội dung HTML (có hỗ trợ editor trực quan)
   - Thông tin Bên A (công ty, địa chỉ, MST, người đại diện, chức vụ)

### 11.2 Placeholder có thể dùng trong nội dung

| Placeholder | Giá trị điền vào |
|-------------|----------------|
| `{{full_name}}` | Họ tên CTV |
| `{{phone}}` | Số điện thoại |
| `{{email}}` | Email |
| `{{address}}` | Địa chỉ |
| `{{birth_date}}` | Ngày sinh |
| `{{cccd_number}}` | Số CCCD |
| `{{cccd_issue_date}}` | Ngày cấp CCCD |
| `{{cccd_issue_place}}` | Nơi cấp CCCD |
| `{{bank_account_number}}` | Số tài khoản ngân hàng |
| `{{bank_name}}` | Tên ngân hàng |
| `{{contract_number}}` | Số hợp đồng (tự động) |
| `{{sign_date}}` | Ngày ký |
| `{{role_name}}` | Tên vai trò |
| `{{event_name}}` | Tên sự kiện |
| `{{daily_rate}}` | Thù lao/ngày |
| `{{working_days}}` | Số ngày làm |
| `{{total_compensation}}` | Tổng thù lao |
| `{{acceptance_value}}` | Giá trị biên bản nghiệm thu |
| `{{acceptance_value_words}}` | Số tiền bằng chữ |

### 11.3 Import từ DOCX

1. Nhấn **"Import từ DOCX"**
2. Upload file `.docx`
3. Hệ thống tự convert nội dung sang HTML
4. Kiểm tra preview → lưu
