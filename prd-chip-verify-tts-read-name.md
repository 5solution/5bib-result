# PRD — Đọc Tên VĐV Khi Quẹt Chip (Text-to-Speech)

**Version:** 1.0
**Ngày:** 2026-04-30
**Author:** PO Agent
**Status:** Draft — chờ Danny approve

---

## 📝 TTS Read Name on Chip Verify

**Goal:** Khi NV Bàn 2 quẹt chip RFID và hệ thống tìm được VĐV (FOUND), kiosk tự đọc to "BIB [số], [tên VĐV]" bằng giọng tiếng Việt, giúp NV xác nhận với VĐV mà không cần nhìn màn hình.

**Scope:**

- ✅ In scope: Thêm TTS vào kiosk page (`/chip-verify/[token]`), đọc BIB + tên khi FOUND, toggle bật/tắt TTS trên UI
- ❌ Out of scope: Đọc tên cho các trạng thái khác (NOT_FOUND, ALREADY_PICKED_UP…), cloud TTS (Google/Amazon), pre-recorded audio, backend changes

---

## 👤 User Stories & Business Rules

### User Stories

- As a **NV Bàn 2**, I want kiosk đọc to BIB và tên VĐV khi quẹt chip thành công so that tôi có thể xác nhận với VĐV mà không cần quay mặt nhìn màn hình, tăng tốc độ giao racekit.
- As a **NV Bàn 2**, I want bật/tắt chức năng đọc tên so that khi chỗ quá ồn (không nghe được) hoặc loa hỏng thì tôi tắt đi cho đỡ rối.

### Business Rules

- BR-01: Chỉ đọc tên khi result = `FOUND` (xanh). Tất cả trạng thái khác (ALREADY_PICKED_UP, CHIP_NOT_FOUND, BIB_UNASSIGNED, DISABLED) giữ nguyên tiếng beep/buzz hiện tại, KHÔNG đọc.
- BR-02: Nội dung đọc: `"BIB [bib_number], [athlete_name]"`. Ví dụ: `"BIB 90009, Phạm Dương"`.
- BR-03: Nếu `athlete_name` rỗng hoặc null → chỉ đọc `"BIB [bib_number]"`, không đọc tên.
- BR-04: Khi NV quẹt chip mới trong lúc đang đọc tên cũ → cancel utterance cũ ngay, đọc tên mới. Không bao giờ có 2 utterance chồng nhau.
- BR-05: TTS mặc định BẬT sau khi click "Bắt đầu". NV có thể toggle tắt/bật bất kỳ lúc nào.
- BR-06: Trạng thái toggle TTS lưu trong `sessionStorage` — refresh page giữ nguyên lựa chọn của NV trong session đó. Không persist cross-session.
- BR-07: TTS chạy SAU tiếng beep thành công (chuông cao). Thứ tự: scan → API response → beep sound → TTS speak. Không thay thế beep.
- BR-08: Nếu browser không hỗ trợ `window.speechSynthesis` (edge case cũ) → tự động ẩn toggle TTS, feature degrade gracefully, không báo lỗi.

---

## 🖥️ UI/UX Flow

### Thay đổi trên Kiosk Page — Route: `/chip-verify/[token]`

**Thay đổi 1 — Toggle TTS trên header bar:**

```
┌─────────────────────────────────────────────────────────────┐
│  5BIB Chip Verify    [Bàn2-T1]   [🔊 TTS ✓]  [🔊 Sẵn sàng] │
└─────────────────────────────────────────────────────────────┘
```

- Thêm toggle `[🔊 TTS ✓]` bên trái badge "Sẵn sàng"
- Click toggle → đổi thành `[🔇 TTS ✗]` (muted icon + text)
- Toggle chỉ hiện SAU khi NV click "Bắt đầu" (audio unlocked)
- Toggle chỉ hiện khi `window.speechSynthesis` tồn tại

**Thay đổi 2 — Flow khi quẹt chip result = FOUND:**

