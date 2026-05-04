# HDSD — Timing Alert (Trang theo dõi VĐV mất tín hiệu)

> **Đối tượng:** BTC điều hành race day, marshal trưởng, ops.
> **KHÔNG cần đọc nếu bạn là dev** — đây là tài liệu vận hành.

---

## 1. Trang này dùng để làm gì

Khi VĐV chạy qua một checkpoint, chip RFID gắn trên BIB sẽ được đọc và RaceResult API ghi lại thời gian đó. Có khi chip không được đọc — pin yếu, đeo sai vị trí, anten lỗi, hoặc VĐV thực sự không qua điểm đó.

Trang **Timing Alert** quét data RaceResult mỗi vài chục giây và **flag những trường hợp nghi ngờ** để BTC kiểm tra. Đây **chỉ là cảnh báo** — không phải tự động kết luận DSQ. BTC vẫn là người ra quyết định cuối.

---

## 2. Ba trạng thái của một alert

| Trạng thái | Ý nghĩa | Khi nào xuất hiện |
|------------|---------|-------------------|
| **OPEN** | Mới phát hiện, đang chờ xử lý | Hệ thống vừa flag |
| **RESOLVED** | Đã đóng — không còn vấn đề | (a) Hệ thống tự đóng khi chip backup đọc được time muộn, hoặc (b) BTC click **Resolve** sau khi xác minh VĐV thật đã qua |
| **FALSE_ALARM** | Cảnh báo sai | BTC click **False alarm** khi xác nhận VĐV không liên quan miss chip (VĐV bỏ cuộc, DSQ chính thức, đã đăng ký nhưng không tham gia, v.v.) |

> Một alert đã RESOLVED hoặc FALSE_ALARM **vẫn có thể Reopen** lại nếu BTC lỡ tay.

---

## 3. Hai loại miss và cách phân biệt

Không phải tất cả miss đều giống nhau. Hệ thống phân 2 loại theo độ tin cậy:

### Loại A — Chip miss giữa course (đậm chắc)

> Hiển thị tag: **MIDDLE_GAP**

VĐV đã có time tại checkpoint **sau** điểm miss. Ví dụ:

```
Course 21K: Start → TM1 → TM2 → TM3 → TM4 → Finish
VĐV 9899:   ✓     ✓    ✓    ❌    ✓
                            ↑
                   chip TM3 fail thật
```

Vì VĐV không thể "teleport" qua TM4, **chắc chắn đã đi qua TM3** — chip TM3 fail. Confidence rất cao. BTC chỉ cần verify với marshal TM3 rồi click **Resolve**.

### Loại B — Phantom (chậm bất thường, dự đoán)

> Hiển thị tag: **PHANTOM** (cũng là loại VĐV "biến mất")

VĐV có time tại checkpoint cuối (vd TM2), **chưa thấy** ở checkpoint kế tiếp (TM3), và đã chậm hơn pace dự kiến quá ngưỡng. Đây là **cảnh báo dự đoán**, có nguy cơ:

- VĐV nghỉ ăn / đi vệ sinh quá lâu — không phải chip miss
- VĐV bỏ cuộc giữa đường nhưng chưa báo BTC — DNF
- VĐV gặp sự cố cần cứu hộ — gọi marshal!
- Chip TM3 thật sự lỗi và VĐV vẫn đang chạy bình thường

→ BTC **bắt buộc** liên hệ marshal CP kế tiếp trước khi quyết định. Đừng Resolve khi chưa xác minh.

---

## 4. Bốn mức severity (mức độ ưu tiên)

| Mức | Khi nào | Ưu tiên xử lý |
|-----|---------|----------------|
| **CRITICAL** (đỏ) | VĐV trong Top N (config) hoặc Top N của age group đang miss | **Ngay lập tức** — ảnh hưởng podium |
| **HIGH** (cam) | VĐV trong Top 10 | Trong vòng 5 phút |
| **WARNING** (vàng) | Bất kỳ ai miss Finish | Trong vòng 10 phút |
| **INFO** (xanh) | Miss giữa course nhưng không phải elite | Có thể đợi auto-resolve |

> **Nếu CRITICAL nhiều bất thường (>50 alert)** → kiểm tra config **Top N** ở trang Config trước. Set quá rộng (vd 50) sẽ biến CRITICAL thành noise.

---

## 5. Quy trình xử lý 1 alert (race day)

Khi mở 1 alert lên, BTC thấy: BIB, tên, age group, course, **last seen** (CP cuối có time), **missing point** (CP nghi miss), **projected finish** (giờ dự kiến về đích).

Quy trình 4 bước:

1. **Đọc thông tin** trên alert card. Đặc biệt chú ý CP cuối VĐV được thấy.
2. **Gọi marshal** tại CP miss và CP kế tiếp — hỏi VĐV có đi qua không, có cần cứu hộ không.
3. **Quyết định:**
   - Marshal xác nhận VĐV đã đi qua → click **Resolve** kèm note "Marshal xác nhận"
   - Marshal xác nhận VĐV đã bỏ cuộc / DNF → click **False alarm** kèm note "DNF tại km..."
   - Marshal không thấy VĐV → escalate cứu hộ, giữ alert OPEN, gọi y tế
   - Chưa rõ → **đợi 1-2 cycle (1-3 phút)** để hệ thống tự re-check. Nếu chip backup đọc được, alert tự RESOLVED.
