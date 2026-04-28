# Hướng dẫn sử dụng — Module Bài viết & Danh mục

> **Đối tượng:** Đội Content / Marketing / Back-Office Admin của 5BIB
> **Phiên bản:** 1.0 — 2026-04-27
> **Truy cập:** [admin.5bib.com](https://admin.5bib.com) → đăng nhập với Logto admin role

---

## 📑 Mục lục

1. [Tổng quan & Khái niệm](#1-tổng-quan--khái-niệm)
2. [Đăng nhập & Truy cập](#2-đăng-nhập--truy-cập)
3. [Tạo & quản lý Danh mục](#3-tạo--quản-lý-danh-mục)
4. [Tạo bài viết mới](#4-tạo-bài-viết-mới)
5. [Editor — viết & format nội dung](#5-editor--viết--format-nội-dung)
6. [Sidebar settings — phân loại, ảnh bìa, SEO](#6-sidebar-settings--phân-loại-ảnh-bìa-seo)
7. [Publish, Unpublish, Xóa bài](#7-publish-unpublish-xóa-bài)
8. [Best Practices SEO](#8-best-practices-seo)
9. [Câu hỏi thường gặp](#9-câu-hỏi-thường-gặp)
10. [Liên hệ hỗ trợ](#10-liên-hệ-hỗ-trợ)

---

## 1. Tổng quan & Khái niệm

Module **Bài viết** cho phép đội Content tự viết và đăng:

- **📰 Tin tức** → hiển thị trên `news.5bib.com`
- **📖 Hướng dẫn** → hiển thị trên `hotro.5bib.com` (Help Center)
- **Widget Top 10 mới nhất** → hiển thị trên homepage `5bib.com` và `5sport.vn`

### Khái niệm chính

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Bài viết (Article)** | Một bài đơn lẻ — có tiêu đề, nội dung, ảnh bìa, danh mục, type (Tin tức / Hướng dẫn) |
| **Danh mục (Category)** | Nhóm bài theo chủ đề, ví dụ "Đăng ký giải", "Thanh toán & Hoàn tiền". Hiển thị thành các thẻ lớn ở hero `hotro.5bib.com` |
| **Slug** | Phần cuối URL, vd `hotro.5bib.com/huong-dan-dang-ky` → slug = `huong-dan-dang-ky`. **Chỉ chữ thường, số, dấu gạch ngang** |
| **Status** | `Draft` (nháp, chỉ admin thấy) hoặc `Published` (công khai) |
| **Featured** | Bài "nổi bật" — sẽ xuất hiện ở section hero lớn của trang chủ Help Center |
| **Sản phẩm** | Đánh dấu bài thuộc product nào: 5BIB / 5Sport / 5Ticket / 5Pix. 1 bài có thể thuộc nhiều sản phẩm |
| **Soft Delete** | Khi bấm Xóa, bài chỉ ẩn (không mất hẳn), có thể Restore lại |

---

## 2. Đăng nhập & Truy cập

1. Truy cập **[admin.5bib.com](https://admin.5bib.com)**
2. Bấm **"Đăng nhập"** → chọn tài khoản Logto được cấp quyền `admin`
3. Nếu chưa có quyền: bạn sẽ thấy màn "Không có quyền truy cập" → liên hệ super-admin để cấp role

### Tìm module Bài viết

Sau khi đăng nhập, ở **sidebar trái** (nền đen), bạn sẽ thấy 3 nhóm:
- **Vận hành** — Dashboard, Giải đấu, Merchant, Đối soát, Analytics, Quản lý nhân sự, Khiếu nại, Timing Leads
- **Nội dung** — **📝 Bài viết** ⭐NEW · **📂 Danh mục bài viết** ⭐NEW · Nhà tài trợ · Banner Zone · Certificates · Ảnh kết quả
- **Hệ thống** — Nhật ký đồng bộ

---

## 3. Tạo & quản lý Danh mục

> **Tip:** Nên tạo danh mục **TRƯỚC** khi viết bài đầu tiên để có sẵn dropdown chọn.

### Bước 1: Mở trang Danh mục

Sidebar → **Nội dung** → **📂 Danh mục bài viết**

### Bước 2: Tạo danh mục mới

1. Bấm nút **"+ Tạo danh mục"** (góc trên phải)
2. Điền form:

   | Trường | Ý nghĩa | Ví dụ |
   |---|---|---|
   | **Tên *** | Tên hiển thị tiếng Việt | "Đăng ký giải" |
   | **Slug** | URL-safe; auto-gen từ tên nếu để trống | `dang-ky-giai` |
   | **Loại hiển thị** | `📖 Hướng dẫn` (chỉ hotro) / `📰 Tin tức` (chỉ news) / `🌐 Cả hai` | Chọn theo nhu cầu |
   | **Icon** | Emoji hiển thị trong card hero | 📖 / 💳 / 🏃 / 📸 |
   | **Màu (hex)** | Tint background của card hero. Dùng color picker hoặc gõ `#1D49FF` | Brand blue 5BIB |
   | **Mô tả ngắn** | Sub-text dưới tên (≤160 ký tự) | "Hướng dẫn từ A-Z" |
   | **Hoạt động** | Bật để hiển thị trên public site | ✅ Bật |

3. Bấm **"Tạo mới"**

### Bước 3: Sửa thứ tự hiển thị

Trên public site, danh mục hiển thị theo `order` tăng dần.
Trong table admin, dùng nút **▲ ▼** ở cột "Order" để di chuyển danh mục lên/xuống. Thay đổi lưu tự động.

### Bước 4: Sửa hoặc Xóa

- **Sửa**: bấm icon ✏️ ở cuối row → mở dialog sửa
- **Xóa**: bấm icon 🗑️ → confirm. **Lưu ý**: nếu còn ≥1 bài viết dùng category này → bị chặn 409 với message *"Danh mục đang được sử dụng bởi 1 hoặc nhiều bài viết. Hãy reassign trước khi xóa."* → vào trang **Bài viết**, đổi danh mục cho các bài đó trước.

### Cảnh báo khi đổi slug

Khi sửa **slug** của danh mục, hệ thống sẽ tự động cập nhật slug đó cho **TẤT CẢ bài viết** đang dùng. **Không cần sửa từng bài thủ công.**

---

## 4. Tạo bài viết mới

### Bước 1: Mở trang Bài viết

Sidebar → **Nội dung** → **📝 Bài viết**

Bạn sẽ thấy:
- **4 thẻ thống kê**: Tổng số bài / Đã đăng / Bản nháp / Đã xóa
- **Thanh filter**: Search title + Loại + Trạng thái + Sản phẩm
- **Bảng bài viết**: cover thumb + tiêu đề + slug + loại + sản phẩm + trạng thái + ngày đăng + tác giả + actions
- **Phân trang**: prev/next ở chân bảng

### Bước 2: Tạo bài mới

1. Bấm nút **"+ Tạo bài mới"** (góc trên phải)
2. Hệ thống tự tạo 1 bản nháp với title mặc định *"Bài viết mới"* và **chuyển bạn ngay vào trang editor**
3. Tại editor, sửa tiêu đề thành tên thật của bài

### Bước 3: Mở bài có sẵn để sửa

Bấm vào **tiêu đề** hoặc icon ✏️ trong row → mở editor.

---

## 5. Editor — viết & format nội dung

### Layout editor

```
┌──────────────────────────────────┬──────────────────┐
│  ← Quay lại  ✓ Đã lưu lúc 14:32  │  📤 Đăng bài     │
│  ─────────────────────────────────  │  📋 Phân loại    │
│  [Tiêu đề bài viết]              │  🖼️ Ảnh bìa      │
│  hotro.5bib.com/[slug]           │  📝 Mô tả ngắn   │
│                                   │  🔍 SEO          │
│  [Toolbar H1 H2 B I S 🔗 • ❝]    │                  │
│                                   │                  │
│  [Nội dung bài viết HTML]         │                  │
│                                   │                  │
└──────────────────────────────────┴──────────────────┘
```

### Toolbar (từ trái qua phải)

| Nút | Chức năng | Phím tắt |
|---|---|---|
| **H1 / H2 / H3** | Tiêu đề lớn / vừa / nhỏ | — |
| **B** | Bold (đậm) | Ctrl/Cmd + B |
| **I** | Italic (nghiêng) | Ctrl/Cmd + I |
| **S** | Strikethrough (gạch ngang) | — |
| **🔗** | Insert link — paste URL khi prompt hiện | Ctrl/Cmd + K |
| **• ` 1.`** | Bullet list / Ordered list | — |
| **❝** | Blockquote (trích dẫn) | — |
| **`</>` ** | Code block (cho lệnh, snippet) | — |
| **🖼️** | Insert image — chọn file → upload tự động → insert vào content | — |

### Autosave

- Sau khi gõ, **dừng 2 giây** → tự động lưu vào DB
- Indicator góc trên trái: **"Đang lưu…"** (chấm vàng) → **"Đã lưu lúc HH:MM"** (chấm xanh)
- Nếu lỗi mạng → hiện **"Autosave lỗi"** + toast đỏ. **Cần làm mới trang hoặc chỉnh lại để retry.**

### Tips viết content

- **Heading H2** chia bài thành các section — sẽ tự sinh **mục lục (TOC)** ở public site sidebar trái
- **Insert image** ngay vị trí con trỏ — kéo thả file chưa hỗ trợ (Phase 2)
- **Link** mặc định mở tab mới (`target=_blank`) cho external URLs

---

## 6. Sidebar settings — phân loại, ảnh bìa, SEO

### 📤 Đăng bài

- **Lưu nháp** (chỉ hiện khi `Draft`): không cần bấm — autosave đã handle
- **Publish ↑**: đăng bài ra public. Backend validate đủ field bắt buộc:
  - Tiêu đề
  - Nội dung (không trống)
  - Slug
  - Loại bài
  - **Ảnh bìa**
  → Nếu thiếu, hiển thị **danh sách field thiếu** trong sidebar dạng đỏ → bổ sung rồi bấm lại
- **Ẩn (unpublish)** (chỉ hiện khi `Published`): chuyển về Draft. Lưu ý: lần đăng lại sau, **ngày đăng giữ nguyên** (không reset). Bài cũ sẽ vẫn ở vị trí cũ trong widget "Mới nhất".

### 📋 Phân loại

- **Loại bài**: chọn 📖 Hướng dẫn HOẶC 📰 Tin tức (radio, không chọn cả 2)
- **Sản phẩm**: tích checkbox 1 hoặc nhiều: 5BIB / 5Sport / 5Ticket / 5Pix. Bài sẽ xuất hiện ở widget của những product đã chọn
- **Danh mục**: chọn từ dropdown (danh mục đã tạo ở mục 3). Để trống nếu chưa biết
- **⭐ Đặt làm bài nổi bật**: bài sẽ xuất hiện ở section hero lớn của Help Center. **Lưu ý**: nhiều bài cùng featured → hệ thống chỉ hiển thị 1 bài (bài cập nhật mới nhất)

### 🖼️ Ảnh bìa *

- Click vùng dashed → chọn file
- **Yêu cầu**: 1200×630 px, max 2 MB, định dạng JPG/PNG/WebP
- Ảnh này sẽ được dùng làm **OG Image** khi share lên Facebook/LinkedIn/Zalo
- Nếu cần thay → bấm "Thay ảnh"

### 📝 Mô tả ngắn

- Tóm tắt bài (≤ 160 ký tự, có counter)
- Dùng cho:
  - Card hiển thị trong listing
  - Mô tả khi share trên social
  - Mô tả trong widget homepage

### 🔍 SEO & Social

- **Tiêu đề SEO** (≤ 60 ký tự): khác tiêu đề bài nếu cần ngắn hơn cho Google. Để trống → fallback dùng tiêu đề chính
- **Mô tả SEO** (≤ 160 ký tự): mô tả hiển thị dưới link Google. Để trống → fallback dùng excerpt
- **Google Preview** live phía dưới — show trước cách bài hiển thị trên SERP

---

## 7. Publish, Unpublish, Xóa bài

### Workflow chuẩn

```
Tạo nháp ─→ Viết content ─→ Điền sidebar (loại, products, ảnh bìa, excerpt, SEO)
       ↓
   Xem Google Preview OK → Bấm Publish ↑
       ↓
   Bài lên hotro.5bib.com / news.5bib.com trong vài giây (cache 5 phút)
       ↓
   Cần sửa? → Edit thẳng (autosave) → cache tự refresh sau publish
       ↓
   Cần ẩn tạm? → Sidebar "Ẩn (unpublish)" → status về Draft
       ↓
   Cần xóa? → Trang list, icon 🗑️ → confirm → soft delete
       ↓
   Xóa nhầm? → Phase tiếp theo có tab "Đã xóa" để restore (hiện chưa có UI, liên hệ admin để restore từ DB)
```

### Lưu ý quan trọng về Slug

- Slug **unique** — không trùng với bài khác đang sống
- Sửa slug sau khi đã publish → URL cũ sẽ **404** → Google ranking giảm. **Tránh sửa slug nếu bài đã có traffic**
- Khi soft delete, slug cũ tự động được giải phóng → bài mới có thể tái sử dụng slug đó

### Lưu ý về Re-publish

- Lần publish ĐẦU TIÊN → set ngày đăng = NOW
- Unpublish → publish lại → **ngày đăng giữ nguyên** lần đầu (BR-09). Không có cơ chế "đăng lại từ đầu" trong v1.0

---

## 8. Best Practices SEO

### ✅ Nên làm

1. **Tiêu đề bài**: ≤ 60 ký tự, có từ khóa chính ngay đầu
2. **Slug**: ngắn, có từ khóa, không quá 5 từ. VD `huong-dan-dang-ky-giai-chay-5bib` ❌ → `dang-ky-giai-chay` ✅
3. **Mô tả ngắn (excerpt)**: 1-2 câu trả lời câu hỏi user search. Tránh nhồi keyword
4. **Heading H2/H3**: chia bài thành section logic. Backend tự sinh mục lục
5. **Ảnh bìa**: 1200×630 px, alt-text được tự lấy từ filename
6. **Internal link**: link sang bài liên quan trong cùng category — tăng dwell time
7. **Câu mở đầu**: 50-100 từ đầu bài chứa keyword chính

### ❌ Nên tránh

1. Slug có dấu tiếng Việt — không hợp lệ
2. Tiêu đề CAPS LOCK — Google ghét
3. Copy nguyên văn từ nguồn khác — duplicate content penalty
4. Ảnh bìa 16:9 (vd 1920×1080) — bị crop khi share OG
5. Excerpt > 160 ký tự — bị cắt cuối ở Google

---

## 9. Câu hỏi thường gặp

### ❓ Bài đã publish nhưng chưa thấy trên hotro.5bib.com?

- Cache public site refresh sau **tối đa 5 phút**. Đợi rồi F5 lại
- Nếu sau 5 phút vẫn không có → check: bài có thực sự `status=Published` không? (xem trong sidebar editor)
- Vẫn không có → liên hệ admin để flush cache thủ công

### ❓ Lỡ tay bấm Publish khi bài chưa hoàn chỉnh?

- Bấm sidebar **"Ẩn (unpublish)"** → bài về Draft ngay lập tức
- Sửa xong → Publish lại

### ❓ Dùng emoji trong title được không?

- ✅ Được. Title `"📖 Hướng dẫn đăng ký"` OK. Slug auto-gen sẽ bỏ emoji thành `huong-dan-dang-ky`

### ❓ Insert video YouTube?

- Hiện tại chưa có button trực tiếp (Phase 2). Tạm thời:
  - Paste YouTube embed URL `https://www.youtube.com/embed/VIDEO_ID` qua link button
  - Hoặc copy iframe code và paste vào content (backend sẽ sanitize, chỉ giữ YouTube/Vimeo)

### ❓ Giới hạn số bài?

- Không giới hạn. Hệ thống pagination 20 bài/trang trong admin

### ❓ Có thể hẹn lịch publish không?

- Phase 2. Hiện tại chỉ Publish ngay hoặc Lưu nháp

### ❓ Bài viết có lưu version history không?

- Phase 2. Hiện tại autosave overwrite — không revert được sau save

### ❓ Có thể giao bài cho người khác viết tiếp không?

- Hiện tại bất kỳ admin nào cũng edit/delete được bài của bất kỳ admin khác (team nhỏ, trust)
- Tracking author: bài hiển thị tên admin **tạo bài** (không thay đổi khi người khác sửa)

### ❓ "Was this helpful?" widget cuối bài hoạt động thế nào?

- User trên public site bấm 👍 hoặc 👎 → backend tăng counter
- Dedup theo IP: 1 IP chỉ vote 1 lần / 24h
- Hiện chưa có dashboard xem bài nào nhiều 👎 nhất (Phase 2)

### ❓ Lượt xem (View count) tính thế nào?

- Mỗi user mở bài lần đầu trong 5 phút → +1 view
- Cùng IP refresh trong 5 phút → KHÔNG tính
- Sau 5 phút lại tính tiếp

---

## 10. Liên hệ hỗ trợ

| Vấn đề | Liên hệ |
|---|---|
| Quên mật khẩu / mất quyền truy cập | Super admin |
| Bug UI / lỗi không upload được | Đội Engineering qua Slack #5bib-tech |
| Cache public site cứng đầu | Engineering — flush thủ công |
| Đề xuất feature Phase 2 | PO Mastermind — note vào backlog |

---

## 📋 Phụ lục: Workflow ví dụ

### Tình huống 1: Đội Marketing cần đăng tin "Khai mạc giải Vietnam Mountain Marathon 2026"

1. Vào **Bài viết** → **Tạo bài mới**
2. Sửa tiêu đề: *"Khai mạc giải Vietnam Mountain Marathon 2026 — kỷ niệm 10 năm"*
3. Slug để hệ thống auto-gen: `khai-mac-giai-vietnam-mountain-marathon-2026-ky-niem-10-nam` → có thể rút gọn thành `vmm-2026-khai-mac`
4. Sidebar:
   - Loại: **📰 Tin tức**
   - Sản phẩm: **5BIB ✓**, **5Sport ✓**
   - Danh mục: *(skip — tin tức không cần category)*
   - **⭐ Đặt làm bài nổi bật** (vì là tin lớn)
5. Upload ảnh bìa: ảnh chụp khai mạc 1200×630
6. Excerpt: *"Hơn 5,000 runners từ 30 quốc gia tụ hội tại Sapa cho mùa giải kỷ niệm 10 năm…"*
7. SEO: copy excerpt vào SEO description, tiêu đề SEO ngắn lại còn 50 ký tự
8. Viết content body với H2, H3, ảnh, link
9. Bấm **Publish ↑**
10. Mở `https://news.5bib.com/vmm-2026-khai-mac` trong tab mới → kiểm tra hiển thị

### Tình huống 2: Đội Support cần viết bài hướng dẫn "Cách hoàn vé"

1. Vào **Danh mục bài viết** → check có category "Thanh toán & Hoàn tiền" chưa
2. Nếu chưa: tạo mới với:
   - Loại: 📖 Hướng dẫn
   - Icon: 💳
   - Màu: `#16A34A` (xanh lá)
3. Vào **Bài viết** → **Tạo bài mới**
4. Tiêu đề: *"Cách hoàn vé giải chạy 5BIB"*
5. Slug: `cach-hoan-ve-giai-chay`
6. Sidebar:
   - Loại: 📖 Hướng dẫn
   - Sản phẩm: 5BIB ✓
   - Danh mục: **Thanh toán & Hoàn tiền** (vừa tạo)
7. Upload ảnh bìa
8. Excerpt: *"Quy trình 4 bước hoàn vé chỉ trong 10 phút…"*
9. Body content có H2 cho từng bước
10. Bấm Publish → bài xuất hiện ở `hotro.5bib.com/cach-hoan-ve-giai-chay` + trong card "Thanh toán & Hoàn tiền" của hero grid

---

**Cập nhật cuối:** 2026-04-27
**Maintainer:** PO Mastermind
**Feedback:** Slack #5bib-content