```
Hiện tại:  scan → API call → beep ♪ → hiện athlete card xanh
Sau thay đổi: scan → API call → beep ♪ → TTS "BIB 90009, Phạm Dương" → hiện athlete card xanh
```

- Athlete card hiện ngay cùng lúc với TTS (không chờ TTS đọc xong)
- TTS đọc ngầm, UI không block

**Thay đổi 3 — Không thay đổi gì cho các trạng thái khác:**

- ALREADY_PICKED_UP → vẫn 2 beep ngắn, KHÔNG đọc tên
- CHIP_NOT_FOUND → vẫn 3 buzz trầm, KHÔNG đọc
- BIB_UNASSIGNED → vẫn 1 buzz dài, KHÔNG đọc
- DISABLED → vẫn 3 buzz trầm, KHÔNG đọc

### States

- **Browser không hỗ trợ SpeechSynthesis:** Toggle TTS ẩn hoàn toàn. Feature không tồn tại. Mọi thứ khác giữ nguyên.
- **TTS bật + quẹt FOUND:** Beep → Speak tên → Card xanh hiện
- **TTS tắt + quẹt FOUND:** Beep → Card xanh hiện (như hiện tại)
- **Quẹt nhanh liên tiếp:** Cancel utterance cũ → Speak tên mới

---

## 🛠️ Technical Mandates (For Coder Agent)

### DB Changes

**KHÔNG CÓ.** Feature này 100% frontend. Không thay đổi MongoDB, MySQL, hay Redis.

### Backend — NestJS

**KHÔNG CÓ.** Không endpoint mới, không thay đổi response DTO. Data `bib_number` và `athlete_name` đã có sẵn trong response của API verify chip hiện tại.

### Frontend — Kiosk Page (Public Frontend)

**File cần sửa:** Component kiosk chip-verify (file chứa logic xử lý scan result và play sound)

**1. Tạo utility function `speakAthlete`:**

```typescript
// Đặt trong file util riêng hoặc inline trong component
function speakAthlete(bib: string, name: string | null): void {
  if (!window.speechSynthesis) return;
  
  // Cancel bất kỳ utterance đang chạy
  window.speechSynthesis.cancel();
  
  const text = name 
    ? `BIB ${bib}, ${name}` 
    : `BIB ${bib}`;
    
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'vi-VN';
  utterance.rate = 1.1;      // Hơi nhanh, phù hợp môi trường ồn
  utterance.volume = 1.0;
  utterance.pitch = 1.0;
  
  window.speechSynthesis.speak(utterance);
}
```

**2. Thêm state `ttsEnabled`:**

```typescript
// 'use client' component
const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
  if (typeof window === 'undefined') return true;
  const saved = sessionStorage.getItem('chip-verify-tts');
  return saved !== null ? saved === 'true' : true; // default ON
});

// Persist toggle
useEffect(() => {
  sessionStorage.setItem('chip-verify-tts', String(ttsEnabled));
}, [ttsEnabled]);

// Check browser support
const [ttsSupported, setTtsSupported] = useState(false);
useEffect(() => {
  setTtsSupported('speechSynthesis' in window);
}, []);
```

**3. Gọi `speakAthlete` sau beep trong handler scan result:**

```typescript
// Trong callback xử lý scan result
if (result.status === 'FOUND') {
  playBeepSuccess();  // beep hiện tại — giữ nguyên
  
  if (ttsEnabled && ttsSupported) {
    speakAthlete(result.bib_number, result.athlete_name);
  }
}
// Các case khác giữ nguyên logic beep/buzz hiện tại
```

**4. Render toggle UI:**

```tsx
{audioUnlocked && ttsSupported && (
  <button
    onClick={() => setTtsEnabled(prev => !prev)}
    className="..."
    aria-label={ttsEnabled ? 'Tắt đọc tên' : 'Bật đọc tên'}
  >
    {ttsEnabled ? '🔊 TTS ✓' : '🔇 TTS ✗'}
  </button>
)}
```

**5. Cleanup on unmount:**

```typescript
useEffect(() => {
  return () => {
    window.speechSynthesis?.cancel();
  };
}, []);
```

