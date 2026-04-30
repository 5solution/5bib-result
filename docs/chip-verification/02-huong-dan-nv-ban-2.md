# Hướng Dẫn NV Bàn 2 — Quẹt Chip Giao Racekit

**Cho ai:** Nhân viên trạm BTC ngày race tại Bàn 2 (giao racekit)
**Cập nhật:** 2026-04-30 · v1.2 Pilot

---

## ⚡ Tóm Tắt 1 Câu

VĐV đến → quẹt chip RFID → màn hình hiện tên + BIB + cự ly → giao racekit nếu **xanh ✅**, hỏi lại nếu **vàng ⚠️**, từ chối nếu **đỏ ❌**.

---

## 🛠️ Chuẩn Bị Thiết Bị

| Thiết bị | Mô tả | Số lượng |
|----------|-------|---------:|
| **Laptop hoặc iPad** | Chrome/Safari mới nhất, kết nối WiFi BTC | 1 / station |
| **USB RFID reader** | Model 125kHz HID keyboard emulation (VD: ThaiNguyen RFID, ZBox-T9) | 1 / station |
| **Loa nhỏ / loa cắm jack 3.5mm** | Để nghe tiếng beep khi quẹt | 1 / station |
| **Cáp sạc** | Laptop nên cắm sạc liên tục | — |

**Setup phần cứng (BTC làm sẵn):**
1. Cắm RFID reader vào USB → Windows/macOS auto detect như "USB HID Keyboard"
2. Cắm loa nhỏ vào jack 3.5mm
3. Mở Chrome/Safari → đặt browser ở chế độ **fullscreen (F11)** hoặc kiosk mode

---

## 🚀 Quy Trình Mở Đầu Ngày Race

### Bước 1 — Mở URL kiosk

BTC đã gửi URL qua Slack/Zalo, dạng:

```
https://result.5bib.com/chip-verify/oluG-z7nvlPopT_hjyn9LEp2exVtBCwn
```

Hoặc **scan QR code** dán trên iPad/laptop.

### Bước 2 — Click "Bắt đầu" để kích hoạt âm thanh

Lần đầu mở trang sẽ thấy:

```
┌─────────────────────────────────────────────────┐
│                                                  │
│           Sẵn sàng hoạt động?                   │
│                                                  │
│   Nhấn nút bên dưới để kích hoạt âm thanh +    │
│   bắt đầu nhận RFID.                            │
│                                                  │
│              [ Bắt đầu ]                        │
│                                                  │
└─────────────────────────────────────────────────┘
```

- ✅ Click **Bắt đầu** → màn hình hiện badge "🔊 Sẵn sàng" góc phải
- 🔇 Nếu KHÔNG nghe tiếng beep khi quẹt: kiểm tra loa cắm chưa, click "Bắt đầu" lại

### Bước 3 — Test thử 1 chip

Cắm RFID reader → quẹt 1 chip mẫu → màn hình phải hiện athlete card xanh trong < 3 giây.

**Nếu lỗi:** thấy CHIP_NOT_FOUND đỏ → liên hệ BTC kiểm tra chip đã import chưa.

---

## 📡 Quy Trình Quẹt Chip Cho Mỗi VĐV

### Cách 1 — Dùng RFID reader (chính)

1. VĐV chìa BIB có gắn chip
2. NV quẹt reader gần BIB (< 5cm) → reader tự gửi chip ID
3. Màn hình hiện athlete card → đọc to **BIB + Tên** xác nhận với VĐV
4. Tùy result:
   - **Xanh ✅ FOUND** → giao racekit, nói "Cảm ơn anh/chị"
   - **Vàng ⚠️ ALREADY_PICKED_UP** → nói "Anh/chị đã nhận racekit trước rồi, kiểm tra lại nhé"
   - **Đỏ ❌ CHIP_NOT_FOUND** → nói "Chip này chưa có trong hệ thống, anh/chị qua bàn BTC chính kiểm tra"
   - **Vàng ⚠️ BIB_UNASSIGNED** → nói "BIB này chưa gán VĐV, anh/chị qua bàn đăng ký kiểm tra"

### Cách 2 — Gõ tay (backup khi RFID hỏng)

Trong ô input giữa màn hình:

