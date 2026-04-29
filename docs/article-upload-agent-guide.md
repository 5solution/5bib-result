# Hướng dẫn Agent — Upload bài viết tự động lên hotro.5bib.com / news.5bib.com

> **Đối tượng**: Một AI agent (Claude/GPT/Gemini) hoặc script tự động sẽ:
> 1. Đọc nguồn (Facebook fanpage BTC, hội nhóm, news running, Strava events…)
> 2. Tổng hợp + viết lại theo brand voice 5BIB
> 3. Upload tự động qua API → hiển thị trên `hotro.5bib.com` (help) hoặc `news.5bib.com` (news)

---

## 0. TL;DR — flow tối thiểu

```
[Source: FB post / news article / Strava event]
        ↓
   [1] Agent đọc + extract: title, body, hình ảnh, ngày, BTC, link gốc
        ↓
   [2] Agent rewrite theo brand voice 5BIB (xem §5)
        ↓
   [3] POST /api/upload  cho từng ảnh → nhận S3 URL
        ↓
   [4] POST /api/admin/articles  với content HTML (đã thay <img src> = S3 URL)
        ↓
   [5] POST /api/admin/articles/:id/publish  (nếu muốn live ngay)
        ↓
   ✅ Bài hiện trên hotro.5bib.com / news.5bib.com
```

---

## 1. Authentication

Hai cách auth được hỗ trợ — **dùng Option A cho AI agent** (không cần copy token, không expire):

### Option A — Scoped API key (KHUYẾN NGHỊ cho bot)
Header: `X-API-Key: ak_xxxxxxxxxxxxx`

Key cần có **scope** `articles:write` (cho POST/PATCH /api/admin/articles + /publish/unpublish/delete) và `upload:write` (cho POST /api/upload).

Cách cấp key:
1. Login `admin.5bib.com` → API Keys → Generate (UI sẽ hiển thị key full **chỉ 1 lần**)
2. Hỏi Danny add scope qua mongo:
   ```js
   db.api_keys.updateOne(
     { keyPrefix: "ak_xxxxxxxxx" },
     { $set: { scopes: ["articles:write", "upload:write"] } }
   )
   ```
3. Key không expire (cho đến khi `isActive` flip false)

> Key tránh để leak ra repo / log. Rate limit mặc định 60 req/phút (chỉnh được).

### Option B — Logto admin JWT (cho người, hoặc tool internal)
Header: `Authorization: Bearer <jwt>`

1. Danny login `https://admin.5bib.com`
2. F12 → Application → Cookies → tìm cookie `logto:session` hoặc Local Storage `logto:access_token`
3. Copy token, paste vào agent env var: `BIB_ADMIN_TOKEN`
4. Token expire ~1 giờ — agent phải handle 401 → notify Danny refresh token

### Base URL
| Environment | Base URL |
|-------------|----------|
| **Production** | `https://result-api.5bib.com` (hoặc trực tiếp domain backend prod nếu Danny share) |
| **Development** | `https://result-dev.5bib.com` |

> ⚠️ **Khuyến cáo**: agent test trên DEV trước, chỉ post PROD khi Danny duyệt content.

---

## 2. Categories có sẵn (PROD)

Lấy danh sách: `GET /api/article-categories?type=help` hoặc `?type=news`

### Help categories (`hotro.5bib.com`)
| slug | name | mô tả khi nào dùng |
|------|------|---------------------|
| `tinh-nang-5bib` | Các tính năng của 5BIB | Hướng dẫn dùng app, mua vé, login, BIB, racekit |
| `xem-ket-qua` | Xem kết quả | Cách tra kết quả, xếp hạng, certificate |
| `certificate` | Certificate | Tải giấy chứng nhận finisher |
| `bib-avatar` | BIB & Avatar | Đổi ảnh avatar, sửa thông tin VĐV |
| `khieu-nai` | Khiếu nại | Phản hồi sai kết quả, mất BIB |

### News categories (`news.5bib.com`)
| slug | name | dùng khi |
|------|------|----------|
| `tin-tuc-5bib` | Tin tức 5BIB | Update sản phẩm, partnership, internal news |
| `su-kien-giai-chay` | Sự kiện giải chạy | **Dùng cho hầu hết bài từ FB BTC / hội nhóm** — race recap, Early Bird, kết quả giải |

> Nếu bài không vừa category nào, default `tin-tuc-5bib`. **Đừng tạo category mới** — báo Danny.

---

## 3. Article schema

### CreateArticleDto (POST /api/admin/articles)

