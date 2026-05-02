# 5BIB Racekit Check-in + Chip Verification Tool

> **Date:** 29/04/2026
> **Scope:** Tool cho đội ngũ 5BIB tại điểm phát racekit
> **Mục đích:** Tự chủ toàn bộ flow phát racekit + verify chip mà KHÔNG CẦN RaceResult ở bước này

---

## 1. Vấn đề hiện tại

Khi VĐV được gán BIB tại chỗ (case "gán BIB sau"), hệ thống bị tịt ở bước quét chip:

```
❌ Flow cũ (bị tịt):
VĐV quẹt chip → Reader đọc Chip ID → Hệ thống hỏi RaceResult "chip này là ai?"
                                        → RaceResult: "Không biết, chưa đẩy data lên"
                                        → TỊT — không hiển thị được thông tin VĐV
```

**Nguyên nhân:** Data chip↔BIB↔VĐV phải được đẩy lên RaceResult trước thì mới đọc được. Nhưng việc đẩy lên RaceResult tốn phí 4,000 VNĐ/VĐV và chỉ nên đẩy VĐV thật sự tham gia.

---

## 2. Giải pháp: 5BIB tự xử lý, không cần RaceResult

```
✅ Flow mới (5BIB tự chủ):
VĐV quẹt chip → Reader đọc Chip ID → Hệ thống hỏi DB 5BIB "chip này là ai?"
                                        → 5BIB DB: "Chip 0012A34F = BIB 1001 = Nguyễn Văn A, 21km"
                                        → HIỂN THỊ ngay — không cần RaceResult
```

**Data đã có trong 5BIB DB:**
- VĐV đăng ký → 5BIB/5Ticket lưu thông tin (tên, cự ly, team...)
- BIB được gán (trước hoặc tại chỗ) → 5BIB DB cập nhật ngay
- File mapping Chip ID ↔ BIB → upload trước vào hệ thống

→ **Đủ data để tự lookup, không phụ thuộc RaceResult.**

---

## 3. Flow chi tiết — 2 bàn, 4 bước

### Bàn 1: Phát Racekit (Nhân sự 5BIB)

```
STEP 1                              STEP 2
VĐV đến, đưa mã QR 5BIB    →     Nhân sự quét QR
                                         │
                              ┌──────────┴──────────┐
                              │                      │
                        Có BIB sẵn?            Chưa có BIB?
                              │                      │
                              ▼                      ▼
                        Đưa BIB cho VĐV       Gán BIB mới
                                               → DB 5BIB update:
                                                 VĐV X = BIB 1001
                              │                      │
                              └──────────┬───────────┘
                                         ▼
                              Mark "Đã nhận racekit"
                              trên hệ thống 5BIB
                                         │
                              VĐV cầm BIB + racekit
                              đi qua bàn 2
```

### Bàn 2: Check Chip (Verify chip đúng BIB đúng người)

```
STEP 3                              STEP 4
VĐV cầm BIB (đã gắn chip)   →    Quẹt vào RFID reader
đến bàn check chip                       │
                                          ▼
                              Reader đọc Chip ID: "0012A34F"
                              (Keyboard emulation → gõ vào browser)
                                          │
                                          ▼
                              Hệ thống lookup:
                              ┌───────────────────────┐
                              │ Chip ID "0012A34F"     │
                              │      ↓ (mapping table) │
                              │ BIB = 1001             │
                              │      ↓ (5BIB DB)       │
                              │ Nguyễn Văn A           │
                              │ Cự ly: 21km            │
                              │ Team: ABC              │
                              └───────────────────────┘
                                          │
                                          ▼
                              Màn hình hiển thị:
                              ┌───────────────────────┐
                              │ ✅ BIB #1001           │
                              │ NGUYỄN VĂN A          │
                              │ 21km | Team ABC        │
                              │ → Chip hợp lệ ✓       │
                              └───────────────────────┘
```

**Mục đích Step 3-4:** Xác nhận chip trên BIB hoạt động + đúng người. VĐV nhìn lên màn hình thấy tên mình → yên tâm chip OK.

---

## 4. Data Sources — Tất cả đã có trong 5BIB

| Data | Source | Khi nào có |
|------|--------|-----------|
| Thông tin VĐV (tên, cự ly, team, phone) | 5BIB/5Ticket DB (MongoDB) | Lúc đăng ký |
| BIB number | 5BIB DB — gán trước hoặc gán tại chỗ (Step 2) | Trước race hoặc lúc phát racekit |
| Chip ID ↔ BIB mapping | File CSV/Excel upload trước | BTC/5BIB gắn chip vào BIB trước event |
| Trạng thái "Đã nhận racekit" | 5BIB DB — update ở Step 2 | Lúc phát racekit |

