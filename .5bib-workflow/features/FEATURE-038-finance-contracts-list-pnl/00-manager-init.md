# FEATURE-038: Finance Contracts List with P&L Per Row

**Status:** 🟡 INITIATED
**Created:** 2026-05-15
**Owner:** Danny
**Type:** BUGFIX + EXTEND_EXISTING (F-028 Phase 2 follow-up — replace placeholder `/finance/contracts` page)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Hiện tại trang `/finance/contracts` (admin nav entry "P&L theo HĐ") là **placeholder page** từ F-028 Phase 1 era (2026-05-12) — chỉ hiển thị hướng dẫn text "vào contract detail rồi click section Lãi/Lỗ", KHÔNG có data thật.

Trong khi đó `/finance` đã có dashboard aggregated (Top profit / Loss-making / Trend / Donut) nhưng KHÔNG show **full list HĐ với P&L per row** để admin nhìn tổng quan tất cả deals.

Danny request 2026-05-15: thay placeholder bằng **list HĐ với KPI inline per row** (contractNumber / partner / revenue / cost / profit / margin tier) + click row → `/finance/contracts/[id]` detail.

---

## 📂 Impact Map (theo memory hiện tại)

### Module sẽ chạm

**Backend:**
- `backend/src/modules/finance/services/pnl.service.ts` — extend với method `getContractsList()` (full paginated list thay vì top10/loss10 slice). Reuse compute logic của `getDashboardData()`.
- `backend/src/modules/finance/controllers/pnl-dashboard.controller.ts` — thêm endpoint `GET /api/finance/pnl/contracts`
- `backend/src/modules/finance/dto/pnl-response.dto.ts` — thêm `PnLContractsListDto` paginated response
- `backend/src/modules/finance/dto/pnl-filter.dto.ts` — extend DTO với `page` + `limit` + `sortBy` + `sortDir` + optional `q` (search)
- Unit test: `pnl.service.spec.ts` extend với TC-CL-* (contracts list)

**Admin:**
- `admin/src/app/(dashboard)/finance/contracts/page.tsx` — **REWRITE** từ placeholder → list table với TanStack Query hook
- `admin/src/lib/finance-api.ts` — thêm `getContractsList()` helper + types `PnLContractsListResponse` + `DashboardFilter` extend
- Reuse: `PnLDashboardTabs`-like filter component (period / dateFrom / dateTo) — extract chung hoặc clone

### File then chốt cần Coder đọc trước khi code

- `backend/src/modules/finance/services/pnl.service.ts:344-530` — getDashboardData() current compute path
- `backend/src/modules/finance/services/pnl.service.ts:165-310` — getSummary() single-contract reference
- `admin/src/app/(dashboard)/finance/_components/dashboard-client.tsx` — pattern reuse cho client component fetch+state
- `admin/src/app/(dashboard)/contracts/_components/contract-list-table.tsx` — pattern table sort/pagination
- `admin/src/lib/finance-api.ts:298-344` — `DashboardContractItem` shape (reuse cho row item)

### Endpoint liên quan

- (mới) `GET /api/finance/pnl/contracts?period=last_3_months&dateFrom=...&dateTo=...&page=1&limit=20&sortBy=profit&sortDir=desc&q=keyword` — paginated list
- (reuse logic) backend compute từ `getDashboardData()` no-slice → all contracts

### Schema/DB

- KHÔNG đụng MongoDB schema
- KHÔNG đụng MySQL platform schema
- Redis: thêm cache key pattern `pnl:contracts-list:<filterHash>` TTL 60s (mirror dashboard cache pattern)

