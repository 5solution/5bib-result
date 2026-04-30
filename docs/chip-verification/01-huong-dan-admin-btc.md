# Hướng Dẫn Sử Dụng — Chip Verification (Admin / BTC)

**Cho ai:** Quản trị viên 5BIB / Ban tổ chức race
**Cập nhật:** 2026-04-30 · v1.2 Pilot
**Sản phẩm:** Hệ thống xác thực RFID chip ↔ BIB tại Bàn 2 racekit

---

## 🎯 Tóm Tắt 30 Giây

Tính năng này giúp BTC **xác nhận đúng VĐV nhận racekit** bằng cách quẹt RFID chip thay vì tra cứu giấy/Excel. Khi VĐV đến Bàn 2:

1. Quẹt chip RFID gắn trên BIB
2. Màn hình kiosk hiện ngay tên + số BIB + cự ly
3. NV xác nhận → giao racekit

**Tiết kiệm:** ~4.000 VNĐ/VĐV no-show (không phải in lại racekit) · Pilot 3500 athletes = ~14M VNĐ/race.

---

## 🛠️ Chuẩn Bị Trước Race Day (T-7 ngày → T-1 ngày)

### Bước 1 — Lấy file CSV chip ↔ BIB từ nhà cung cấp chip

File CSV phải có **2 cột** đúng tên:

```
chip_id,bib_number
Y-359,90009
Y-360,90010
Y-361,90074
...
```

**Quy tắc:**
- ✅ `chip_id`: 4-32 ký tự, chữ in hoa + số + dấu `-` `_` (VD: `Y-359`, `E2003412`, `CHIP-001-A`)
- ✅ `bib_number`: 1-32 ký tự, chữ + số + `-` `_` (VD: `90009`, `1234`, `A-001`)
- ❌ KHÔNG dấu cách, ký tự đặc biệt, dấu tiếng Việt
- ❌ KHÔNG bắt đầu bằng `=` `+` `@` `'` (Excel coi là công thức)
- ✅ Tối đa **5.000 dòng/file**, **5MB**. Race lớn hơn → chia nhiều file nhỏ.

### Bước 2 — Lấy `mysql_race_id` của race trên platform 5BIB

⚠️ **Quan trọng:** Race trên admin 5BIB-result (URL có ID dài như `69f2ca611e1147680ebea4c6`) **KHÁC** với race ID trên platform 5bib (số như `192`). Phải nhập tay.

**Cách tìm `mysql_race_id`:**

- Hỏi team kỹ thuật/dev
- Hoặc xem trong dashboard 5bib-platform admin
- Hoặc liên hệ 5BIB on-call: **dev1@5bib.com** / Slack `#race-day`

---

## 📋 Quy Trình End-to-End (5 bước, ~10 phút)

### Bước 1 — Mở trang Chip Verify cho race

1. Đăng nhập admin: `https://result-admin.5bib.com`
2. Vào **Races** → chọn race của bạn
3. Trên header race detail, click button **📡 Chip Verify** (cạnh button "Sửa kết quả")

```
┌─────────────────────────────────────────────────────────┐
│  ← Race List                                            │
│                                                          │
│  HA GIANG TRAIL 2026             [Live]                 │
│  ha-giang-trail-2026                                    │
│                                                          │
│                          [📡 Chip Verify] [✏️ Sửa kết quả]│
└─────────────────────────────────────────────────────────┘
```

### Bước 2 — Link race admin với MySQL race_id

Lần đầu vào trang sẽ thấy **form Link**:

```
┌─────────────────────────────────────────────────────────┐
│  Link race admin sang MySQL platform                    │
│                                                          │
│  ⚠️ Race admin (Mongo) và race trên platform           │
│     5bib_platform_live (MySQL) là 2 hệ thống            │
│     tách biệt. Nhập tay mysql_race_id để link.          │
│                                                          │
│  MySQL race_id: [____192_____]                          │
│  Race admin Mongo ID: 69f2ca611e1147680ebea4c6          │
│                                                          │
│  [ Link race ]                                          │
└─────────────────────────────────────────────────────────┘
```

- Nhập số `mysql_race_id` (VD `192`) → click **Link race**
- ✅ Sau khi link OK, page chuyển sang giao diện chính

### Bước 3 — Import CSV chip ↔ BIB

Scroll xuống section **"Import CSV chip ↔ BIB"**:

```
┌─────────────────────────────────────────────────────────┐
│  📥 Import CSV chip ↔ BIB                              │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  │  Kéo thả file CSV vào đây hoặc                 │   │
│  │  [ Chọn file ]                                  │   │
│  │                                                 │   │
│  │  Format: chip_id, bib_number · Tối đa 5,000   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Drag-drop file** hoặc click "Chọn file" → chọn file CSV
- Hệ thống **preview** ngay (chưa lưu DB):

```
┌─────────────────────────────────────────────────────────┐
│  Total rows  │  Valid  │ To create │ To update │ Skip │  │
│     3007    │   3007  │   3007    │     0     │   0  │  │
│                                                          │
│  ⚠️ X mapping cũ sẽ bị soft-delete khi confirm         │
│     (nếu có swap chip-BIB)                              │
│                                                          │
│  [✅ 3007 dòng OK]                                      │
│  [⚠️ 12 cảnh báo: BIB chưa có trong athletes table]    │
│                                                          │
│  [ Confirm import 3007 mapping ]  [ Cancel ]            │
└─────────────────────────────────────────────────────────┘
```

- Kiểm tra số liệu, nếu OK → click **Confirm import**
- ✅ Banner xanh: "Đã import X mapping"

### Bước 4 — GENERATE token kiosk URL

Scroll lên section **"Verify token & kiosk URL"**:

```
┌─────────────────────────────────────────────────────────┐
│  🔑 Verify token & kiosk URL              [Disabled]    │
│                                                          │
│  Total mappings: 3,007                                  │
│  Cache ready: ⚠️ Not loaded                             │
│                                                          │
│  [ GENERATE token ]                                     │
└─────────────────────────────────────────────────────────┘
```

- Click **GENERATE token** → backend sinh token + tự động preload cache (~30s)
- **URL kiosk hiện ra MỘT LẦN DUY NHẤT:**

```
┌─────────────────────────────────────────────────────────┐
│  ✅ Kiosk URL — copy NGAY (chỉ hiện 1 lần)             │
│                                                          │
│  https://result.5bib.com/chip-verify/                   │
│  oluG-z7nvlPopT_hjyn9LEp2exVtBCwn                      │
│                                                          │
│  [ Copy URL ]   [ Đã lưu, đóng ]                       │
│                                                          │
│  ⚠️ KHÔNG share URL công khai — bất kỳ ai có URL       │
│     đều quẹt được.                                      │
└─────────────────────────────────────────────────────────┘
```

- ⚠️ **COPY URL NGAY** → lưu vào ghi chú riêng (Notion/Slack DM)
- URL này sẽ KHÔNG hiện lại — nếu mất phải **ROTATE** sinh token mới

### Bước 5 — Share URL cho NV Bàn 2

- **Cách an toàn:** gửi URL qua Slack DM hoặc Zalo cá nhân cho từng NV
- **In QR code** (dùng tools như qrserver.com hoặc qr-code-generator.com) → dán lên iPad/laptop Bàn 2
- ⚠️ KHÔNG đăng URL lên kênh public, group chat lớn

---

## 📊 Monitor Real-time Ngày Race

Trang admin có **Stats card** tự refresh 10 giây:

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ TOTAL        │ VERIFIED     │ ATTEMPTS     │ LAST 5 MIN   │
│ 3,007        │ 1,234        │ 1,289        │ 67           │
│ Chip↔BIB     │ Distinct ✓   │ Tổng         │ Velocity     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Cách đọc:**
- **TOTAL**: tổng mapping đã import (luôn = số chip)
- **VERIFIED**: số VĐV đã đến Bàn 2 (distinct, không count duplicate quẹt)
- **ATTEMPTS**: tổng lượt quẹt (bao gồm trùng)
- **LAST 5 MIN**: tốc độ hiện tại — nếu > 50/min nghĩa là đông VĐV đến

**Khi nào cần lo:**
- VERIFIED < 50% TOTAL sau 4h race day → có thể có vấn đề (NV quên quẹt, kiosk lỗi)
- ATTEMPTS / VERIFIED > 2 → nhiều lần quẹt trùng → kiosk có thể lag
- LAST 5 MIN = 0 trong 30 phút → kiosk có thể offline → check NV

---

## 🚨 Emergency — Rollback Khẩn Cấp Ngày Race

Nếu **kiosk lỗi nặng** không xử lý được:

1. Vào trang Chip Mappings
2. Section "Verify token & kiosk URL" → click **DISABLE**
3. Confirm dialog: "Tất cả kiosk Bàn 2 sẽ mất kết nối ngay lập tức. Tiếp tục?"
4. ✅ Click **Disable verify**

→ Tất cả URL kiosk trả 401 trong < 1ms. NV Bàn 2 chuyển sang **manual checkin** (giấy/Excel).

**Khôi phục sau sự cố:** GENERATE lại token mới, share URL mới cho NV.

---

## ❌ Common Errors + Cách Xử Lý

### CSV import báo lỗi nhiều dòng

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `Invalid chip_id format (expected 4-32 alphanumeric)` | chip_id có dấu cách / dấu đặc biệt | Mở Excel, kiểm tra cột chip_id, xóa khoảng trắng |
| `Formula injection detected` | chip_id bắt đầu bằng `=`, `+`, `@`, `'` | Đổi sang dấu khác hoặc thêm chữ vào đầu |
| `Duplicate chip_id` | 1 chip_id xuất hiện 2 lần trong CSV | Xóa dòng trùng |
| `Duplicate bib_number` | 1 BIB gán cho 2 chip khác nhau | Sửa CSV — 1 BIB chỉ map 1 chip |
| `BIB not yet in athletes table` (cảnh báo vàng) | BIB chưa được gán VĐV trên platform | OK — vẫn import, kiosk sẽ trả `BIB_UNASSIGNED` khi quẹt |
| `CSV exceeds 5,000 rows` | File quá lớn | Chia thành 2-3 file nhỏ và import lần lượt |
| `Empty file` hoặc `Missing required column` | File sai format | Kiểm tra header phải là `chip_id,bib_number` (chữ thường) |