### Chip Mapping — Ai chuẩn bị, khi nào?

**Quy trình gắn chip vào BIB:**
1. BTC/5BIB nhận lô chip RFID (mỗi chip có ID duy nhất in trên chip hoặc đọc bằng reader)
2. Gắn chip lên từng tấm BIB (dán hoặc may)
3. Trong quá trình gắn: scan chip → ghi nhận Chip ID + số BIB → tạo file mapping

**File mapping format:**
```csv
chip_id,bib
0012A34F,1001
0012A35G,1002
00FF3B21,1003
```

**Upload lên đâu:**
- Phương án B (standalone): import CSV vào tool trước khi bắt đầu
- Phương án A (web app): upload CSV qua admin → lưu MongoDB collection `chip_mappings`

---

## 5. Hai phương án triển khai

### Phương án B: Standalone Web Page (KHUYẾN NGHỊ CHO MVP)

**Cách hoạt động:**
1. Mở 1 file HTML trên browser
2. Import CSV mapping (chip↔BIB)
3. Import CSV hoặc gọi API 5BIB để lấy danh sách VĐV
4. Quẹt chip → lookup local → hiển thị

**Ưu điểm:** Nhanh build (1-2 ngày), chạy offline, không cần deploy backend mới.

**Nhược điểm:** Data VĐV phải export CSV trước. Nếu Step 2 gán BIB mới tại chỗ → tool ở bàn 2 không tự biết (phải refresh/re-import).

**Giải pháp sync giữa bàn 1 và bàn 2:**
- Bàn 1 gán BIB trên hệ thống 5BIB (admin) → DB update
- Bàn 2 tool gọi API 5BIB real-time khi quẹt chip: `GET /api/race-results?raceId=X&bib=1001`
- Hoặc: bàn 2 tool poll API 5BIB mỗi 30 giây để refresh danh sách VĐV

→ **Hybrid approach tốt nhất:** Chip mapping load từ CSV (static), athlete data fetch từ API 5BIB (real-time).

### Phương án A: Full Integration vào hệ thống 5BIB

**Cách hoạt động:**
1. Upload chip mapping qua admin 5BIB
2. Mở trang check chip trong admin hoặc public frontend
3. Quẹt chip → backend lookup (MongoDB) → SSE broadcast → display

**Ưu điểm:** Real-time sync hoàn toàn, multi-device, persistent data.

**Nhược điểm:** Cần build backend endpoints, cần internet ổn định.

---

## 6. Technical Spec — Hybrid Approach (Recommended)

### Architecture

```
                     RFID Reader (USB, keyboard emulation)
                              │
                              ▼
┌──────────────────────────────────────────────────┐
│  Browser — Chip Verification Page                 │
│                                                   │
│  ┌─────────────────────────┐                     │
│  │ Chip Mapping (from CSV) │ ← loaded at start   │
│  │ Map<chipId, bib>        │                     │
│  └─────────────────────────┘                     │
│              │                                    │
│              ▼ chipId → bib                       │
│  ┌─────────────────────────┐                     │
│  │ Fetch athlete info      │ ← real-time API call│
│  │ GET /api/5bib/athlete   │                     │
│  │ ?raceId=X&bib=1001      │                     │
│  └─────────────────────────┘                     │
│              │                                    │
│              ▼                                    │
│  ┌─────────────────────────┐                     │
│  │ Display athlete info    │                     │
│  │ + add to stacking list  │                     │
│  └─────────────────────────┘                     │
└──────────────────────────────────────────────────┘
```

**Chip mapping:** Load từ CSV (static, chuẩn bị trước)
**Athlete info:** Fetch real-time từ 5BIB API/DB (dynamic, bao gồm cả VĐV vừa gán BIB tại chỗ ở bàn 1)

### API cần dùng (đã có hoặc cần thêm)

| API | Có chưa | Trả về |
|-----|---------|--------|
| `GET /api/race-results?raceId=X&bib=1001` | ✅ Đã có | Athlete info: tên, cự ly, team, rank... |
| `GET /api/races/:raceId/athletes?bib=1001` | ❓ Cần check | Thông tin đăng ký VĐV (có thể dùng 5Ticket data) |

→ **Nếu API đã có:** Tool chỉ cần fetch, zero backend work.
→ **Nếu cần endpoint mới:** 1 endpoint đơn giản, lookup by raceId + bib, trả về name/distance/team.

### UI — Bàn Check Chip (Step 3-4)

