# Hướng dẫn sử dụng — Trang quảng bá (Promo Hub)

> **Đối tượng:** Đội Marketing / Content / Back-Office Admin của 5BIB
> **Phiên bản:** 1.0 — 2026-05-13
> **Truy cập:** [admin.5bib.com](https://admin.5bib.com) → Sidebar "Nội dung" → **Trang quảng bá**
> **Quyền tối thiểu:** Logto role = `admin` (staff KHÔNG thấy menu này)

---

## 📑 Mục lục

1. [Tổng quan & Khi nào dùng](#1-tổng-quan--khi-nào-dùng)
2. [Khái niệm chính](#2-khái-niệm-chính)
3. [Đăng nhập & Truy cập](#3-đăng-nhập--truy-cập)
4. [Tạo trang quảng bá mới](#4-tạo-trang-quảng-bá-mới)
5. [Editor — kéo thả sections](#5-editor--kéo-thả-sections)
6. [19 loại Section chi tiết](#6-19-loại-section-chi-tiết)
7. [Tab Thiết kế (Theme)](#7-tab-thiết-kế-theme)
8. [Tab SEO](#8-tab-seo)
9. [Tab Analytics](#9-tab-analytics)
10. [Publish & Xem trang public](#10-publish--xem-trang-public)
11. [Best Practices](#11-best-practices)
12. [Use case mẫu — Race promo page](#12-use-case-mẫu--race-promo-page)
13. [Câu hỏi thường gặp](#13-câu-hỏi-thường-gặp)
14. [Liên hệ hỗ trợ](#14-liên-hệ-hỗ-trợ)

---

## 1. Tổng quan & Khi nào dùng

**Trang quảng bá (Promo Hub)** là công cụ tự build landing page trên domain `5bib.com/hub/<slug>` — không cần dev.

### Khi nào MKT cần dùng:

| Use case | Ví dụ slug | Section nên có |
|---|---|---|
| 🏃 Promo 1 giải đấu | `/hub/utmb-2026` | Hero + Countdown + Stats + Schedule + Sponsors + FAQ |
| 🛍️ Affiliate / Linktree clone | `/hub/iracer-shop` | Hero + Social Links + Link Grid (products) + CTA buttons |
| 📅 Lịch giải theo mùa | `/hub/mua-xuan-2026` | Hero + Race Calendar + Featured Races + Form Embed (đăng ký nhận tin) |
| 🎉 Sự kiện đặc biệt | `/hub/marathon-day-2026` | Hero + Video + Image Gallery + Testimonials + Map + Schedule |
| 💼 Đối tác / Sponsor showcase | `/hub/diamond-partners` | Hero + Sponsors + Testimonials + Stats + CTA |
| 📰 Bài content tổng hợp | `/hub/training-tips` | Hero + Rich Text + Video + Image Gallery + CTA |

### So sánh với competitor

| Tính năng | Linktree | addme.vn iRaceticket | **5BIB Promo Hub** |
|---|---|---|---|
| Hero banner | ✅ | ✅ | ✅ |
| Social links | ✅ | ✅ | ✅ |
| Product/shop grid | ❌ | ✅ | ✅ |
| Countdown timer | ❌ | ❌ | ✅ |
| FAQ accordion | ❌ | ❌ | ✅ |
| Video embed | ❌ | ❌ | ✅ |
| Map embed | ❌ | ❌ | ✅ |
| Race calendar auto-sync DB | ❌ | ❌ | ✅ |
| Sponsor logos auto-sync | ❌ | ❌ | ✅ |
| Recent results auto-sync | ❌ | ❌ | ✅ |
| Schedule timeline | ❌ | ❌ | ✅ |
| Click analytics + chart | Plan trả phí | ❌ | ✅ free |
| Domain riêng `5bib.com/hub/*` | Subdomain | Subdomain | **First-party** |

---

## 2. Khái niệm chính

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Hub** | 1 trang quảng bá hoàn chỉnh — gồm nhiều section xếp dọc |
| **Slug** | Phần cuối URL: `5bib.com/hub/<slug>`. Chỉ chữ thường + số + dấu gạch ngang. Ví dụ: `utmb-2026`, `iracer-shop` |
| **Section** | 1 khối nội dung — có 19 loại từ Hero đến Form đăng ký |
| **Status** | `Nháp` (chỉ admin xem) → `Đã đăng` (public hiển thị) → `Lưu trữ` (ẩn không xóa) |
| **Theme** | Màu chính + màu phụ + font — apply cho toàn hub |
| **Schedule section** | 1 section có thể đặt lịch tự ẩn/hiện theo ngày giờ (vd: countdown chỉ show 30 ngày trước race) |
| **Section ẩn (visible=false)** | Section vẫn lưu trong nháp nhưng KHÔNG hiển thị trên public |

---

## 3. Đăng nhập & Truy cập

1. Truy cập **[admin.5bib.com](https://admin.5bib.com)**
2. Đăng nhập Logto với tài khoản có role `admin` (yêu cầu cao hơn `staff`)
3. Sidebar bên trái → nhóm **"Nội dung"** → **"Trang quảng bá"** (icon ✨ Sparkles + badge "NEW")
4. Nếu KHÔNG thấy menu này: bạn chưa được cấp role `admin`. Liên hệ super-admin.

> ⚠️ **Lưu ý quyền truy cập:** Promo Hub là MKT-sensitive (có thể đẩy trang public quy mô lớn). Chỉ `admin` được cấp. Staff khác (vd: Race Ops, Finance) sẽ KHÔNG thấy menu này.

---

## 4. Tạo trang quảng bá mới

### Bước 1: Tạo nháp

1. Vào trang **`/promo-hub`**
2. Bấm nút **"Tạo trang mới"** (góc phải trên)
3. Hệ thống tự động:
   - Tạo hub mới với slug auto: `hub-<timestamp>`
   - Status mặc định: `Nháp`
   - Tiêu đề mặc định: "Trang quảng bá mới"
4. Tự redirect sang trang edit `/promo-hub/<id>`

### Bước 2: Đặt tên + slug

Trong tab **"Nội dung"** → khối "Thông tin chung":

| Trường | Bắt buộc | Hướng dẫn |
|---|---|---|
| **Tiêu đề** | ✅ | Tên hub, hiển thị trên `<title>` browser + Google. VD: "UTMB Việt Nam 2026" |
| **Slug** | ✅ | URL friendly. Chỉ `a-z`, `0-9`, `-`. VD: `utmb-2026`. URL public sẽ là `5bib.com/hub/utmb-2026` |
| **Mô tả ngắn** | ⛔ | Note nội bộ cho admin — KHÔNG hiển thị public |
| **Trạng thái** | ✅ | Nháp / Đã đăng / Lưu trữ |

> 💡 **Slug đã tồn tại?** Sẽ bị error `409 Conflict`. Đổi slug khác và lưu lại.

### Bước 3: Thêm section (xem section 5 + 6)

### Bước 4: Lưu

Bấm **"Lưu thay đổi"** (góc phải trên, có icon Save 💾).

> 💡 **Chưa có autosave** — nhớ bấm Lưu sau khi sửa. Phase 2 sẽ thêm autosave.

---

## 5. Editor — kéo thả sections

### Layout

```
┌─────────────────────────┬──────────────────┐
│  Khối "Thông tin chung" │                  │
│  Tiêu đề / Slug / ...   │   PREVIEW PANE   │
├─────────────────────────┤   (sticky)       │
│  Khối "Các section"     │                  │
│                         │   - Hero         │
│  📌 Section 1 - Hero    │   - Stats        │
│  📌 Section 2 - Stats   │   - CTA          │
│  📌 Section 3 - CTA     │   - ...          │
│                         │                  │
│  + Thêm section         │                  │
└─────────────────────────┴──────────────────┘
```

### Thao tác trên mỗi section card

Hover chuột vào section card → hiện 3 nút bên phải:

| Icon | Chức năng |
|---|---|
| 👁️ **Eye** | Ẩn/hiện section (giữ data nháp, không xóa) |
| ✏️ **Pencil** | Mở dialog config — chỉnh nội dung section |
| 🗑️ **Trash** | Xóa section (xác nhận trước khi xóa) |

### Kéo thả sắp xếp thứ tự

- Drag handle **⋮⋮** (6 chấm dọc) bên trái mỗi card
- Giữ chuột + kéo → thả vào vị trí mới
- Thứ tự công khai sẽ đổi theo

### Thêm section mới

1. Bấm **"+ Thêm section"** dưới list
2. Hiện picker grid với **19 type cards** — chọn loại section muốn thêm
3. Section mới được thêm vào cuối + dialog config tự mở ngay

---

## 6. 19 loại Section chi tiết

### Phase A — Core (9 sections)

#### 6.1. ✨ Hero — Hero banner

**Mục đích:** Banner lớn đầu trang với tiêu đề + CTA chính.

**Cấu hình:**
| Trường | Mô tả | Ví dụ |
|---|---|---|
| Tiêu đề | Heading lớn | "UTMB Việt Nam 2026" |
| Phụ đề | Subtitle dưới tiêu đề | "Giải chạy địa hình lớn nhất Đông Nam Á" |
| Ảnh nền (URL) | URL ảnh full-width. Optional — nếu thiếu sẽ dùng gradient theme | `https://images.unsplash.com/...` |
| Nhãn CTA | Text nút bấm chính | "Đăng ký ngay" |
| URL CTA | Link khi bấm | `https://5bib.com/calendar` |
| Căn lề | Trái / Giữa / Phải | Giữa |

#### 6.2. 📅 Race Calendar — Lịch giải đấu

**Mục đích:** Tự sync danh sách race từ DB, filter theo status.

**Cấu hình:**
- Tiêu đề khối: "Lịch giải sắp tới"
- Số giải hiển thị: 1-20 (mặc định 6)
- Lọc trạng thái: `Sắp diễn ra` / `Đang diễn ra` / `Đã kết thúc`

> 💡 KHÔNG cần nhập race thủ công — backend auto-pull từ Races collection.

#### 6.3. 🏆 Featured Races — Giải nổi bật (curated)

**Mục đích:** Hiển thị các giải cụ thể admin chọn (vs auto-filter như Race Calendar).

**Cấu hình:**
- Race IDs: Paste MongoDB ObjectId mỗi dòng 1 ID (lấy từ admin URL `/races/<id>` khi xem race)

> ⚠️ **Phase 2 sẽ có race picker UI** — hiện tại admin paste raw ObjectId.

#### 6.4. 📣 Promo Banner — Banner ngang full-width

**Mục đích:** Banner ảnh đơn full-width, click link.

**Cấu hình:**
- URL ảnh banner
- Link khi click
- Alt text (SEO + accessibility)

#### 6.5. 🖱️ CTA Buttons — Nút kêu gọi hành động

**Mục đích:** Hàng nút bấm (đăng ký, liên hệ, xem thêm...).

**Cấu hình:**
- Tiêu đề (tùy chọn)
- Danh sách nút: mỗi nút có Nhãn + URL + Variant (Chính / Phụ / Outline)

> 💡 Có thể thêm bao nhiêu nút tùy ý. 2-3 nút là đẹp nhất.

#### 6.6. 🤝 Sponsors — Nhà tài trợ

**Mục đích:** Hiển thị logo sponsor từ Sponsors collection.

**Cấu hình:**
- Tiêu đề khối: "Đối tác đồng hành"
- Hạng nhà tài trợ: chọn 💎 Kim cương / 🥇 Vàng / 🥈 Bạc (có thể chọn nhiều)

> 💡 KHÔNG cần upload logo tại đây — sync tự động từ trang **"Nhà tài trợ"** trong sidebar.

#### 6.7. 📊 Stats — Số liệu thống kê

**Mục đích:** 3-4 ô số nổi bật (Social Proof).

**Cấu hình:**
- Tiêu đề khối
- Items: danh sách `{ label, value }` — VD `{ "VĐV đã tham gia", "94K+" }`

#### 6.8. 📝 Rich Text — Văn bản tự do

**Mục đích:** Khối HTML tự do — giới thiệu, mô tả dài.

**Cấu hình:**
- Tiêu đề
- HTML content (sẽ được backend sanitize trước khi lưu)

> ⚠️ **Phase 2 sẽ có WYSIWYG editor** — hiện tại paste HTML thủ công. Tag được phép: `<p>`, `<strong>`, `<em>`, `<a>`, `<ul>`, `<ol>`, `<li>`, `<h2>`, `<h3>`, `<br>`. Tag bị strip: `<script>`, event handlers (`onclick=...`), `javascript:` URI.

#### 6.9. 🏅 Recent Results — Kết quả gần đây

**Mục đích:** Hiển thị top N finishers của race vừa diễn ra.

**Cấu hình:**
- Tiêu đề
- Race ID: ObjectId của race (lấy từ admin)
- Số kết quả: 1-20

---

### Phase B — Landing-page expansion (10 sections, ship 2026-05-13)

#### 6.10. 🔲 Link Grid — Lưới liên kết (product/shop grid)

**Mục đích:** Card grid hiển thị sản phẩm, shop affiliate, link ngoài. Inspired by iRaceticket pattern.

**Cấu hình:**
- Tiêu đề khối: "Sản phẩm bổ trợ chạy bộ"
- Số cột: 2 / 3 / 4
- Items: mỗi item gồm URL ảnh + Tiêu đề + URL đích khi click

**Use case:** Bán affiliate products (TikTok Shop, Shopee), shop merchandise, app downloads.

#### 6.11. 🔗 Social Links — Mạng xã hội

**Mục đích:** Icon row link tới các MXH/messaging.

**Cấu hình:**
- Tiêu đề (tùy chọn)
- Căn lề
- Links: chọn platform + URL

**Platforms hỗ trợ:** Facebook / Instagram / TikTok / YouTube / Twitter-X / LinkedIn / Telegram / Zalo / Email / Custom

> 💡 Icon brand-correct + màu thương hiệu thật (Facebook xanh, TikTok đen, Zalo xanh Zalo, ...).

#### 6.12. ❓ FAQ — Câu hỏi thường gặp

**Mục đích:** Accordion Q&A — rules, refund policy, transport, BIB pickup, etc.

**Cấu hình:**
- Tiêu đề khối: "Câu hỏi thường gặp"
- Items: mỗi câu gồm Câu hỏi + Trả lời (textarea, support multi-line)

> 💡 Trả lời tự động cách dòng — gõ Enter trong textarea để xuống dòng.

#### 6.13. ⏰ Countdown — Đếm ngược

**Mục đích:** Đếm ngược tới ngày race / sự kiện.

**Cấu hình:**
- Tiêu đề: "Đếm ngược đến giờ G"
- Thời điểm đếm tới: datetime picker
- Thông điệp khi hết hạn: "Sự kiện đã bắt đầu!"

> ⏱️ Counter update mỗi giây real-time. Khi qua thời điểm → tự động hiển thị message hết hạn.

#### 6.14. ▶️ Video Embed — Video nhúng

**Mục đích:** Nhúng YouTube / Vimeo cho promo video / race recap.

**Cấu hình:**
- Tiêu đề (tùy chọn)
- Nhà cung cấp: YouTube / Vimeo
- Video ID hoặc URL: chấp nhận cả 2 dạng
  - YouTube: `dQw4w9WgXcQ` HOẶC `https://www.youtube.com/watch?v=dQw4w9WgXcQ` HOẶC `https://youtu.be/dQw4w9WgXcQ`
  - Vimeo: `123456789` HOẶC `https://vimeo.com/123456789`
- Chú thích dưới video

> 🔒 **Privacy:** YouTube embed dùng `youtube-nocookie.com` domain — không track viewer.

#### 6.15. 🖼️ Image Gallery — Thư viện ảnh

**Mục đích:** Grid ảnh kỷ niệm race / event recap.

**Cấu hình:**
- Tiêu đề
- Số cột: 2 / 3 / 4
- Ảnh: mỗi ảnh gồm URL + Alt text

> 💡 Click ảnh → mở tab mới full size. Phase 2 sẽ thêm lightbox.

#### 6.16. 💬 Testimonial — Cảm nhận

**Mục đích:** Quote từ VĐV / KOL / Influencer (Social Proof).

**Cấu hình:**
- Tiêu đề (tùy chọn)
- Items: mỗi quote gồm Tên + Vai trò + URL avatar (optional) + Nội dung quote

> 💡 Nếu thiếu avatar → tự hiển thị chữ cái đầu tên (vd "N" cho "Nguyễn Văn A").

#### 6.17. 📍 Map Embed — Bản đồ

**Mục đích:** Nhúng Google Maps cho địa điểm race start / venue.

**Cấu hình:**
- Tiêu đề: "Địa điểm xuất phát"
- Google Maps embed URL
- Địa chỉ hiển thị (text fallback)

### Cách lấy Google Maps embed URL:

1. Vào [maps.google.com](https://maps.google.com)
2. Search địa điểm
3. Bấm **"Chia sẻ"** → tab **"Nhúng bản đồ"** → bấm "SAO CHÉP HTML"
4. Trong đoạn `<iframe src="..." ...>` → copy **chỉ phần `src=...`** (URL bắt đầu bằng `https://www.google.com/maps/embed?pb=...`)
5. Paste vào trường "Google Maps embed URL"

> 🔒 **Security:** Backend chỉ chấp nhận URL từ `google.com`, `maps.google.com`, `www.openstreetmap.org`. URL khác sẽ fallback hiển thị text địa chỉ.

#### 6.18. 📋 Schedule Timeline — Lịch trình

**Mục đích:** Timeline race day (mat-bib → line-up → start → award).

**Cấu hình:**
- Tiêu đề: "Lịch trình race day"
- Items: mỗi mốc gồm Thời gian (text vd "04:00") + Tiêu đề + Mô tả

**Ví dụ Marathon race day:**
```
04:00 — Mở cổng nhận BIB — "Tại Race Village, mang theo CCCD"
05:30 — Tập trung khu vực xuất phát — "Warm-up tập thể với HLV"
06:00 — XUẤT PHÁT 100K & 170K — "Wave 1 elite + sub-elite"
07:00 — XUẤT PHÁT 50K — "Wave 2 mass"
14:00 — Lễ trao giải — "Tại sân khấu chính Race Village"
```

#### 6.19. 📧 Form Embed — Form nhúng

**Mục đích:** Form đăng ký nhận tin / lead capture / survey.

**Cấu hình:**
- Tiêu đề: "Đăng ký nhận tin"
- Mô tả ngắn
- Nhà cung cấp:
  - **iframe** — nhúng full form vào trang
  - **link** — chỉ hiển thị CTA button mở form ở tab mới
- Embed URL / Link form

### Providers iframe được phép:

| Platform | URL pattern |
|---|---|
| Google Forms | `https://docs.google.com/forms/...?embedded=true` |
| Google Forms short | `https://forms.gle/...` |
| Tally | `https://tally.so/embed/...` |
| 5BIB Form (nội bộ) | `https://form.5bib.com/...` |
| Microsoft Forms | `https://forms.office.com/...` |

> 🔒 **Security:** URL ngoài whitelist trên sẽ tự fallback sang mode "link" (chỉ CTA button, không iframe).

---

## 7. Tab Thiết kế (Theme)

Apply màu sắc + font cho toàn hub.

| Trường | Mô tả | Default |
|---|---|---|
| **Màu chính** | Primary color (CTA, accent) | `#1d4ed8` (xanh dương) |
| **Màu phụ** | Secondary color (gradient hero) | `#ea580c` (cam) |
| **Font chữ** | CSS font-family | `Be Vietnam Pro, sans-serif` |
| **Layout** | Tiêu chuẩn (1200px) / Gọn (960px) / Rộng (1440px) | Tiêu chuẩn |
| **Custom CSS** | CSS tự custom (sanitize trước khi lưu) | (rỗng) |

> ⚠️ **Custom CSS sẽ được sanitize:** strip `<script>`, event handlers, `javascript:` URIs. Chỉ class selector + property cơ bản.

---

## 8. Tab SEO

Cấu hình cho Google + Facebook share + Twitter Card.

| Trường | Best practice |
|---|---|
| **Meta Title** | ≤60 ký tự để Google hiển thị đủ (max 70). Format: "Tên giải | 5BIB" |
| **Meta Description** | ≤160 ký tự. Mô tả ngắn gọn + CTA. Sẽ hiển thị trên Google snippet + FB link preview |
| **OG Image URL** | Ảnh 1200×630px (.jpg / .png). Hiển thị khi share link lên Facebook / Twitter / Zalo |
| **Canonical URL** | URL chuẩn (vd `https://5bib.com/hub/utmb-2026`). Tránh duplicate content nếu hub có nhiều slug history |

> 💡 **Tip SEO:**
> - Title phải có keyword quan trọng (tên race, "đăng ký", năm)
> - Description phải có CTA + benefit
> - OG image nên có text overlay (vd "UTMB 2026 — Đăng ký ngay") để khi share thấy ngay

---

## 9. Tab Analytics

Hiển thị metrics 30 ngày gần nhất.

### Summary cards (3 số)
- **Tổng lượt xem** — number of unique IPs (rate-limit 1/IP/5min)
- **Tổng lượt click** — số lần click vào CTA bất kỳ trên trang
- **CTR** — Click-Through Rate = clicks / views × 100%

### Charts (2 đồ thị area chart)
- Lượt xem mỗi ngày (last 30d)
- Lượt click mỗi ngày (last 30d)

### Top sections (list)
- Top 10 section có nhiều click nhất
- Hiển thị icon + label section + click count

### Top CTA labels (list)
- Top 10 nhãn CTA (vd "Đăng ký ngay", "Mua vé") theo số click

> 💡 **Cách dùng analytics:**
> - Hub nào CTR <2% → CTA chưa hấp dẫn, đổi label hoặc đổi vị trí section
> - Top section click thấp nhưng quan trọng → kéo lên trên hub
> - Section ở vị trí cuối có click cao → nội dung tốt, cân nhắc lên đầu

---

## 10. Publish & Xem trang public

### Bước 1: Đổi status sang "Đã đăng"

- Tab "Nội dung" → khối "Thông tin chung" → field **"Trạng thái"** → chọn `Đã đăng`
- Bấm **"Lưu thay đổi"**

### Bước 2: Xem trang public

Có 2 cách:

**(a) Từ admin edit page:**
- Khi status = `Đã đăng` → nút **"Xem trang public"** (icon 👁️) xuất hiện cạnh nút Save
- Bấm → mở tab mới `https://5bib.com/hub/<slug>`

**(b) Từ list page:**
- Vào `/promo-hub` → row của hub
- Nếu status = `Đã đăng` → icon 👁️ Eye xuất hiện ở cột "Thao tác"
- Click → mở tab mới

### Cache propagation

Sau khi Lưu:
- **Tốc độ propagation:** thường <1 giây (nếu env REVALIDATE_TOKEN đã set)
- **Worst case:** 60 giây (nếu env chưa set — fallback ISR)
- **Force refresh:** F5 trên browser, hoặc Ctrl+Shift+R hard refresh

### Unpublish (tạm ẩn)

- Đổi status sang `Nháp` hoặc `Lưu trữ` → bấm Lưu
- Public URL sẽ trả 404 ngay sau ≤1s (cache invalidated)

---

## 11. Best Practices

### Cấu trúc landing page hiệu quả

**Pattern AIDA cho race promo:**

```
1. Attention   → Hero (image lớn + tagline)
2. Interest    → Stats (94K+ VĐV, 195 giải, ...)
3. Desire      → Featured Races + Testimonials
4. Action      → CTA Buttons + Form Embed (đăng ký)
```

**Pattern "Linktree clone" cho race organizer:**

```
1. Hero (logo + slogan)
2. Social Links (FB, IG, TikTok)
3. Link Grid (current race vé + past results + photo gallery)
4. Sponsors
5. Footer CTA
```

### Section ordering tips

- ✅ Hero TRƯỚC Stats (visual hook trước, số liệu sau)
- ✅ Countdown ngay sau Hero nếu là race promo (tạo urgency)
- ✅ Sponsors GẦN CUỐI hoặc cuối (sau khi user đã thấy giá trị)
- ✅ FAQ trước Form (giải đáp doubts trước khi yêu cầu commit)
- ❌ KHÔNG đặt Video ở section đầu (nặng, chậm load)
- ❌ KHÔNG nhồi >2 form submission per hub (user mệt)

### SEO tips

- Slug ngắn gọn, có keyword: `utmb-2026` thay vì `trang-quang-ba-utmb-viet-nam-2026-dang-ky`
- Meta title format: `[Race name] [Year] — [Verb] | 5BIB` (vd: "UTMB Việt Nam 2026 — Đăng ký ngay | 5BIB")
- OG image phải có text overlay rõ
- Schedule timeline tốt cho SEO (Google hiểu structured data)

### Performance tips

- Ảnh nền hero ≤500KB (compress qua TinyPNG trước khi paste URL)
- Image gallery ≤8 ảnh per section (>8 sẽ chậm scroll)
- Số CTA ≤5 trên toàn hub (decision paralysis)

### Mobile-first checks

- Sau khi Publish → mở tab mobile DevTools (Chrome F12 → Toggle device)
- Check Hero text scale OK, CTA buttons tap-friendly (≥44×44px), không text overflow
- Test trên iPhone Safari + Android Chrome thật sự nếu race day cao điểm

---

## 12. Use case mẫu — Race promo page UTMB

### Setup

**Slug:** `utmb-2026`
**Theme:** Primary `#1d4ed8` (xanh) + Secondary `#ea580c` (cam) — màu UTMB Việt Nam
**Layout:** Tiêu chuẩn (1200px)

### Sections (theo thứ tự)

| # | Type | Config tóm tắt |
|---|---|---|
| 1 | Hero | "UTMB Việt Nam 2026" + bg ảnh Mộc Châu + CTA "Đăng ký ngay" → `/calendar` |
| 2 | Countdown | Đếm ngược tới 06:00 ngày race start |
| 3 | Stats | 4 cards: "94K+ VĐV", "195 giải", "7+ năm hoạt động", "58 đối tác" |
| 4 | Video Embed | Recap UTMB 2025 từ YouTube |
| 5 | CTA Buttons | "Xem lịch giải" (primary) + "Liên hệ BTC" (outline) |
| 6 | Social Links | Facebook + Instagram + TikTok + YouTube + Email |
| 7 | Link Grid | 6 sản phẩm chạy bộ affiliate (giày, gel, đèn pin...) |
| 8 | Schedule Timeline | 7 mốc race day: 04:00 → 14:00 → 20:00 cut-off |
| 9 | Testimonial | 3 quote từ finisher 2025 |
| 10 | Image Gallery | 8 ảnh recap năm trước |
| 11 | FAQ | 5 câu: chuyển BIB / xe đưa đón / mưa bão / cut-off / prize money |
| 12 | Map Embed | Google Maps Mộc Châu Race Village |
| 13 | Sponsors | Logo Kim cương + Vàng + Bạc auto-sync |
| 14 | Rich Text | Giới thiệu UTMB Vietnam, link UTMB Mont-Blanc |
| 15 | Form Embed | Link Google Form "Đăng ký nhận tin race tiếp theo" |

### SEO

- Meta Title: "UTMB Việt Nam 2026 — Đăng ký ngay | 5BIB"
- Meta Description: "Vòng loại UTMB Mont-Blanc tại Việt Nam — 4 cự ly từ 25K đến 170K tại Mộc Châu. Tích lũy Running Stones cho Chamonix 2027."
- OG Image: Banner UTMB 2026 1200×630 với logo + tagline
- Canonical: `https://5bib.com/hub/utmb-2026`

### Expected analytics sau 30 ngày promo:

- Tổng lượt xem: 5,000-15,000 (tùy ads spend)
- Tổng lượt click: 800-2,400
- CTR: 15-20% (good cho landing page race)
- Top section click: CTA Buttons + Form Embed
- Top label: "Đăng ký ngay"

---

## 13. Câu hỏi thường gặp

### Q1: Có giới hạn số section trong 1 hub không?
**A:** Technical limit MongoDB doc 16MB → ~30 sections × 5KB config = 150KB max. Thực tế MKT nên ≤15 sections/hub để user không cuộn mệt.

### Q2: Có thể edit hub khi đang Published không?
**A:** Có. Edit + Lưu → cache invalidate trong <1 giây. User đang xem trang sẽ thấy nội dung mới sau khi F5.

### Q3: Slug bị conflict (đã tồn tại) — phải làm gì?
**A:** Đổi slug khác. Nếu thực sự cần dùng slug cũ → vào hub đang chiếm slug, đổi sang slug khác hoặc xóa.

### Q4: Lỡ xóa nhầm hub có khôi phục được không?
**A:** Phase 1 KHÔNG có soft delete — xóa là mất. Phase 2 sẽ thêm trash bin. **Hiện tại cẩn thận trước khi bấm Xóa.**

### Q5: Sửa Race Calendar / Sponsors / Featured Races nhưng public không update?
**A:** Các section auto-sync này có cache riêng 5 phút. Đợi tối đa 5 phút hoặc bấm Lưu lại trên hub để invalidate cache.

### Q6: Custom CSS không apply?
**A:** Check 2 thứ:
1. Mở DevTools → Console xem có error không
2. Backend sanitize có thể strip một số tag/property "nguy hiểm". Tránh `position: fixed`, `@import`, `behavior:`, `expression()`.

### Q7: OG image không hiển thị khi share Facebook?
**A:**
1. Check URL ảnh public accessible (mở thử trên browser ẩn danh)
2. Ảnh ≥1200×630px, định dạng JPG/PNG, <8MB
3. Vào [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug) → paste URL hub → bấm **"Scrape Again"** để FB cache lại

### Q8: Sao staff không thấy menu "Trang quảng bá"?
**A:** Promo Hub yêu cầu role `admin` (cao hơn `staff`). Liên hệ super-admin để cấp quyền.

### Q9: Có thể duplicate 1 hub đã có để tạo hub mới không?
**A:** Phase 1 chưa có. Phase 2 sẽ có nút "Nhân bản". Hiện tại: tạo hub mới + manual copy config từng section.

### Q10: Hub có hỗ trợ multi-language không?
**A:** Phase 1 chỉ 1 language. Multi-language defer Phase 2.

### Q11: Form Embed: tôi muốn submit form trực tiếp lên DB 5BIB, không qua Google Form?
**A:** Phase 1 chỉ hỗ trợ iframe Google Form / Tally / form.5bib.com (nếu đã có endpoint nội bộ). Direct submit defer Phase 2.

### Q12: Có thể đặt password cho hub không (private link)?
**A:** Phase 1 chỉ status `Đã đăng` = public. Password-protect defer Phase 2.

### Q13: Analytics tracking có cookie consent không?
**A:** Hiện tại track view + click bằng IP hash SHA-256 (GDPR-compat). KHÔNG dùng cookie. KHÔNG cần consent banner riêng.

### Q14: Khi nào nên dùng Race Calendar vs Featured Races?
**A:**
- **Race Calendar:** muốn auto-sync TẤT CẢ race theo filter (status, date range)
- **Featured Races:** muốn curated, hiển thị CHÍNH XÁC vài race admin chọn

### Q15: Section có thể đặt lịch tự ẩn/hiện không?
**A:** Có! Trong dialog config mỗi section → bật **"Lịch hiển thị"** → đặt thời gian bắt đầu + kết thúc. Public chỉ hiển thị section trong khoảng đó.

---

## 14. Liên hệ hỗ trợ

- **Báo lỗi (bug)** → sidebar admin → "Báo lỗi" (icon Bug)
- **Yêu cầu tính năng mới** → liên hệ Manager qua Slack/Telegram
- **Cần cấp quyền admin** → liên hệ super-admin
- **Documentation API integration** → xem `docs/promo-hub-api-reference.md`

---

> 📌 **Tài liệu này phiên bản 1.0** — Phase 1 (19 section types) ship 2026-05-13.
> Phase 2 roadmap: race picker UI + image picker + WYSIWYG + autosave + duplicate hub + multi-language + password protect. ETA TBD.
