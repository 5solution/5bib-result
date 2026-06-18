# FEATURE-089: QC Report

**Status:** ✅ APPROVED
**Tested:** 2026-06-17
**Author:** 5bib-qc-gatekeeper
**Linked:** `01-ba-prd.md`, `03-coder-implementation.md`, `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check
- [x] Đọc `01-ba-prd.md` (requirement gốc) + `03` + `IMPLEMENTATION_NOTES.md`
- [x] Đọc `memory/conventions.md` (anti-patterns)
- [x] `03` status `🟠 READY_FOR_QC` + có "Tests Written" với output PASS
- [x] Chạy lại unit test Coder LOCAL → **14/14 PASS** confirmed

---

## 🔍 Phase 1: Impact & Regression Audit

### What the Coder got right
- Module mới `short-links/` pure Mongo+Redis, port pattern `landing.service` (cache-aside + SETNX + `@Optional()` redis) — chuẩn convention.
- Unique index `code` + retry loop chống collision; E11000 detect đúng.
- `toResponse` allowlist — KHÔNG leak `_id`/`__v`/`createdBy` (verified test).
- `$inc` fire-and-forget không chặn redirect; cache value = targetUrl string.
- app.module register đúng (always-loaded, không nhét vào platformDb block — đúng vì module không cần MySQL).
- Anti-pattern clean: 0 `console.log`/`any`/`as unknown as` trong prod files (QC re-grep confirmed).

### What the Coder MISSED — independent findings
- ⚠️ **F-089-Q1 (LOW, accepted):** `bumpClick` $inc chạy mọi resolve kể cả cache-hit — đúng intent (đếm chính xác) nhưng nếu Redis cache hit + Mongo down thì $inc fail (nuốt lỗi, log warn). Redirect vẫn OK. Acceptable.
- ⚠️ **F-089-Q2 (LOW, accepted):** Disable link đang cache (TTL 3600s) → resolve vẫn redirect tới TTL hết NẾU update không chạy. Nhưng `update()` DEL cache → disable qua PATCH active=false invalidate ngay. Verified test TC-08 pattern. OK.
- ✅ Scope match: file trong `03 Files Changed` khớp Scope Lock `02`. Deviation #1/#2/#3 documented + hợp lý (throttle drop, active-on-row, fold client). KHÔNG scope creep.
- ✅ API contract: module mới → KHÔNG break SDK. `generate:api` N/A (hand-typed wrapper).

---

## 🛡️ Phase 2: Security Threat Model

| Threat | Vector | Risk | Status |
|--------|--------|------|--------|
| Open redirect | `targetUrl: javascript:`/`data:` | HIGH | ✅ Mitigated — DTO `@Matches(/^https?:\/\/.+/i)`. QC test chặn javascript:/data:/ftp: |
| Auth bypass mutation | POST/PATCH/DELETE/QR no token | CRITICAL | ✅ Mitigated — `LogtoAdminGuard` mọi method (QC structural Reflect test) |
| Reserved code hijack | alias `admin`/`api`/`r` (+ case `ADMIN`) | MED | ✅ Mitigated — `isReservedCode` lowercase compare; QC test `ADMIN`/`Api` → 400 |
| Info disclosure | leak `_id`/`createdBy`/`__v` | MED | ✅ Mitigated — toResponse allowlist; negative-assert test |
| Resolve abuse / enumeration | brute `resolve/:code` | LOW | ⚠️ Accepted — chỉ trả targetUrl (no PII). Cache chống tải. Rate-limit end-user = nginx (TD-F089-RATELIMIT). Resolve server-to-server (frontend gọi) → throttle backend vô nghĩa (Deviation #1 hợp lý) |
| NoSQL injection | search regex | LOW | ✅ Mitigated — `escapeRegex()` trước `new RegExp` |
| Code collision race | concurrent create | LOW | ✅ Mitigated — unique index + retry; E11000 → retry/409 |
| QR SSRF/abuse | QR endpoint | LOW | ✅ admin-guarded; QR encode chính shortUrl (no external fetch) |

**Verdict Phase 2:** 0 CRITICAL/HIGH unmitigated.

---

## 🧪 Phase 3: Test Scripts (QC viết — code thật)

**File mới: `backend/src/modules/short-links/short-links.qc.spec.ts`** (12 tests):
- DTO validation (open-redirect defense): http/https hợp lệ; chặn `javascript:`/`data:`/`ftp:`/trống/>2048; alias ngắn/dài/space/slash; boundary 32+2048 hợp lệ.
- Reserved alias case-insensitive: `isReservedCode` mọi case; service `ADMIN`/`Api` → BadRequest + KHÔNG insert.
- Guard wiring structural (Reflect `__guards__`): resolve KHÔNG có LogtoAdminGuard; create/list/update/remove/qr CÓ LogtoAdminGuard.

**Frontend redirect (`/r/[code]`) + admin UI:** không có test runner trong `frontend/` (no jest/vitest) → E2E live-curl gated staging (xem Phase 6). Logic route handler đơn giản: 302 + fallback mọi lỗi.

---

## 📊 Phase 4: Test execution results

```
PASS src/modules/short-links/short-links.service.spec.ts   (14 — Coder)
PASS src/modules/short-links/short-links.qc.spec.ts        (12 — QC adversarial)
Test Suites: 2 passed, 2 total
Tests:       26 passed, 26 total
```
- TypeScript: `tsc --noEmit` clean cho short-links/app.module (backend) + short-links/nav-groups (admin) + middleware/r-route (frontend).
- Anti-pattern scan: 0 hit cả 3 app.
- **Performance:** resolve cache-hit = 1 Redis GET + 1 async Mongo $inc (không chặn). Số p95 thật → đo ở staging (cần Redis+Mongo live). Mục tiêu <80ms cache-hit hợp lý theo pattern landing.

---

## 🔁 Phase 5: PRD Compliance (BR coverage)

- [x] BR-01 code base62 6 ký tự + retry — `service.spec` random-code + collision
- [x] BR-02 custom alias regex — `qc.spec` DTO + service alias test
- [x] BR-03 reserved (case-insensitive) — `qc.spec` reserved bypass
- [x] BR-04 targetUrl http/https + ≤2048 — `qc.spec` DTO
- [x] BR-05 redirect 302 — route handler `NextResponse.redirect(url, 302)` (code-verified; live curl staging)
- [x] BR-06 $inc click mọi resolve — `service.spec` cache-hit + miss đều $inc
- [x] BR-07 active=false → 404 — `service.spec` resolve inactive
- [x] BR-08 admin-only mutation / public resolve — `qc.spec` guard wiring
- [x] BR-09 no query passthrough — route handler redirect tới targetUrl nguyên bản (code-verified)
- [x] BR-10 no expiry — schema không có field expiry ✓
- [x] BR-11 no leak `_id`/`__v`/`createdBy` — `service.spec` negative-assert
- [x] BR-12 cache-aside + SETNX + DEL on mutation — `service.spec` cache-hit + update DEL

**UI states (admin page, code-inspected):** loading (skeleton ×5) / empty (CTA) / filtered-empty (xoá tìm kiếm) / error (destructive) / data (table) / submitting (button disabled "Đang lưu…") / success (toast + copy) / validation (field đỏ realtime) / confirm (AlertDialog) — **9/9 present**.

---

## 🎭 Phase 6: Persona Journey Walkthrough

> Live-browser gated staging (admin cần Logto auth + backend). Dưới đây = code-traced journey từ `page.tsx`/`ShortLinkDialog.tsx`.

### Persona A — Back-Office Admin (Danny) tạo + đăng MXH
| # | Action | UI behavior | Verification (code) |
|---|--------|-------------|---------------------|
| 1 | Vào `/short-links` | Header "Link rút gọn" + nút "+ Tạo link" + ô search | page.tsx render |
| 2 | Click "+ Tạo link" | Dialog `sm:max-w-md`, field URL đích focus | ShortLinkDialog |
| 3 | Dán `https://5bib.com/vi/events/lao-cai-marathon-2026-dong-chay-bien-cuong` | Nút "Tạo" enable khi URL hợp lệ (realtime regex) | `urlValid` |
| 4 | (Tùy) nhập alias `laocai2026` | Helper "Để trống = tự sinh"; validate realtime | `aliasValid` |
| 5 | Click "Tạo" | "Đang lưu…", POST `/api/short-links` | createMut |
| 6 | 201 | Dialog đóng, toast "Đã tạo link & copy vào clipboard", list refresh | onSuccess invalidate + clipboard |
| 7 | Click `s.5bib.com/laocai2026` ở row | Copy clipboard, "✓ đã copy" 1.5s | `copy()` |