```json
{
  "title": "string (3–200 ký tự, REQUIRED)",
  "slug": "string (auto-gen từ title nếu omit, pattern: ^[a-z0-9-]+$)",
  "type": "news | help (REQUIRED)",
  "products": ["5bib"],  // hoặc ["5sport"], ["5ticket"], ["5pix"], hoặc multi
  "category": "tinh-nang-5bib | xem-ket-qua | … (slug từ §2)",
  "content": "<p>HTML body — xem §4 allowlist</p>",
  "excerpt": "string (≤160 ký tự, hiển thị card list + share preview)",
  "coverImageUrl": "https://... (1200×630, dùng làm OG image)",
  "seoTitle": "string (≤60 ký tự, default = title.slice(0,60))",
  "seoDescription": "string (≤160 ký tự, default = excerpt)",
  "featured": false  // chỉ true khi muốn xuất hiện trong hero — hỏi Danny
}
```

### Workflow tạo + publish
```bash
# 1. Tạo draft
POST /api/admin/articles
→ trả về { id: "...", status: "draft", ... }

# 2. (Optional) Update sau
PATCH /api/admin/articles/:id

# 3. Publish — đẩy lên hotro/news.5bib.com
POST /api/admin/articles/:id/publish
→ status: "published", publishedAt: "2026-04-28T..."

# Để rút bài xuống:
POST /api/admin/articles/:id/unpublish
```

---

## 4. Content HTML — allowlist sanitize-html

Backend strip mọi tag/attribute không trong allowlist. Agent phải tuân theo:

### ✅ Tags được phép
```
h1, h2, h3, p, strong, em, b, i, u, s, code, blockquote, pre,
ul, ol, li, a, img, figure, figcaption, hr, br,
iframe (chỉ YouTube + Vimeo), video, source
```

### ✅ Attributes được phép
| Tag | Attributes |
|-----|------------|
| `*` (mọi tag) | `class`, `id` |
| `a` | `href`, `target`, `rel` (auto thêm `noopener noreferrer target=_blank` cho external) |
| `img` | `src`, `alt`, `width`, `height`, `loading` |
| `iframe` | `src`, `width`, `height`, `allow`, `allowfullscreen`, `frameborder` |
| `video` | `src`, `controls`, `poster`, `width`, `height` |

### ❌ Bị strip silently
- `style="..."` (CSS inline) — dùng `class` thay
- `onclick`, `onerror`, mọi `on*` event handler
- `<script>`, `<form>`, `<input>`, `<button>`
- `iframe` không phải YouTube/Vimeo
- `data:` URI ngoại trừ `<img src="data:...">` (cho phép base64 inline)

### Chuẩn HTML khuyến nghị
```html
<p>Đoạn mở bài (hook). Câu đầu phải dừng scroll.</p>

<h2>Tiêu đề mục lớn</h2>
<p>Nội dung mục…</p>

<h3>Tiêu đề con</h3>
<ul>
  <li>Bullet 1</li>
  <li>Bullet 2</li>
</ul>

<figure>
  <img src="https://5sport-media.s3.ap-southeast-1.amazonaws.com/articles/..." alt="Mô tả ảnh"/>
  <figcaption>Caption hiển thị dưới ảnh</figcaption>
</figure>

<blockquote>Quote nổi bật từ nguồn / VĐV</blockquote>

<p>Embed YouTube:</p>
<iframe src="https://www.youtube.com/embed/VIDEO_ID" width="560" height="315"></iframe>

<p>Link nguồn: <a href="https://facebook.com/btc-page/posts/123">Bài gốc của BTC</a></p>
```

---

## 5. Brand Voice — KHÔNG sao chép thô từ FB

### ✅ Phong cách "5BIB Team"
- **Hook đầu** dừng scroll: số liệu, câu hỏi, statement of stakes
- **Thân bài** — đoạn ngắn 2–3 câu, bullet khi liệt kê
- **Câu kết** — CTA hoặc đường link đi tiếp
- Xưng "bạn" với runner, không "quý khách"
- Cụ thể số liệu: "42km · 3,200 VĐV · 8h cut-off"
- Kết: link liên quan / Zalo OA `https://zalo.me/1496901851017205971`

### ❌ Tránh hoàn toàn
- "Chúng tôi rất vui khi thông báo…"
- "Cảm ơn quý khách đã quan tâm"
- "Sự kiện đặc biệt không thể bỏ lỡ"
- Tag chi chít hashtag cuối bài (style FB)
- Copy-paste y nguyên caption FB của BTC (rewrite!)

