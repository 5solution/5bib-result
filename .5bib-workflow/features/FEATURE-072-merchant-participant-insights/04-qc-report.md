# FEATURE-072: QC Report — ✅ APPROVED (with DEV-smoke conditions)

**QC:** 5bib-qc-gatekeeper · 2026-06-08

## Phase 1 — Regression
- Backend additive (2 GET endpoint), 0 schema write, 0 fee/auth change. Full merchant-portal jest **154 PASS** (0 regression) + **17 util tests**. tsc backend clean.
- Frontend: tsc 0 · vitest 13/13 (i18n coverage phủ 10 key mới × 5 lang) · next build 15 routes. Hand-added SDK (reconcile next generate:api).

## Phase 2 — Security
| Threat | Verdict |
|--------|---------|
| IDOR cross-race | ✅ `assertRaceForUser` TRƯỚC trong cả getParticipantInsights + Export |
| No-PII | ✅ Response chỉ `{label,count}` — KHÔNG tên/dob/cccd cá nhân. Util không trả raw row ra DTO |
| SQL injection | ✅ param `?` raceId; 0 `${}` interpolation |
| Auth | ✅ class `LogtoMerchantGuard` (ticket-scope; insights không phải data tiền → không cần finance) |
| Export leak | ✅ Excel chỉ aggregate (size×cự ly + cơ cấu), no PII |

## Phase 3-4 — Tests
- 17 util unit (TC-01..08 mở rộng): parseAge 3-format+implausible, ageGroupWA WA bands, normalizeNationality VN-variants, gender map, size canonical order, aggregate counts+total, top-8/top-10+Khác, empty. **PASS**.
- Backend 154 jest PASS.

## Phase 5 — PRD compliance
✅ BR-72-01..10: athlete_subinfo paid join · AG WA 5-năm + "Không rõ" · dob defensive · nationality normalize top-8 · gender map · size canonical · province top-10 · ticket-scope guard · cache 300s · aggregate-in-Node. Export Excel ✅. Tab riêng ✅.

## Phase 6 — Persona (code-trace; live screenshot defer DEV)
- BTC mở tab "Cơ cấu VĐV" → KPI tổng + Bar size + Donut giới + Bar AG + Bar quốc tịch + Bar tỉnh + nút Xuất Excel size. Empty state khi total=0. ✅ code.
- ⚠️ **DEFER DEV smoke:** glyph 5 lang + render thật + **export Excel tải file** + **is_represent cardinality** (verify guardian không phồng count) + IDOR 401/403 live.

## Tech debt → known-issues
- TD-F072-LABEL-I18N (gender/unknown labels VN cho non-VN user)
- TD-F072-IS-REPRESENT (verify guardian rows)
- TD-F072-SDK-HANDADD (reconcile SDK khi generate:api chạy được)

## ✅ VERDICT: APPROVED
Backend solid (154+17 tests, IDOR+no-PII clean), frontend build clean. 2 condition = DEV-smoke (glyph + export tải + is_represent data check) — Danny verify sau deploy DEV. → /5bib-deploy