### PAUSE before coding

- Không có PAUSE. Feature này không chạm DB, không chạm auth, không cài dependency mới, không thay đổi API response. Coder tự code và test được.

---

## 🛡️ Testing Mandates (For QC Agent)

### Happy Path

1. Mở kiosk URL trên Chrome → click "Bắt đầu"
2. Verify toggle `[🔊 TTS ✓]` hiện trên header bar
3. Quẹt chip có mapping FOUND → nghe beep thành công → nghe giọng đọc "BIB 90009, Phạm Dương" bằng tiếng Việt
4. Athlete card xanh hiện đồng thời (không chờ TTS xong)

### Unhappy Paths — Must Write Tests

- [ ] **TTS tắt:** Toggle TTS off → quẹt FOUND → chỉ nghe beep, KHÔNG nghe giọng đọc. Verify `speechSynthesis.speak()` không được gọi.
- [ ] **Tên rỗng:** Quẹt chip có BIB nhưng `athlete_name = null` → giọng chỉ đọc "BIB 90009", không crash, không đọc "null" hay "undefined".
- [ ] **Quẹt nhanh liên tiếp (< 1 giây giữa 2 lần):** Quẹt chip A (FOUND) → ngay lập tức quẹt chip B (FOUND) → giọng KHÔNG đọc chồng. Utterance A bị cancel, chỉ nghe tên B.
- [ ] **Trạng thái khác FOUND:** Quẹt chip CHIP_NOT_FOUND → chỉ nghe buzz, KHÔNG có giọng đọc. Tương tự cho ALREADY_PICKED_UP, BIB_UNASSIGNED, DISABLED.
- [ ] **Browser không hỗ trợ:** Mock `window.speechSynthesis = undefined` → toggle TTS không hiện trên UI → quẹt FOUND chỉ có beep, không error trong console.
- [ ] **Refresh page:** Toggle TTS off → refresh page → click "Bắt đầu" lại → toggle vẫn ở trạng thái OFF (đọc từ sessionStorage).
- [ ] **Session mới (đóng tab + mở lại):** Toggle TTS off → đóng tab → mở URL mới → TTS default ON (sessionStorage cleared).

### Security Checks

- Không endpoint mới → không có security check bổ sung.
- Feature chỉ chạy client-side, không gửi data ra ngoài.

### Performance SLA

- `speakAthlete()` phải return trong < 10ms (non-blocking, chỉ queue vào speechSynthesis). TTS thực tế mất 1-3 giây nhưng KHÔNG block UI.
- `speechSynthesis.cancel()` phải chạy trước `speak()` mỗi lần — verify không có memory leak khi quẹt 500 chip liên tiếp.
- Toggle state read/write sessionStorage: < 1ms, synchronous.

---

## 📋 Checklist Trước Khi Deploy

- [ ] Test trên Chrome Windows (laptop BTC thường dùng)
- [ ] Test trên Chrome macOS
- [ ] Test trên Safari iPad (nếu BTC dùng iPad)
- [ ] Verify voice `vi-VN` available trên từng platform — nếu không có voice VN thì fallback im lặng (không đọc tiếng Anh)
- [ ] Test với loa ngoài jack 3.5mm (setup thực tế Bàn 2)
- [ ] Test 50 chip liên tiếp trong 2 phút — không leak, không chồng giọng
- [ ] Verify beep vẫn hoạt động bình thường khi TTS bật/tắt

---

## 📌 Notes

**Tại sao chọn Web Speech API thay vì Cloud TTS:**
- Zero cost (miễn phí, browser built-in)
- Zero latency (không cần gọi API, không phụ thuộc internet cho phần TTS)
- Zero backend change (100% frontend)
- Chất lượng voice `vi-VN` trên Chrome đủ tốt cho mục đích xác nhận tên
- Nếu sau pilot cần chất lượng cao hơn → upgrade lên Google Cloud TTS (PRD riêng)

**Effort estimate:** ~2-4 giờ code + test. Không cần review backend. Chỉ cần FE dev.
