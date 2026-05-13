# Tích hợp Promo Hub vào 5bib.com (gửi team 5Ticket)

> **Audience:** Team dev đang maintain repo `5bib.com` (5Ticket Next.js app trên Vercel)
> **Author:** Team 5BIB Result
> **Date:** 2026-05-13
> **Effort:** ~5 phút — thêm 1 rewrite rule
> **Risk:** ZERO (rewrite path-specific, không đụng routes khác)

---

## 📋 TL;DR

Team 5BIB vừa ship **Promo Hub** — CMS-driven landing page builder cho marketing. Public hub đang chạy tại `result.5bib.com/hub/<slug>`.

**Cần:** Rewrite `5bib.com/hub/*` → render content từ `result.5bib.com/hub/*` để Google index SEO authority của `5bib.com`.

**Cách:** Thêm 1 `rewrites()` rule vào `next.config.js` của repo 5Ticket. Implement <5 phút, không cần đụng component nào khác.

---

## 🎯 Mục đích

5BIB Marketing team cần tạo landing page cho race promo / sponsor showcase / affiliate links. Build dựng bằng admin no-code (drag-drop 19 section types) — admin tạo + publish hub → URL công khai.

**SEO yêu cầu:**
- Google index trên domain `5bib.com` (domain authority cao)
- Không tạo subdomain mới (chia loãng SEO juice)
- URL pattern: `5bib.com/hub/<slug>`

Hiện tại Promo Hub đã deploy + SSR sẵn tại `result.5bib.com/hub/*`. Cần Vercel rewrite để serve từ `5bib.com` domain.

---

## 🔧 Code change

### File cần sửa
`next.config.js` HOẶC `next.config.ts` HOẶC `next.config.mjs` (tùy repo)

### Diff

```diff
// next.config.js
+ const nextConfig = {
  // ... existing config ...

+  async rewrites() {
+    return [
+      {
+        source: '/hub/:slug*',
+        destination: 'https://result.5bib.com/hub/:slug*',
+      },
+    ];
+  },
};
```

**Nếu đã có `rewrites()` rồi → thêm object mới vào array:**

```diff
async rewrites() {
  return [
    // existing rules...
    { source: '/api/...', destination: '...' },

+    {
+      source: '/hub/:slug*',
+      destination: 'https://result.5bib.com/hub/:slug*',
+    },
  ];
},
```

### Giải thích syntax

| Phần | Ý nghĩa |
|---|---|
| `source: '/hub/:slug*'` | Match `/hub/anything` và `/hub/anything/sub-path` |
| `:slug*` | Wildcard catch tất cả segments sau `/hub/` |
| `destination: 'https://result.5bib.com/hub/:slug*'` | Forward request tới full URL, GIỮ NGUYÊN URL bar trên browser |

### Tại sao dùng `rewrites` thay vì `redirects`?

| Type | Behavior |
|---|---|
| **rewrites** (✅ dùng) | URL bar GIỮ `5bib.com/hub/...`. Google index `5bib.com`. SEO juice stay. |
| redirects (❌ không dùng) | Browser jump sang `result.5bib.com/...`. SEO juice mất. |

---

## 🚀 Deploy

1. Sửa `next.config.*` như trên
2. Commit + push (Vercel sẽ auto-deploy preview branch)
3. Test preview URL: `<vercel-preview>.vercel.app/hub/demo-utmb-2026` → expect render đầy đủ hub UI
4. Merge → Vercel auto-deploy production
5. Verify: `https://5bib.com/hub/demo-utmb-2026` → render hub content (URL bar giữ `5bib.com`)

> ⚠️ Hiện tại chưa có demo hub published — sau khi rewrite deploy, team 5BIB sẽ tạo hub đầu tiên (vd `5bib.com/hub/utmb-2026`) để test end-to-end.

---

## 🧪 Test cases

### Test 1: Hub tồn tại + published
```
curl -I https://5bib.com/hub/utmb-2026
# Expect: HTTP 200 + Content-Type: text/html
```

### Test 2: Hub không tồn tại / unpublished
```
curl -I https://5bib.com/hub/non-existent-slug
# Expect: HTTP 404 (Vietnamese fallback page)
```

