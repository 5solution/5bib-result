# FEATURE-072: Coder Implementation — 🟠 READY_FOR_QC

**Author:** 5bib-fullstack-engineer · 2026-06-08

## Impact (Think First)
- Backend: thuần READ aggregate, 0 schema write, 0 fee/auth change. Pull-then-aggregate-in-Node (BR-72-10) robust với varchar bẩn. Cache 300s.
- Frontend: tab thứ 3 "Cơ cấu VĐV" (ticket-scope, luôn hiện) — reuse HBars/Donut. Export = fetch blob qua proxy `/api/*` (token server-side).
- API contract: +2 endpoint GET (additive) → generate:api.

## Edge cases
- dob varchar loạn → parseAge phòng thủ (3 format + implausible→null) → "Không rõ".
- nationality free-text → normalize VN variants + top-8+Khác; empty→Không rõ.
- gender variant map; size canonical XXL→2XL, lạ→Khác cuối.
- total=0 → tất cả mảng rỗng, FE empty state.
- Large race (~15k participant) → 1 query pull + Node aggregate, OK.

## Files Changed
**Backend:** ➕ utils/participant-insights.util.ts (+spec 17 tests) · ➕ dto/participant-insights.dto.ts · ✏️ services/merchant-portal.service.ts (pullParticipantRows + getRaceDay + getParticipantInsights + getParticipantInsightsExport) · ✏️ merchant-portal.controller.ts (2 endpoint GET insights+export)
**Frontend:** ✏️ app/races/[raceId]/page.tsx (tab + ParticipantsTab component + loadParticipants + exportSize) · ✏️ lib/mp/i18n.ts (10 key × 5 lang) · 🔄 lib/api-generated/* (generate:api)

## Tests
- Backend `participant-insights.util.spec.ts`: **17 PASS** (TC-01..08 mở rộng). Full merchant-portal jest **154 PASS** (0 regression).
- tsc backend: clean (chỉ pre-existing upload.spec `vi`).

## Self-Review
- [x] tsc backend clean (scope files) · jest 154 PASS
- [x] PRD adherence: AG WA 5-năm · dob/nationality/gender/size normalize đúng BR · no-PII aggregate · export Excel
- [x] Anti-pattern: 0 any/console.log mới; SQL parameterized (`?` raceId); guard ticket-scope
- [x] Files vs Scope Lock: khớp
- [ ] generate:api: CHỜ DEV backend up (SDK regen)
- [ ] Frontend build: sau generate:api
- [x] IMPLEMENTATION_NOTES.md written

→ READY_FOR_QC (sau khi SDK regen + frontend build pass)