### Race chưa link

**Lỗi:** Trang chỉ hiện form Link, không thấy Import CSV
**Fix:** Nhập đúng `mysql_race_id` (số nguyên, VD `192`) → click Link race

### Token expired (preview)

**Lỗi:** Sau khi click "Confirm import" → "Preview expired or invalid"
**Fix:** Preview chỉ valid 10 phút. Upload CSV lại → preview mới → confirm ngay.

### Kiosk URL không mở được

| Triệu chứng | Fix |
|-------------|-----|
| URL trả 404 | Token format sai — copy lại URL từ admin |
| URL trả 401 "Invalid or revoked" | Token đã bị ROTATE/DISABLE — sinh token mới |
| URL trả 429 "Too Many Requests" | NV quẹt quá nhanh > 60/phút — chờ 1 phút hoặc liên hệ dev tăng limit |

### Cache "Not loaded" sau GENERATE

- Lý do: preload chưa xong (~30 giây)
- Refresh trang sau 1 phút → Cache: ✅ Ready
- Nếu vẫn "Not loaded" sau 5 phút: click **Refresh cache** trong section Redis cache

---

## 🔄 Khi Nào Cần ROTATE Token?

ROTATE = sinh token mới, **token cũ chết NGAY** (< 1ms). Mọi kiosk Bàn 2 đang chạy mất kết nối.

**Use cases:**
- 🚨 Token bị leak ra public (nhân viên upload nhầm Slack public)
- 🔄 Đổi ca làm việc cuối ngày — sinh token mới cho ca tối
- ⚠️ Race tổ chức nhiều ngày — rotate giữa các ngày

**Quy trình:**
1. Click **ROTATE** (button cạnh DISABLE)
2. Confirm dialog hiện token mới
3. Copy URL mới → share cho NV Bàn 2
4. **Đảm bảo NV refresh page** với URL mới — nếu không sẽ thấy "Token revoked"

---

## ❓ FAQs

**Q: Tôi có thể edit mapping sau khi import không?**
A: Có. Trong table mappings, click **Edit** trên row cần sửa → đổi chip_id / bib_number / status (ACTIVE ↔ DISABLED) → Save.

**Q: Tôi soft-delete mapping rồi có khôi phục được không?**
A: Hiện tại UI chưa có nút restore. Soft-delete thực sự chỉ ẩn khỏi danh sách, data vẫn còn. Liên hệ dev nếu cần khôi phục.

**Q: 1 race có thể có nhiều token cùng lúc không?**
A: Không. Mỗi race chỉ có 1 token active. Nếu cần share cho nhiều ca/người, mỗi người dùng cùng URL.

**Q: Athlete đã nhận racekit ngày hôm trước (qua Bàn 1 cũ), hôm nay đến Bàn 2 quẹt chip thì sao?**
A: Hệ thống đọc field `racekit_received` từ MySQL → trả `ALREADY_PICKED_UP` (vàng) → NV biết đã nhận, không giao thêm.

**Q: Có chip không quẹt được, làm sao?**
A: Check màu kết quả:
- Đỏ (`CHIP_NOT_FOUND`) → chip này chưa import lên hệ thống
- Vàng (`BIB_UNASSIGNED`) → chip có nhưng BIB chưa gán VĐV
- Xám (`DISABLED`) → chip bị BTC disable manual

**Q: Cron tự động sync 30s là gì?**
A: Hệ thống tự đồng bộ data athlete từ MySQL platform mỗi 30 giây. BTC không cần làm gì — tự chạy ngầm.

**Q: Race day kết thúc cần làm gì?**
A: Click **DISABLE** để clear cache + token → giảm load Redis. Stats vẫn lưu để báo cáo sau.

---

## 📞 Liên Hệ Hỗ Trợ Race Day

- **On-call BE Dev**: dev1@5bib.com · Slack `#race-day` · ZNS `0901xxxxxx`
- **DevOps**: devops@5bib.com
- **PO/Danny**: danny@5bib.com (escalation only)

**Trước khi gọi:** chuẩn bị
- URL admin chip-mappings page
- Số `mysql_race_id`
- Screenshot lỗi (nếu có)
- Số chip / BIB cụ thể đang lỗi