### Test 3: Non-hub paths không bị ảnh hưởng
```
curl -I https://5bib.com/                # → 5Ticket homepage (giữ nguyên)
curl -I https://5bib.com/dashboard       # → 5Ticket route (giữ nguyên)
curl -I https://5bib.com/api/some-path   # → 5Ticket API (giữ nguyên)
```

### Test 4: SEO meta tags rendered
```
curl https://5bib.com/hub/utmb-2026 | grep -oE '<title>[^<]+</title>|og:title|canonical'
# Expect: title, og:title, canonical đều có (từ result.5bib.com SSR)
```

---

## 🧯 Rollback

Nếu có issue:
1. Remove rewrite rule khỏi `next.config.*`
2. Push → Vercel auto-deploy
3. `5bib.com/hub/*` sẽ trả 404 (default Next.js behavior — không match route)
4. Hub vẫn truy cập được ở `result.5bib.com/hub/<slug>` (unchanged)

KHÔNG có data loss, KHÔNG ảnh hưởng các route khác. Reversible 100%.

---

## 🤝 Coordination

### Câu hỏi → liên hệ team 5BIB Result

- **Danny** (PM) — chốt decisions
- **Backend changes** — KHÔNG cần (rewrite chỉ ở 5Ticket repo)
- **Promo Hub admin trang** — `https://admin.5bib.com/promo-hub` (team 5BIB MKT quản lý)

### Câu hỏi → trong team 5Ticket

- Vercel project access → ai có quyền merge + deploy
- `next.config.*` đã có `rewrites()` chưa → check file path

---

## ❓ FAQ

**Q1: Có cần config CORS / proxy headers gì không?**
A: Không. `result.5bib.com` đã set CORS allow `*` cho public hub endpoint. Rewrite từ Vercel edge → fetch SSR HTML, server-to-server, không bị CORS.

**Q2: Performance impact?**
A: Vercel edge cache HTML response. Round-trip thêm ~50-100ms cho first hit, sau đó cached. TTFB tổng < 500ms (PRD SLA).

**Q3: Có affect `5bib.com/hubs` (plural) hoặc các URL khác bắt đầu bằng `/hub` không?**
A: Pattern `/hub/:slug*` chỉ match `/hub/` (có trailing slash) hoặc `/hub/anything`. Các path khác như `/hubs`, `/hub` (no slash), `/hub-banner` đều KHÔNG match. An toàn.

**Q4: Hub có dùng cookie / auth không?**
A: Không. Public hub fully anonymous. Phù hợp cho cache + edge serve.

**Q5: Sitemap có cần update không?**
A: Có. Sau khi rewrite live, team 5BIB sẽ extend `5bib.com/sitemap.xml` để bao gồm hub URLs. Sẽ coordinate riêng — không phải scope của PR này.

**Q6: Có cần restart Vercel sau deploy?**
A: Không. Vercel auto-deploy + atomic switch. Zero downtime.

---

## 📎 Reference

- **Promo Hub feature spec:** `5bib-result` repo → `.5bib-workflow/features/FEATURE-027-promo-hub/`
- **Promo Hub API reference:** `docs/promo-hub-api-reference.md`
- **Promo Hub user guide (MKT):** `docs/HDSD-promo-hub.md`
- **Vercel rewrites docs:** https://nextjs.org/docs/app/api-reference/next-config-js/rewrites
- **Promo Hub admin URL:** https://admin.5bib.com/promo-hub
- **Public hub URL (current):** https://result.5bib.com/hub/`<slug>`
- **Public hub URL (after rewrite):** https://5bib.com/hub/`<slug>`

---

## ✅ Acceptance criteria

- [ ] `next.config.*` có rewrite rule cho `/hub/:slug*`
- [ ] Vercel deploy preview + verify `<preview>.vercel.app/hub/test-slug` không bị 404 do route mismatch
- [ ] Merge production → `5bib.com/hub/demo-utmb-2026` render hub UI (sau khi 5BIB MKT tạo demo hub)
- [ ] URL bar GIỮ `5bib.com/hub/<slug>` (không redirect)
- [ ] Non-hub paths như `5bib.com/`, `5bib.com/dashboard` không bị ảnh hưởng
- [ ] Lighthouse SEO score `5bib.com/hub/<slug>` ≥ 90

---

**Liên hệ Danny nếu cần làm rõ. Cảm ơn team 5Ticket!**
