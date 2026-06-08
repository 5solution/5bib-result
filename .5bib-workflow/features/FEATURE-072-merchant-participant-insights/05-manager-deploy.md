# FEATURE-072: Deploy & Memory Sync — ✅ DONE (DEV pending CI)

**Manager:** 5bib-manager · 2026-06-08

## Manager Independent Code Review (5 hotspot)
1. `utils/participant-insights.util.ts` — parseAge 3-format + implausible<5/>100 guard; ageGroupWA 18-24 special-case + WA bands; normalizeNationality VN-variants set. ✅ CLEAN, 17 tests.
2. `services/merchant-portal.service.ts` getParticipantInsights/Export — `assertRaceForUser` TRƯỚC (IDOR ✅); SQL param `?` raceId; paid filter `om.race_id + deleted=0 + financial_status='paid'`; cache 300s try/catch. ✅
3. `merchant-portal.controller.ts` — 2 GET, class guard ticket-scope (no finance) đúng (insights không phải data tiền). @ApiResponse đủ. ✅
4. FE `ParticipantsTab` — empty state, export loading, reuse HBars/Donut. ✅
5. SDK hand-add — types + fn khớp pattern; TD reconcile generate:api. ✅
**0 red flag.** Type safety: 0 any mới. No-PII confirmed (DTO chỉ label+count).

## Deploy
- Backend `be9a634` + Frontend `2f32f50` pushed main → DEV (CI).
- ⚠️ CI lag: DEV backend chưa update be9a634 tại thời điểm deploy doc — theo dõi, manual fallback nếu cần.

## Memory diff applied
- feature-log: shipped row F-072 + counter → 073
- change-history: F-072 entry
- known-issues: TD-F072-LABEL-I18N, TD-F072-IS-REPRESENT, TD-F072-SDK-HANDADD

## DEV smoke (Danny) trước PROD
1. Tab "Cơ cấu VĐV": size/giới/AG/quốc tịch/tỉnh render + nút Xuất Excel tải file OK.
2. Verify is_represent không phồng count (so total với tổng vé paid).