### Tone theo loại bài
| Loại | Tone | Ví dụ hook |
|------|------|------------|
| **Race announce** | Hype, urgent | "Early Bird VMM 2026 — còn 48 giờ. 200 slot." |
| **Race recap** | Proud, emotion | "42km. 3,200 runner. 1 cơn mưa lớn lúc 6h sáng." |
| **Hướng dẫn dùng tính năng** | Empathetic, expert | "Đăng ký xong nhập sai BIB? Sửa được trong 30 giây, không cần email support." |
| **Tin tức ngành** | Professional, clear | "VRA công bố lịch giải 2026: 24 sự kiện chính thức trên toàn quốc." |

### Template cho bài từ FB BTC fanpage
```markdown
## [Hook 1–2 câu — KHÔNG bắt đầu bằng "5BIB xin thông báo"]

[Background section — race là gì, cự ly, ngày, địa điểm]

## Thông tin chính

- **Cự ly**: 5km / 10km / 21km / 42km
- **Ngày diễn ra**: dd/mm/yyyy
- **Địa điểm**: …
- **BTC**: …
- **Phí đăng ký**: … (Early Bird đến dd/mm/yyyy)

## Đường chạy

[Mô tả cung đường, độ khó, điểm checkpoint]

## Cách đăng ký

[Bước 1, 2, 3 — nếu đăng ký qua 5Ticket thì link `https://5ticket.vn/...`]

## Liên quan

- [Bài đăng ký BIB](/huong-dan-su-dung-5bib-mobile-app-mua-ve)
- [Cách xem kết quả](/huong-dan-xem-ket-qua-giai-chay)

---