```
┌─────────────────────────────────────────────────┐
│  Quẹt RFID hoặc gõ chip ID                      │
│                                                  │
│  RFID reader cắm USB sẽ tự gửi → không cần     │
│  click vào ô bên dưới                           │
│                                                  │
│       ┌──────────────────────────┐              │
│       │  VD: Y-359               │  [ Quẹt ]   │
│       └──────────────────────────┘              │
└─────────────────────────────────────────────────┘
```

- Gõ chip ID hiển thị trên BIB (VD `Y-359`) + nhấn **Enter** hoặc click **Quẹt**

---

## 🚦 5 Trạng Thái Kết Quả — Cách Đọc

### ✅ FOUND (Xanh) — "GIAO RACEKIT"

```
┌─────────────────────────────────────────────────┐
│ ✅  GIAO RACEKIT                                │
│                                                  │
│ BIB                                              │
│   90009                                          │
│                                                  │
│ Tên: Phạm Dương                                 │
│ Cự ly: 21KM       Team: HCM Trail Club          │
│ Racekit: Chưa nhận                              │
└─────────────────────────────────────────────────┘
```

🔊 Tiếng: **chuông cao 1 lần** (đẹp, dễ nghe)
✋ Hành động: **Giao racekit ngay**, ghi tên vào sổ ký nhận nếu BTC yêu cầu.

### ⚠️ ALREADY_PICKED_UP (Vàng cam)

```
┌─────────────────────────────────────────────────┐
│ ⚠️  ĐÃ NHẬN RACEKIT                             │
│                                                  │
│ BIB                                              │
│   90009                                          │
│                                                  │
│ Tên: Phạm Dương                                 │
│ Racekit: Đã nhận                                │
└─────────────────────────────────────────────────┘
```

🔊 Tiếng: **2 tiếng beep ngắn**
✋ Hành động: VĐV đã nhận racekit ngày trước (Bàn 1 hoặc check-in sớm). **KHÔNG giao thêm**. Hỏi lý do quẹt lại — có thể VĐV nhầm hoặc muốn check.

### ❌ CHIP_NOT_FOUND (Đỏ)

```
┌─────────────────────────────────────────────────┐
│ ❌  CHIP KHÔNG CÓ TRONG HỆ THỐNG                │
│                                                  │
│ BIB:  —                                          │
│ Tên:  —                                          │
└─────────────────────────────────────────────────┘
```

🔊 Tiếng: **3 tiếng buzz trầm**
✋ Hành động: Chip này chưa được import lên hệ thống. **Hướng VĐV qua bàn BTC chính** để tra cứu manual.

### ⚠️ BIB_UNASSIGNED (Vàng nhạt)

```
┌─────────────────────────────────────────────────┐
│ ⚠️  BIB CHƯA GÁN VĐV — KIỂM TRA LẠI            │
│                                                  │
│ BIB:  90009                                      │
│ Tên:  —                                          │
└─────────────────────────────────────────────────┘
```

🔊 Tiếng: **1 tiếng buzz dài**
✋ Hành động: Chip có trong hệ thống nhưng BIB chưa gán VĐV cụ thể. Hướng VĐV qua **bàn đăng ký** kiểm tra thông tin.

### 🚫 DISABLED (Xám)

🔊 Tiếng: **3 tiếng buzz trầm** (giống NOT_FOUND)
✋ Hành động: Chip bị BTC disable thủ công (có thể chip lỗi, BIB transfer). Hướng VĐV qua **bàn BTC chính**.

---

## 📊 Trang Kiosk Có Gì Khác Trên Màn Hình?

