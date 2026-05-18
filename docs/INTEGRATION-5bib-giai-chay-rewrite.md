# Tích hợp `5bib.com/giai-chay/*` vào 5bib.com — hand-off team dev 5bib

> **Audience:** Team dev đang maintain repo `5bib.com` (Next.js app trên Vercel — same repo đã merge `/hub/*` rewrite của F-027)
> **Author:** Team 5BIB Result (Manager hand-off)
> **Date:** 2026-05-16
> **Feature ref:** FEATURE-036 — SEO Subdirectory Routes `/giai-chay/*`
> **Effort:** ~10 phút (3 rewrite rules + robots.txt + GSC submit)
> **Risk:** ZERO (path-specific, không đụng routes khác, pattern y hệt `/hub/*` đã chạy stable từ 2026-05-14)

---

## 🎯 Why — Mục đích

Team 5BIB Result vừa ship **F-036 — SEO Programmatic Pages** tại `result.5bib.com/giai-chay/*`. Mục tiêu: chiếm organic search Google cho từ khoá race tại Việt Nam (vd: "giải chạy bộ Hồ Chí Minh", "đăng ký Hai Phong Marathon 2026", "kết quả VnExpress Marathon HCM").

**SEO yêu cầu** giống F-027 promo hub:
- Google index trên domain `5bib.com` (domain authority cao) — KHÔNG phải subdomain `result.5bib.com` (chia loãng SEO juice)
- URL pattern public: `5bib.com/giai-chay/*`
- Sitemap chính: `5bib.com/sitemap-races.xml`

Content + render đã sẵn ở `result.5bib.com/giai-chay/*` (Next.js SSR, ISR cache). Chỉ cần Vercel rewrite + 5bib.com main app trỏ Google sitemap đúng.

---

## 📋 TL;DR — 3 things cần làm

| # | What | Where | Effort |
|---|------|-------|--------|
| 1 | Thêm 2 rewrite rules vào `next.config.*` | 5bib.com repo (cùng repo F-027 hub) | 3 phút |
| 2 | Thêm `Sitemap: ...` line vào `robots.txt` | 5bib.com `public/robots.txt` (hoặc generated) | 1 phút |
| 3 | Submit sitemap lên Google Search Console | GSC UI cho property `5bib.com` | 5 phút |

**Asset prefix + internal links đã được fix sẵn bên 5bib-result frontend** (cùng cơ chế F-027 — reuse `assetPrefix: 'https://result.5bib.com'`). Team 5bib KHÔNG cần đụng asset config gì.

---

## 🔧 Step 1 — Vercel rewrites

### File
`next.config.js` HOẶC `next.config.ts` HOẶC `next.config.mjs` của repo 5bib.com (cùng file đã merge `/hub/*` rewrite).

### Diff

Đã có `/hub/*` rewrite (từ F-027). Thêm 2 entries:

```diff
async rewrites() {
  return [
    // F-027 — Promo Hub (đã merge 2026-05-14, giữ nguyên)
    {
      source: '/hub/:slug*',
      destination: 'https://result.5bib.com/hub/:slug*',
    },
+   // F-036 — SEO Programmatic Pages /giai-chay/*
+   {
+     source: '/giai-chay/:path*',
+     destination: 'https://result.5bib.com/giai-chay/:path*',
+   },
+   // F-036 — Dynamic XML sitemap (Google crawler endpoint)
+   {
+     source: '/sitemap-races.xml',
+     destination: 'https://result.5bib.com/sitemap-races.xml',
+   },
  ];
},
```

**Lưu ý URL patterns:**
- `/giai-chay/:path*` catch-all → cover tất cả:
  - `/giai-chay/` (listing root)
  - `/giai-chay/[raceSlug]` (race landing)
  - `/giai-chay/[raceSlug]/ket-qua` (results)
  - `/giai-chay/thanh-pho/[citySlug]` (city aggregator)
- `/sitemap-races.xml` — single endpoint, custom route handler

### Verify sau deploy

```bash
# 1. Listing render
curl -I https://5bib.com/giai-chay
# Expected: 200 OK (HTML content)

# 2. Race detail render
curl -I https://5bib.com/giai-chay/cat-tien-jungle-path-2026
# Expected: 200 OK

# 3. Sitemap render
curl -sI https://5bib.com/sitemap-races.xml | head -5
# Expected: 200 OK + Content-Type: application/xml

# 4. Asset URLs absolute (assetPrefix work)
curl -s https://5bib.com/giai-chay | grep -o 'href="[^"]*_next[^"]*"' | head -3
# Expected: href values start with "https://result.5bib.com/_next/..."
```

---

## 🔧 Step 2 — `robots.txt` update

### File
Tùy 5bib.com setup:
- `public/robots.txt` (static) hoặc
- `app/robots.ts` (Next.js metadata API generated)

### Diff