> **Nguồn**: [Bài gốc của BTC trên Facebook](https://facebook.com/...)
```

---

## 6. Image upload flow

### Endpoint
```
POST /api/upload
Authorization: Bearer <BIB_ADMIN_TOKEN>
Content-Type: multipart/form-data

field: file=<binary>
```

### Response
```json
{ "url": "https://5sport-media.s3.ap-southeast-1.amazonaws.com/uploads/2026-04-28/abc123.jpg" }
```

### Constraints
- Max 10MB / file
- Chấp nhận: `jpg`, `jpeg`, `png`, `webp`, `gif`
- Tên file gốc không được trust — backend tự rename

### Flow trong agent
```python
# Pseudocode
def upload_image(local_path):
    with open(local_path, 'rb') as f:
        res = requests.post(
            f"{BASE}/api/upload",
            headers={"Authorization": f"Bearer {TOKEN}"},
            files={"file": f}
        )
    return res.json()["url"]

# Khi build content HTML:
for img_tag in body_html.find_all("img"):
    local = download(img_tag["src"])
    s3_url = upload_image(local)
    img_tag["src"] = s3_url
```

> **Cover image**: dùng ảnh đầu tiên (thường là banner BTC). Resize 1200×630 trước upload nếu có thể (tốt cho OG share).

---

## 7. Sample requests

### 7a. Tạo + publish bài "Race announcement"

```bash
# Step 1: Upload cover
COVER_URL=$(curl -s -X POST https://result-api.5bib.com/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/vmm2026-banner.jpg" | jq -r .url)

# Step 2: Create article
ARTICLE=$(curl -s -X POST https://result-api.5bib.com/api/admin/articles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"VMM 2026 — Early Bird mở 48 giờ tới\",
    \"type\": \"news\",
    \"products\": [\"5bib\"],
    \"category\": \"su-kien-giai-chay\",
    \"excerpt\": \"Vietnam Mountain Marathon 2026 mở Early Bird đến 30/04. 4 cự ly từ 21km đến 100km tại Sa Pa.\",
    \"coverImageUrl\": \"$COVER_URL\",
    \"content\": \"<p>Vietnam Mountain Marathon trở lại Sa Pa từ 26–28/09/2026.</p><h2>Cự ly</h2><ul><li>100km — cut-off 24h</li><li>70km — 18h</li><li>42km — 12h</li><li>21km — 6h</li></ul><h2>Đường chạy</h2><p>...</p>\",
    \"seoTitle\": \"VMM 2026 — Early Bird Sa Pa, 4 cự ly\",
    \"seoDescription\": \"Đăng ký Vietnam Mountain Marathon 2026 trước 30/04 để nhận giá Early Bird.\"
  }")

ARTICLE_ID=$(echo "$ARTICLE" | jq -r .id)

# Step 3: Publish
curl -s -X POST "https://result-api.5bib.com/api/admin/articles/$ARTICLE_ID/publish" \
  -H "Authorization: Bearer $TOKEN"
```

### 7b. Update bài cũ (sửa nội dung sau khi BTC đính chính)

```bash
curl -s -X PATCH "https://result-api.5bib.com/api/admin/articles/$ARTICLE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "content": "<p>Nội dung cập nhật...</p>" }'
```

### 7c. Tìm bài đã có (tránh duplicate)

```bash
# Search theo slug
curl -s "https://result-api.5bib.com/api/admin/articles?q=vmm-2026&limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. Quality checklist — agent self-validate trước khi publish

Trước khi gọi `/publish`, agent check:

- [ ] **Title** 3–200 ký tự, không title-case kiểu Tiếng Anh ("Vmm 2026" → "VMM 2026")
- [ ] **Slug** tự sinh hoặc set explicit, không trùng (search trước khi tạo)
- [ ] **Type** đúng (`news` cho event/recap, `help` cho hướng dẫn)
- [ ] **Category** từ §2, không tự bịa
- [ ] **Excerpt** ≤160 ký tự, không lặp y nguyên title
- [ ] **Cover image** đã upload S3 (URL bắt đầu `https://5sport-media.s3.`)
- [ ] **Content HTML** parse được, không có `<script>`, `style=...` inline
- [ ] **Tất cả `<img src>`** đã trỏ S3, không còn URL gốc bizweb / Facebook CDN
- [ ] **Link external** đã có `target=_blank rel=noopener` (auto-add lúc sanitize)
- [ ] **Nguồn gốc** ghi rõ ở cuối bài (FB post URL, link news, name BTC)
- [ ] **Word count** ≥ 200 từ (bài quá ngắn người dùng không tin)
- [ ] **Brand voice** — không có cụm "Chúng tôi rất vui", "Quý khách"

---

## 9. Pipeline ý tưởng cho agent

### A. Source ingestion
```
Input config:
- Facebook page IDs (BTC: VMM, RYR, Halong, …)
- Group IDs (Hội Chạy bộ HN, Sài Gòn Runners, …)
- News domains (vnexpress, dantri, runningmagazine.vn)
- Strava clubs (5BIB Strava Club, …)
```

Agent crawler chạy daily:
1. Pull post mới từ source
2. Filter: chỉ post có keyword `[giải chạy|marathon|trail|race|BIB|cự ly|km]`
3. Dedup: hash content → DB local agent
4. Queue: post chưa từng xử lý

### B. Rewrite + enrich
```
Per item:
1. LLM call: extract structured (title, date, BTC, distances, fee, location, original_url)
2. LLM call: rewrite theo template §5 (header + body + CTA)
3. Vision call (nếu có ảnh): generate alt-text VN cho từng ảnh
4. Internal cross-link: query existing articles `GET /api/admin/articles?q=VMM` → add "Bài liên quan"
```

### C. Upload + review queue
```
1. Upload tất cả ảnh → S3 (§6)
2. POST /api/admin/articles (status=draft, KHÔNG publish ngay)
3. Notify Danny qua Telegram/Zalo: "10 bài draft chờ review: <admin URL>"
4. Danny vào admin /articles → review → publish manually
```

> **Quan trọng**: agent **CHỈ tạo draft**, không auto-publish. Publish luôn cần human review (luật platform + tránh fake news).

---

## 10. Lỗi thường gặp + fix

| Status | Nguyên nhân | Fix |
|--------|-------------|-----|
| `401 Unauthorized` | Token Logto hết hạn | Danny login lại admin → copy token mới |
| `400 slug already exists` | Trùng slug bài cũ | Set `slug` explicit có suffix `-v2` HOẶC update bài cũ thay vì tạo mới |
| `400 Tiêu đề tối thiểu 3 ký tự` | Title quá ngắn sau sanitize | Title không được toàn HTML/emoji |
| `413 Payload Too Large` | Image quá 10MB | Resize trước upload |
| `400 Slug chỉ được chứa…` | Slug có dấu / khoảng trắng | Slugify bỏ dấu Việt: `Vô Địch` → `vo-dich` |
| Body HTML mất format | sanitize-html strip tag không trong allowlist | Check §4 — đặc biệt `<style>`, `<div style>` |

---

## 11. Tài liệu API đầy đủ

OpenAPI Swagger UI:
- DEV: https://result-dev.5bib.com/swagger
- PROD: https://result-api.5bib.com/swagger (auth required)

Filter swagger theo tag **`Articles · Admin`** + **`Upload`**.

---

## 12. Liên hệ

- **Owner platform**: Danny Nguyen — info@5bib.com — Zalo OA `https://zalo.me/1496901851017205971`
- **Admin URL**: https://admin.5bib.com (Logto required, role=admin)
- **Source code**: `5solution/5bib-result` GitHub (private)
- **Tech stack**: NestJS 10 + MongoDB + Next.js 16 + AWS S3