```
┌─────────────────────────────────────────────────────────────┐
│  5BIB Chip Verify              [Bàn2-T1]   [🔊 Sẵn sàng]  │
│  Quẹt RFID để xác nhận nhận racekit                         │
│                                                              │
│  ┌─────────┬─────────┬─────────┬─────────┐                 │
│  │ ĐÃ      │ TỔNG    │ TIẾN    │ 5 PHÚT  │                 │
│  │ VERIFY  │         │ ĐỘ      │ QUA     │                 │
│  │ 1,234   │ 3,007   │  41%    │  67     │                 │
│  └─────────┴─────────┴─────────┴─────────┘                 │
│                                                              │
│  [Athlete card hoặc ô input ở đây]                         │
│                                                              │
│  Lịch sử 20 lần quẹt gần nhất                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 14:23  90009  Phạm Dương · 21KM            [OK]      │  │
│  │ 14:22  90015  Trần Vinh · 42KM             [OK]      │  │
│  │ 14:22  90099  —                       [CHƯA GÁN]    │  │
│  │ ...                                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- **Stats** (4 ô vuông trên cùng): tự update mỗi 30 giây
- **Lịch sử 20 lần quẹt gần nhất**: tự update mỗi 5 giây — có thể dùng để check VĐV vừa qua hay chưa

---

## 🆘 Xử Lý Lỗi Tại Chỗ

### "RFID reader quẹt nhưng không thấy gì xảy ra"

1. Kiểm tra badge **🔊 Sẵn sàng** ở góc phải — chưa có thì click "Bắt đầu" lại
2. Click bất kỳ chỗ nào trên page (browser cần focus)
3. Thử quẹt 1 chip khác — có thể chip này hỏng vật lý
4. Cuối cùng: gõ tay chip ID vào ô input để test

### "Mất internet"

- Tab xuất hiện **biểu tượng "⚠️ Lỗi mạng"** + nút "Đóng"
- Click "Đóng" → chờ mạng phục hồi → quẹt lại
- Nếu mất mạng > 5 phút: liên hệ BTC để **chuyển sang manual checkin** tạm thời

### "VĐV phàn nàn quẹt rồi nhưng kiosk báo CHIP_NOT_FOUND"

1. Đọc lại số chip in trên BIB của VĐV
2. Gõ tay vào ô input (VD `Y-359`) → nếu vẫn không có thì chip thật sự chưa import
3. Hướng VĐV qua **bàn BTC chính** với note "Chip không có trong hệ thống Bàn 2"

### "Quẹt chip nhưng tên hiển thị KHÔNG đúng"

- Trường hợp BTC nhập sai mapping CSV → chip này gán nhầm BIB → hướng VĐV qua bàn BTC để kiểm tra
- Báo BTC để **EDIT mapping** trên admin

### "Tab tự reload / mất trạng thái"

Kiosk tự refresh data ngầm — không reload page. Nếu page tự reload (do laptop sleep, network drop), cần click **"Bắt đầu"** lại để bật âm thanh.

---

## 📋 Báo Cáo Cuối Ngày Race

Trước khi đóng máy, ghi lại các số liệu từ stats card:

```
🗓️ Ngày: 2026-05-02
🏁 Race: HA GIANG TRAIL 2026
🪪 Bàn 2 - Trạm: Bàn2-T1

📊 Số liệu:
  - TỔNG (Total mappings): _________
  - ĐÃ VERIFY (Verified athletes): _________
  - ATTEMPTS (Total attempts): _________
  - TIẾN ĐỘ (Verified %): _________ %

⚠️ Bất thường (nếu có):
  - Số VĐV bị CHIP_NOT_FOUND: _________
  - Số VĐV bị BIB_UNASSIGNED: _________
  - Sự cố kỹ thuật: _________________

✍️ NV trực: _________________
✍️ Ca: _________________ (sáng / chiều / tối)
```

Gửi báo cáo cho BTC qua Slack `#race-day` hoặc email `report@5bib.com`.

---

## 📞 Liên Hệ Khẩn Cấp Ngày Race

| Vấn đề | Liên hệ | Cách |
|--------|---------|------|
| URL kiosk không mở được | BTC chính | Slack `#race-day` |
| Chip / BIB lỗi | BTC bàn đăng ký | Trực tiếp |
| Mất mạng | BTC tech support | Hotline `0901-xxx-xxx` |
| Phần mềm crash / page trắng | 5BIB on-call dev | Slack `#race-day` urgent |

**Mẹo:** chụp ảnh màn hình lỗi gửi kèm message → debug nhanh hơn.

---

## 💡 Tips Cho NV

- 🔊 Để loa âm lượng vừa đủ — quá nhỏ NV không nghe khi đông VĐV, quá to ảnh hưởng VĐV khác
- 🔋 Cắm sạc laptop liên tục — race kéo dài 6-8h
- 🪪 Đeo tag tên rõ ràng để VĐV biết là NV BTC
- 🤝 Khi CHIP_NOT_FOUND, không cãi VĐV — hướng dẫn lịch sự qua bàn khác
- ⏱️ Quẹt 1 chip mất 2-3 giây là bình thường, > 5s thì có thể mạng/cache lỗi → liên hệ
- 🔄 Cuối ca, không cần làm gì, chỉ cần đóng tab. Ca sau dùng URL cũ là OK.
