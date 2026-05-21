# FEATURE-051: Athlete Profile SEO + AI Search Optimization

**Status:** 🟡 INITIATED
**Created:** 2026-05-21 09:30 ICT
**Owner:** Danny
**Type:** EXTEND_EXISTING (extend F-047 frontend page + add JSON-LD schemas)
**Created by:** 5bib-manager
**Sibling ship:** F-050 Race Ops UX (bundle release/v1.9.1)

---

## 🎯 Why this feature

> Danny critique 2026-05-21 sau khi audit SEO trang `/runners/[slug]`:
> - SSR foundation OK nhưng missing AI search-first optimization 2026 mandate
> - Google SGE / ChatGPT / Perplexity / Gemini ưu tiên structured data + FAQ + factual paragraphs
> - 5BIB sở hữu DATA độc quyền (94K athletes × race results) — đây là **moat** chưa khai thác

Bổ sung **SEO + AI search layer** để mỗi athlete profile page = **citation source** cho AI search results. Foundation cho long-term moat: keyword "[athlete name] kết quả race" → 5BIB OWNS.

---

## 📂 Impact Map (theo memory hiện tại)

### Module sẽ chạm

**Frontend (1 file extend + 0-1 new):**
- `frontend/app/(main)/runners/[slug]/page.tsx` — extend JSON-LD Person schema + BreadcrumbList + FAQ schema + AI-friendly lead paragraph + canonical URL + dateModified
- `frontend/app/(main)/runners/[slug]/opengraph-image.tsx` (NEW) — Next.js 16 OG image generator 1200×630px

**Backend (0-1 new):**
- POTENTIALLY: `backend/src/modules/race-result/services/athlete-profile.service.ts` — extend response with `dateCreated` (first race date) for schema. Nếu cần thiết.

**NO schema migration. NO new endpoint (unless need server-side image render — but Next.js handles).**

### File then chốt cần Coder đọc trước khi code
- `frontend/app/(main)/runners/[slug]/page.tsx` — current head metadata + JSON-LD
- `frontend/lib/seo/` (nếu có) — existing SEO helpers
- `next.config.*` — image optimization config
- Reference: F-046 race-recap page JSON-LD pattern (Article schema precedent)

### Endpoint liên quan
- `GET /api/race-results/athletes/:slug` — extend response với `dateCreated` (optional, derived from earliest race date)

### Schema/DB
- ZERO change

---

## ⚠️ Risk Flags

- 🟢 **[LOW] JSON-LD extension additive** — chỉ thêm field vào schema markup, không break existing crawlers.
- 🟡 **[MED] OG image dynamic generation** — Next.js 16 OG image route requires careful font loading. May hit cold start latency (>500ms). Mitigate via static fallback for popular athletes.
- 🟢 **[LOW] FAQ schema synthetic Q&A** — generated from data, không có editorial overhead.
- 🟡 **[MED] AI search ranking timeline** — Google SGE / AI Overview indexing takes 2-4 tuần. ROI delayed.
- 🟢 **[LOW] Canonical URL** — purely additive `<link rel="canonical">`.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

- [ ] **PAUSE-51-01:** OG image design — minimal (athlete name + bib + stats) hay rich (race photos collage if available)? **Recommend:** minimal Phase 1 (data-only), rich Phase 2 (when photo upload populated).
- [ ] **PAUSE-51-02:** FAQ schema Q count — 3 question hay 5? **Recommend:** 5 (cover totalRaces, PR, race types, last race, AG rank).
- [ ] **PAUSE-51-03:** AI-friendly lead paragraph placement — above hero (before any visual) hay below hero (after H1)? **Recommend:** below hero + `<p class="lead sr-only md:not-sr-only">` — hide visually mobile, visible desktop + always in DOM for crawler.
- [ ] **PAUSE-51-04:** Schema language — bilingual (vi + en) hay vi only? **Recommend:** vi only (5BIB VN audience first), en Phase 2 future.
- [ ] **PAUSE-51-05:** Internal linking strategy — auto-suggest "VĐV khác cùng AG" 5 athletes hay manual editorial? **Recommend:** auto-suggest top 5 by similar AG + recent activity.
- [ ] **PAUSE-51-06:** `dateModified` source — `synced_at` từng athlete record gần nhất hay `now()`? **Recommend:** max(synced_at) across linked race_results — reflects freshness của data.

---

## 🎯 Success criteria (gợi ý cho BA)

- JSON-LD Person schema validate trên https://search.google.com/test/rich-results
- BreadcrumbList schema visible in rich snippet
- OG image renders correctly khi share Facebook + Telegram + Zalo
- FAQ schema 5 Q&A pairs, all answer accurate to backend data
- Canonical URL prevents duplicate indexing
- AI-friendly lead paragraph: 80-120 từ, factual, no marketing fluff
- Performance: page TTI < 1.5s (no regression from F-050 changes)
- AI search citation test: hỏi ChatGPT "VĐV NGHIÊM THỊ ANH THƯ chạy bao nhiêu giải" — kỳ vọng cite 5bib.com

---

## ✅ Sẵn sàng cho `/5bib-prd`

**Sẵn sàng** với defaults recommendation cho 6 PAUSE-51-* questions. Danny chốt hoặc override.

---

## 🔗 References

- MKT/SEO Expert review: 2026-05-21 conversation thread
- F-046 JSON-LD Article pattern (precedent): `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx`
- F-047 Person schema baseline: `frontend/app/(main)/runners/[slug]/page.tsx`
- Next.js 16 OG image API: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
- Schema.org references: Person, BreadcrumbList, FAQPage, SportsEvent
- Sibling F-050: `.5bib-workflow/features/FEATURE-050-athlete-profile-enhancement-v2/`