### Persona B — Admin sửa URL đích (event đổi slug)
| # | Action | Verification |
|---|--------|--------------|
| 1 | Click "Sửa" row | Dialog edit, KHÔNG có field alias (code bất biến) |
| 2 | Đổi targetUrl → "Lưu" | PATCH; DEL cache `shortlink:code:<code>` → click sau ra URL mới (BR-12) |

### Persona C — Admin tắt/xoá
| # | Action | Verification |
|---|--------|--------------|
| 1 | "Tắt" | PATCH active=false; badge "Đã tắt"; resolve → 404 sau cache DEL |
| 2 | "Xoá" | AlertDialog "Xoá link s.5bib.com/{code}?" destructive → DELETE 204 |

### Persona D — Anonymous click trên MXH
| # | Action | Verification |
|---|--------|--------------|
| 1 | `s.5bib.com/laocai2026` | middleware host `s.5bib.com` → rewrite `/r/laocai2026` |
| 2 | route handler | fetch backend resolve → 302 Location = targetUrl; $inc click |
| 3 | code sai/tắt | resolve 404 → 302 fallback `https://5bib.com` |

### 6.4 UI/UX scrutiny (code-inspected)
- [x] Dialog `sm:max-w-md` (KHÔNG default sm:max-w-sm) — đủ rộng URL dài
- [x] Table truncate + `title` cho targetUrl/title
- [x] Dialog footer buttons cố định (DialogFooter)
- [x] KHÔNG raw enum hiển thị — badge VN "Đang bật/Đã tắt"
- [x] Empty state: icon-less nhưng có text + CTA (khớp landing precedent)
- [x] Loading skeleton ×5
- [x] Error state destructive VN "Không tải được…"
- [x] Success toast VN + auto-copy
- [x] Validation realtime field đỏ VN
- [x] (N/A picker collapse — không có picker)