```
┌─────────────────────────────────────────────────────────┐
│  🏃 5BIB — KIỂM TRA CHIP              VietJungle 2026  │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Quẹt chip RFID...                              │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌── KẾT QUẢ ──────────────────────────────────────┐    │
│  │                                                  │    │
│  │   ✅  CHIP HỢP LỆ                               │    │
│  │                                                  │    │
│  │   BIB #1001                                     │    │
│  │   NGUYỄN VĂN A                                  │    │
│  │   Cự ly: 21km  |  Team: ABC                    │    │
│  │                                                  │    │
│  │   Chip ID: 0012A34F                             │    │
│  │   Thời gian: 08:30:15                           │    │
│  │                                                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  📊 Đã verify: 1,234 / 3,000                            │
│                                                          │
├── LỊCH SỬ ──────────────────────────────────────────────┤
│  08:30:15  #1001  Nguyễn Văn A    21km  ✅              │
│  08:29:42  #1002  Trần Thị B     42km  ✅              │
│  08:28:10  ????   CHIP KHÔNG TÌM THẤY   ❌             │
│  08:27:33  #1004  Phạm Thị D     21km  ✅              │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

**Display riêng cho VĐV nhìn (nếu có màn hình lớn):**

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│              ✅ CHIP VERIFIED                        │
│                                                      │
│              BIB #1001                               │
│              NGUYỄN VĂN A                            │
│              21km — Team ABC                         │
│                                                      │
│              Chúc bạn thi đấu thành công! 🏃        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

Font lớn, VĐV đứng xa vẫn đọc được. Tự clear sau 5 giây, chờ người tiếp theo.

### Edge Cases

| Case | Xử lý |
|------|-------|
| **Chip quẹt nhưng không có trong mapping** | "CHIP KHÔNG TÌM THẤY" — có thể chip gắn nhầm hoặc chưa upload mapping |
| **Chip tìm được BIB nhưng BIB chưa có ai** | "BIB 1001 CHƯA ĐƯỢC GÁN CHO VĐV NÀO" — bàn 1 chưa gán xong |
| **Chip đã verify rồi** | "VĐV NÀY ĐÃ VERIFY LÚC 08:15" — cảnh báo nhưng vẫn hiện info |
| **API 5BIB timeout/lỗi** | Fallback: hiện BIB number + "Đang tải thông tin..." + retry |
| **VĐV quẹt quá nhanh** | Debounce 2 giây: cùng chip trong 2 giây → ignore |

### Tín hiệu âm thanh

| Trạng thái | Âm thanh |
|------------|---------|
| Verify thành công | Beep ngắn 1 tiếng (tông cao) |
| Chip không tìm thấy | Beep 3 tiếng nhanh (tông thấp) |
| Đã verify rồi | Beep 2 tiếng (tông trung) |

---

## 7. Giá trị tổng thể cho 5BIB

| Benefit | Chi tiết |
|---------|---------|
| **Tự chủ flow phát racekit** | Không phụ thuộc RaceResult ở bước check-in/verify |
| **Tiết kiệm chi phí** | Chỉ đẩy VĐV đã verify lên RaceResult → tiết kiệm 4,000 VNĐ/VĐV no-show |
| **Xử lý gán BIB tại chỗ** | VĐV gán BIB tại bàn 1 → bàn 2 verify ngay nhờ read real-time từ DB 5BIB |
| **Trải nghiệm VĐV** | Quẹt chip → thấy tên mình → yên tâm chip OK |
| **Data traceability** | Biết chính xác ai đã lấy racekit, ai no-show, lúc nào |

---

## 8. Workflow sau khi verify xong → đẩy lên RaceResult

```
Check-in + Verify hoàn tất
         │
         ▼
Export danh sách VĐV đã verify
(với Chip ID + BIB + thông tin)
         │
         ▼
Import vào RaceResult
(manual CSV hoặc API tự động)
         │
         ▼
RaceResult tính giờ race day
(chỉ có VĐV thật sự tham gia)
         │
         ▼
5BIB lấy results từ RaceResult API
         │
         ▼
Hiển thị trên result.5bib.com
```

---

## 9. PAUSE Items

| # | Item | Impact |
|---|------|--------|
| 1 | **API 5BIB nào dùng cho lookup?** Đã có endpoint lookup VĐV by raceId + bib chưa? | Cần check |
| 2 | **Chip mapping upload ở đâu?** Import CSV trên tool hay upload qua admin 5BIB? | UX |
| 3 | **Case gán BIB tại chỗ:** Bàn 1 gán BIB trên hệ thống nào? Admin 5BIB? 5Ticket? | Sync |
| 4 | **Giải pilot?** Giải nào gần nhất để test? | Deadline |
| 5 | **Offline fallback?** Cần hoạt động khi không có internet? | Architecture |
| 6 | **Muốn build luôn không?** Tao có thể viết tool (HTML + JS) ngay session này | Timing |
