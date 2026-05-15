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

- [ ] **Status whitelist:** BR-PNL-08 hiện strict `status: ['ACTIVE','COMPLETED']` — list F-038 có giữ rule này HAY include DRAFT (pipeline preview)?
  - Recommend: giữ ACTIVE+COMPLETED để consistency với dashboard. Drafts đã có wizard step 4 P&L preview real-time + detail page card.
- [ ] **Default sort:** profit DESC (top earners) hay anchorMonth DESC (recent first) hay status?
  - Recommend: anchorMonth DESC (recent first) — standard table pattern.
- [ ] **Search field:** contractNumber + partnerName + raceName combined OR contractNumber-only?
  - Recommend: combined (Mongo `$or` match cả 3 fields). Existing `/contracts` list dùng pattern này.
- [ ] **Page size:** 20 / 50 / 100?
  - Recommend: 20 default + selector. Mirror `/contracts` PAGE_SIZE convention.
- [ ] **Margin badge legend:** Show legend "🟢 Healthy > 10% / 🟡 Thin 0-10% / 🔴 Loss < 0% / ⚪ Neutral (no revenue)" trên page header?
  - Recommend: Có — accessibility + first-time user explain.
- [ ] **Export:** CSV/Excel button reuse `PnLExportButton` cho list này không, hay defer Phase 2?
  - Recommend: Defer Phase 2 (existing `PnLExportButton` chỉ export dashboard tổng; list export riêng cần backend endpoint mới).

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

- [ ] Yes — BA có thể bắt đầu sau khi Danny confirm 6 PAUSE conditions
- [x] Cần Danny xác nhận: 6 questions trong PAUSE Conditions section (đặc biệt status whitelist + default sort + search field + page size)

---

## 🔗 Next step

Danny trả lời 6 PAUSE → `/5bib-prd FEATURE-038-finance-contracts-list-pnl`

Hoặc nếu Danny chấp nhận recommendations mặc định → BA proceed luôn.