4. **Ghi note** đầy đủ — sau race, audit log dùng để giải quyết khiếu nại.

---

## 6. Ba ô config — set như thế nào

> Cài tại tab **Config** của race. Cần restart cycle (đợi 60s) để áp dụng.

### Poll interval (giây) — tần suất check

Cứ N giây, hệ thống fetch data mới từ RaceResult API.

| Set | Khi nào dùng |
|-----|--------------|
| **60–90s** | **Race day** — alert update gần real-time |
| 180s | Trước race day, lúc kit pickup |
| 300s | Idle — không có VĐV chạy |

### Overdue threshold (phút) — buffer chống false alarm

VĐV chạy chậm hơn pace dự kiến **bao nhiêu phút** thì mới flag PHANTOM. Đây là "lề khoan dung" — không thì cứ ai chậm vài phút là báo loạn.

| Set | Loại race phù hợp |
|-----|-------------------|
| **20–30 phút** | Road race phẳng, half / marathon đường nhựa |
| 30–60 phút | Half-trail, có dốc nhẹ |
| **60–120 phút** | Trail/mountain, ultra — pace biến động lớn theo địa hình |

> Set quá thấp (<10 phút) → noise nhiều. Set quá cao (>180 phút) → bỏ sót cứu hộ.

### Top N → CRITICAL — định nghĩa "podium"

VĐV có rank dự đoán **≤ N** (overall hoặc trong age group) sẽ được tính CRITICAL khi miss.

| Set | Hiệu ứng |
|-----|----------|
| **3 (recommended)** | Chỉ podium 1-2-3 → CRITICAL. Sạch, BTC focus được. |
| 5–10 | Race có giải nhì-ba phụ, mở rộng đến top 10 |
| 20+ | **KHÔNG nên** — biến CRITICAL thành noise đại trà |
| 50 | **Sai, tránh** — gặp lúc nào đó CRITICAL sẽ tới hàng trăm |

### Enable monitoring (checkbox)

ON = race nằm trong list được poll.
OFF = pause hoàn toàn — **không poll, không tạo alert mới**, alert OPEN có sẵn vẫn giữ nguyên.

> **Cảnh báo:** Tắt giữa race day = BTC sẽ KHÔNG nhận push CRITICAL. Chỉ tắt khi emergency thực sự (vd RaceResult API down, để giảm spam log).

---

## 7. Tình huống thường gặp (FAQ)

### VĐV mất chip TM3, sau 2 tiếng mới đến TM3 — BTC làm gì?
Không cần làm gì. Khi chip backup đọc được time TM3, hệ thống tự đóng alert sau 1 cycle (≤60s). Alert chuyển sang tab **RESOLVED** với note "Auto-resolved: TM3 time appeared = HH:MM:SS".

### VĐV mất TM3 nhưng xuất hiện ở TM4 — phải xử lý sao?
Alert sẽ tự "leo cấp" từ PHANTOM → MIDDLE_GAP (chip miss thật). BTC nên:
1. Gọi marshal TM3 verify → nếu xác nhận VĐV qua, click **Resolve**.
2. Nếu marshal xác nhận VĐV bỏ cuộc → click **False alarm**.

### CRITICAL count cao bất thường (vài trăm) — bug hay đúng?
Đa số là do **Top N → CRITICAL set quá cao**. Vào Config, kiểm tra giá trị này:
- Set 50 → mọi VĐV trong top 50 miss đều CRITICAL → ngập noise
- Đổi xuống 3-5 → CRITICAL count rớt về vài chục

### Alert đã Resolved 30 phút trước nhưng vẫn thấy trên trang?
Refresh trang. Nếu vẫn còn → kiểm tra tab filter (đang ở **OPEN** hay **RESOLVED**?).

### VĐV không xuất hiện sau 1 tiếng kể từ alert đầu tiên — emergency?
Có thể. Ưu tiên:
1. Liên hệ marshal CP gần nhất ngay
2. Gọi điện/SMS cho VĐV nếu có số đăng ký
3. Triển khai team y tế đi rà CP miss → CP kế tiếp
4. Giữ alert OPEN, đừng resolve cho tới khi tìm thấy người

### Click Resolve nhầm — có undo được?
Vào tab **RESOLVED**, mở alert, click **Reopen** (hoặc tương đương). Audit log ghi lại mỗi lần đổi trạng thái.

---

## 8. Đừng quên

- Alert KHÔNG phải DSQ tự động. Đó là **tín hiệu để điều tra**.
- Chỉ Resolve khi đã verify với marshal. Resolve bừa = sai dữ liệu kết quả race.
- False alarm dùng cho VĐV thật sự không liên quan miss chip (DNF/DSQ chính thức). KHÔNG dùng để "xoá cho gọn".
- Khi nhiều CRITICAL → kiểm tra **Top N config** trước khi panic.
- Mọi action có audit log — không sợ lỡ tay, có thể truy vết.

---

## 9. Liên hệ khi sự cố

- **Alert toàn race biến mất** → Dev (có thể vendor RaceResult API down hoặc monitoring bị tắt)
- **Số liệu CRITICAL/WARNING không khớp với danh sách hiển thị** → Dev (bug pagination hoặc cache)
- **Phải reset toàn bộ alert giữa race day** → Dev (không thể reset khi race đang `live`, cần đổi status hoặc bypass)
- **Cấu hình mới không apply** → Đợi 1-2 cycle (60-90s). Vẫn không apply → Dev.