```diff
User-agent: *
Allow: /

# Existing sitemap (5bib.com main pages — nếu có)
Sitemap: https://5bib.com/sitemap.xml

+ # F-036 — Race calendar SEO sitemap (5BIB Result programmatic pages)
+ Sitemap: https://5bib.com/sitemap-races.xml
```

**Lưu ý:** Multiple `Sitemap:` lines hợp lệ trong robots.txt — Google sẽ crawl cả 2. KHÔNG cần sitemap index file (overkill cho 2 sitemap).

---

## 🔧 Step 3 — Google Search Console submit

Sau khi deploy 5bib.com với 2 rewrites + robots.txt:

1. Mở [Google Search Console](https://search.google.com/search-console) → chọn property `https://5bib.com`
2. Sidebar **Sitemaps** → Add sitemap input → nhập `sitemap-races.xml` → Submit
3. Verify status sau 5-10 phút: status "Success" + Discovered URLs ≥ 100

**Expected stats** (theo dữ liệu PROD hiện tại):
- Total URLs trong sitemap: ~109 (1 root + 55 race detail + 53 results page)
- Index coverage 6 tuần: target 80%+ (88+ pages indexed)
- Top keywords mục tiêu: "giải chạy bộ + [city]" 10 thành phố × 2-3 từ khoá variant = 30+ keywords

---

## ⚠️ Quan trọng — KHÔNG có 5BIB action nào nữa sau 3 steps

Team 5bib chỉ làm 3 steps trên. KHÔNG cần:
- ❌ KHÔNG sửa asset config (`assetPrefix` đã được team 5BIB Result handle bên `result.5bib.com`)
- ❌ KHÔNG sửa internal links (5BIB Result hardcoded absolute URLs `https://result.5bib.com/races/...` qua helper `getRaceUrl()` + `getResultPageUrl()`)
- ❌ KHÔNG cần coordinate canonical tags (5BIB Result set `canonical = https://5bib.com/giai-chay/<slug>` self-canonical từ generateMetadata)
- ❌ KHÔNG cần tạo placeholder page nào trên 5bib.com cho route `/giai-chay/*` — Vercel rewrite transparent

---

## 🚨 Rollback nếu phát hiện vấn đề

Nếu sau deploy có lỗi nghiêm trọng (vd: 5bib.com main app collision với route `/giai-chay/*` nào đã có):

```diff
// next.config.js — rollback
async rewrites() {
  return [
    { source: '/hub/:slug*', destination: 'https://result.5bib.com/hub/:slug*' },
-   { source: '/giai-chay/:path*', destination: 'https://result.5bib.com/giai-chay/:path*' },
-   { source: '/sitemap-races.xml', destination: 'https://result.5bib.com/sitemap-races.xml' },
  ];
},
```

Đồng thời xóa `Sitemap: https://5bib.com/sitemap-races.xml` khỏi robots.txt + remove sitemap từ GSC.

→ 5bib.com trở về trạng thái pre-F036 trong < 5 phút.

---

## 📞 Liên hệ

- **Tech contact (5BIB Result):** Danny — slack `@danny` / email tech@5bib.com
- **Deploy day coordination:** ping trong channel `#5bib-result-deploys` sau khi merge
- **Bug report sau golive:** raise ticket Jira project `5BIB-RESULT` với label `F-036-integration`

---

## 🔮 Heads-up — F-037 sẽ cần 0 effort thêm

Team 5BIB Result đang phát triển **FEATURE-037 — On-Sale Race Detail Page** (extend F-036 listing để mỗi race BÁN VÉ có internal SEO page riêng). F-037 sử dụng cùng route pattern `/giai-chay/:path*` đã rewrite ở Step 1 → KHÔNG cần team 5bib làm gì thêm khi F-037 ship.

Sitemap `sitemap-races.xml` sẽ tự include thêm ~17 race BÁN VÉ slugs sau F-037 deploy (currently ~109 → ~126 URLs).

---

## ✅ Acceptance checklist (5BIB Result confirm post-deploy)

Sau khi team 5bib deploy + merge rewrite, team 5BIB Result sẽ verify:

- [ ] `curl https://5bib.com/giai-chay` → 200 OK với HTML content (race listing)
- [ ] `curl https://5bib.com/giai-chay/cat-tien-jungle-path-2026` → 200 OK race detail
- [ ] `curl https://5bib.com/sitemap-races.xml` → 200 OK XML valid
- [ ] CSS/fonts load đúng (browser open `5bib.com/giai-chay` → DevTools Network tab → all assets từ `result.5bib.com/_next/*` 200 OK)
- [ ] `5bib.com/robots.txt` chứa line `Sitemap: https://5bib.com/sitemap-races.xml`
- [ ] GSC dashboard `5bib.com` → Sitemaps tab → `sitemap-races.xml` status "Success"

Khi tất cả checks pass → 5BIB Result close `TD-F036-02` (5Ticket coordination) trong known-issues.

---

**Cảm ơn team 5bib! 🙏** Pattern này clone từ `/hub/*` đã chạy stable 3+ tuần, low-risk.