### UI Wireframe (BA sẽ làm detail trong /5bib-prd)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ P&L theo Hợp đồng                                  [Period Filter]      │
├─────────────────────────────────────────────────────────────────────────┤
│ Filter: 3 tháng gần nhất / Tất cả / TIMING / TICKET_SALES / search...   │
├──┬─────────────┬──────────────┬─────────────┬───────────┬──────────────┤
│ #│ Số HĐ       │ Đối tác/Giải │ Doanh thu   │ Chi phí   │ Lãi/Lỗ + %   │
├──┼─────────────┼──────────────┼─────────────┼───────────┼──────────────┤
│ 1│ 14.05/2026/.│ Zaha April   │ 209.199.994 │ 1.000.000 │+208M (99.5%) │ ← click row → detail
│ 2│ 11.05/2026/.│ Thach Sanh   │  57.451.000 │   100K    │ +57M (99.8%) │   🟢 healthy
│ 3│ ...         │ ...          │ ...         │ ...       │ ...          │   🟡 thin
│ N│ ...         │ ...          │ ...         │ ...       │ -8M (-7.3%)  │   🔴 loss
├──┴─────────────┴──────────────┴─────────────┴───────────┴──────────────┤
│ Tổng: N HĐ — Doanh thu: X — Chi phí: Y — Lãi/Lỗ: Z (avg margin: M%)    │
└─────────────────────────────────────────────────────────────────────────┘
[Pagination: 1 2 3 ... ]
```

Row click → `/finance/contracts/{contractId}` (existing detail page F-028 Phase 1).

---

## ⚠️ Risk Flags

- 🟢 **LOW backend** — Reuse `getDashboardData()` compute path (đã proven F-028 + F-036 P&L additive). Chỉ thêm pagination + sort + search → no new compute logic.
- 🟢 **LOW admin** — Mirror existing `/contracts` list page pattern (contract-list-table.tsx). No new UI primitive.
- 🟡 **MED perf** — Full list paginated thay vì top10 → request size lớn hơn. Cần cache Redis TTL 60s + index sort (revenue/profit/margin). Backend chunk MySQL bulk call đã sẵn (F-029 HIGH-PERF-01).
- 🟢 **LOW security** — Admin-only (BR-PNL-08 LogtoAdminGuard inherited). No new threat surface.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

**✅ Danny chốt "A" 2026-05-15 — accept tất cả 6 defaults:**

- [x] **PAUSE-38-01 Status whitelist:** ✅ Giữ BR-PNL-08 strict `status: ['ACTIVE','COMPLETED']` — consistency với dashboard `/finance`. DRAFT đã có preview wizard step 4 + detail page card.
- [x] **PAUSE-38-02 Default sort:** ✅ `anchorMonth DESC` (recent first — standard table pattern).
- [x] **PAUSE-38-03 Search field:** ✅ Combined `contractNumber + partnerName + raceName` (Mongo `$or` match 3 fields). Pattern reuse `/contracts` list.
- [x] **PAUSE-38-04 Page size:** ✅ 20 default + selector 20/50/100. Mirror `/contracts` PAGE_SIZE convention.
- [x] **PAUSE-38-05 Margin badge legend:** ✅ Show legend trên page header — 🟢 Healthy >10% / 🟡 Thin 0-10% / 🔴 Loss <0% / ⚪ Neutral no revenue. Accessibility + first-time user explain.
- [x] **PAUSE-38-06 Export CSV/Excel:** ✅ Defer Phase 2. Existing `PnLExportButton` chỉ export dashboard tổng; list export riêng cần backend endpoint mới.

**BA paste 6 answers này vào section "Answers to Manager's PAUSE conditions" trong `01-ba-prd.md`.**

---

## 🎯 Success criteria (gợi ý cho BA)

- Admin nav "P&L theo HĐ" click → land trên list page (KHÔNG còn placeholder text)
- Default load: ≤ 500ms p95 cached (Redis TTL 60s mirror dashboard pattern)
- List support 100+ HĐ với pagination smooth (page navigate < 300ms)
- Row click → detail page navigation work với contractId từ row
- Filter period + search + sort + pagination state preserved trong URL query params (deep-linkable)
- Margin tier color đúng (🟢/🟡/🔴/⚪) per F-028 Phase 3 convention
- Mobile responsive: table horizontal scroll trên < md screen

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — Danny chốt "A" accept 6 defaults 2026-05-15. BA proceed luôn.

---

## 🔗 Next step

Danny chạy: **`/5bib-prd FEATURE-038-finance-contracts-list-pnl`**

BA agent (5bib-po-ba) sẽ:
1. Đọc `00-manager-init.md` (file này) + memory codebase-map + known-issues
2. Output `01-ba-prd.md` theo template với structured tables MANDATORY (per Manager directive 2026-05-14):
   - UI Step-by-Step numbered table (action / UI behavior / trigger / next state)
   - Buttons Specification Table
   - Form Fields Specification (validation regex + error messages tiếng Việt)
   - Backend Endpoint Specification Table
   - DTO field-level TypeScript code block
   - TC-XX backend test cases (8 elements: Method/URL/Headers/Body/Expected status/Expected body shape/MUST NOT leak/Side effect verify)
   - Frontend E2E Playwright table
3. Paste 6 PAUSE-38-* answers từ file 00 vào section "Answers to Manager's PAUSE conditions"