### 6.5 Real-world data
- [x] URL thật Lào Cai Marathon slug dài + dấu tiếng Việt
- [x] Alias `laocai2026`
- [x] clickCount `toLocaleString('vi-VN')` (vd `1.234`)
- [N/A] money / negative margin — feature không có tiền

---

## 🚧 Tech debt sau ship (Manager → known-issues)
- **TD-F089-RATELIMIT (LOW):** rate-limit end-user cho redirect — đặt ở nginx `s.5bib.com` (limit_req). Chưa code.
- **TD-F089-LIVE-E2E (LOW):** redirect 302 + admin auth walkthrough chạy live staging sau khi DNS/nginx `s.5bib.com` lên.
- **TD-F089-ANALYTICS (Phase 2):** click theo ngày/referrer/UTM.

---

## 📊 Final Verdict

> ### ✅ APPROVED — Sẵn sàng deploy

26/26 test PASS (14 Coder + 12 QC adversarial). 0 CRITICAL/HIGH security. 12/12 BR covered. 9/9 UI state present (code). 4 persona journey traced. 3 TD non-blocking. Live E2E (redirect + admin auth) gated staging + DNS infra — KHÔNG block code merge (DEV).

## 🔗 Next step
Danny chạy: `/5bib-deploy FEATURE-089-url-short-link`
