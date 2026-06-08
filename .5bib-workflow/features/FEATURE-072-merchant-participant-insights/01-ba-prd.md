# FEATURE-072: PRD — Merchant Participant Insights

**Status:** 🔵 READY
**Author:** 5bib-po-ba · **Date:** 2026-06-08 · **Linked:** 00-manager-init

## Goal & Scope
BTC xem **aggregate** cơ cấu VĐV (đã thanh toán) để: đặt size áo, báo cáo tài trợ, chuẩn bị giải AG, hậu cần xuyên biên giới.
- ✅ In: tab mới "Cơ cấu VĐV" — size áo, giới tính, nhóm tuổi (AG WA 5-năm), quốc tịch, tỉnh/thành. + Xuất Excel size.
- ❌ Out: KHÔNG list VĐV cá nhân (no-PII, aggregate-only). KHÔNG ghi/sửa. KHÔNG đụng revenue.

**Danny chốt:** AG = World Athletics 5-năm · Tab riêng · Có Xuất Excel size.

## Business Rules
- **BR-72-01** Data: `athlete_subinfo` join `oli.id = asi.order_line_item_id` → `om` WHERE `om.race_id=? AND om.deleted=0 AND om.financial_status='paid'`. Mỗi row = 1 participant.
- **BR-72-02** AG bands (WA, tính tuổi tại **ngày đua** races.start; fallback now nếu thiếu): `<18, 18-24, 25-29, 30-34, 35-39, 40-44, 45-49, 50-54, 55-59, 60-64, 65-69, 70+`, + bucket **"Không rõ"** khi dob parse fail.
- **BR-72-03** `dob` varchar parse phòng thủ: chấp nhận `YYYY-MM-DD`, `DD/MM/YYYY`, `YYYY`; fail/rỗng/tuổi phi lý (<5 hoặc >100) → "Không rõ".
- **BR-72-04** `nationality` free-text → normalize: map biến thể VN ("VN/Vietnam/Việt Nam/VIE") → "Việt Nam"; còn lại giữ raw trim; rỗng → "Không rõ". Hiển thị **top-8 + "Khác"**.
- **BR-72-05** `gender`: map `male/m/nam→Nam`, `female/f/nữ→Nữ`, khác/rỗng→"Khác".
- **BR-72-06** Size: canonical order `XS<S<M<L<XL<XXL<XXXL`; size lạ/rỗng → "Khác", xếp cuối.
- **BR-72-07** `province` (city_province): trim; rỗng→"Không rõ"; top-10 + "Khác".
- **BR-72-08** Guard `LogtoMerchantGuard` (ticket-scope, KHÔNG cần finance). `assertRaceForUser` trước mọi query (IDOR).
- **BR-72-09** Cache `merchant-portal:participants:<userId>:<raceId>` TTL 300s (reuse cachedTicketRead pattern nhưng TTL 300 — dùng helper riêng hoặc cùng).
- **BR-72-10** Aggregate tính trong Node (pull rows) để parse dob/normalize robust — KHÔNG SQL GROUP trên field bẩn. An toàn ≤ ~15k participant/race.

## Endpoints (LogtoMerchantGuard)
| Element | Spec |
|---|---|
| `GET /api/merchant-portal/participants/insights?raceId=` | → `ParticipantInsightsDto` aggregate. 200/401/403/404. |
| `GET /api/merchant-portal/participants/export?raceId=` | → Excel (`@Res`), `Content-Disposition attachment`. Sheet1 Size×cự ly, Sheet2 Demographics. |

### DTO `ParticipantInsightsDto`
```ts
class InsightBucketDto { @ApiProperty() label: string; @ApiProperty() count: number; }
class ParticipantInsightsDto {
  @ApiProperty() raceId: number;
  @ApiProperty() totalParticipants: number;
  @ApiProperty({ type: [InsightBucketDto] }) shirtSizes: InsightBucketDto[];
  @ApiProperty({ type: [InsightBucketDto] }) genders: InsightBucketDto[];
  @ApiProperty({ type: [InsightBucketDto] }) ageGroups: InsightBucketDto[];
  @ApiProperty({ type: [InsightBucketDto] }) nationalities: InsightBucketDto[]; // top-8 + Khác
  @ApiProperty({ type: [InsightBucketDto] }) provinces: InsightBucketDto[];     // top-10 + Khác
}
```

## UI — tab mới "Cơ cấu VĐV" (race detail)
- Nav tab thứ 3 (Vé · Doanh thu · **Cơ cấu VĐV**). Hiện cho mọi merchant (ticket-scope).
- Layout: KPI "Tổng VĐV" + nút "Xuất Excel size" (góc phải) → Bar **Size áo** (canonical order) · Donut **Giới tính** · Bar **Nhóm tuổi (AG)** · Bar **Quốc tịch** (top-8) · Bar **Tỉnh/thành** (top-10).
- States: loading skeleton · empty ("Chưa có VĐV" khi total=0) · error retry · export loading.
- i18n 5 ngôn ngữ cho mọi label chrome (size/giới/AG/quốc tịch/tỉnh/nút xuất).

## Testing (TC — unit cho util thuần)
- TC-01 parseAge: "1990-05-01"/"01/05/1990"/"1990" → tuổi đúng; "abc"/""/"3000" → null.
- TC-02 ageGroupWA: 17→"<18", 27→"25-29", 70→"70+", null→"Không rõ".
- TC-03 normalizeNationality: "VN"/"vietnam"/"Việt Nam"→"Việt Nam"; "Cambodia" giữ; ""→"Không rõ".
- TC-04 gender map: "male"→Nam, "F"→Nữ, "x"→Khác.
- TC-05 size order: ["L","S","XXL","M"]→ S,M,L,XXL; "Free"→Khác cuối.
- TC-06 aggregate: rows hỗn hợp → buckets count đúng + total + top-N + "Khác" gộp phần dư.
- TC-07 nationalities top-8 + Khác: 12 quốc gia → 8 + Khác(gộp 4).
- TC-08 empty rows → tất cả mảng rỗng, total 0.
- E2E (QC): IDOR 403 cross-race · 401 no-token · no-PII (response không chứa tên/dob raw) · glyph tab render 5 lang.

## Status: READY → /5bib-plan
