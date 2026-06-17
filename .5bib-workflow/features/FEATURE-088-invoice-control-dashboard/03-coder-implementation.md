# FEATURE-088: Coder Implementation Log
**Status:** 🟠 READY_FOR_QC → 04
**Date:** 2026-06-16

## Files (backend 4 + frontend 5 + test 2)
- ✏️ dto/reconcile-report.dto.ts (+ErrorBreakdownDto +3 optional field)
- ✏️ dto/missing-invoice-row.dto.ts (+resolved)
- ➕ dto/resolve-order.dto.ts (ResolveOrderDto + result DTOs)
- ✏️ services/invoice-reconcile.service.ts (enrichReport + refreshCumulativeThrottled + markOrderResolved/getResolvedOrderIds date-scoped)
- ✏️ invoice-reconcile.controller.ts (/today+/trigger enrich, +/send-heartbeat +/resolve)
- ✏️ lib/invoice-reconcile-api.ts (sendHeartbeat/setOrderResolved + types)
- ✏️ _components/kpi-strip.tsx (+2 card, VN subtitle)
- ➕ _components/health-panel.tsx
- ✏️ _components/invoice-reconcile-client.tsx (health + heartbeat btn + onResolve override-merge)
- ✏️ _components/missing-rows-table.tsx (resolve btn + hide toggle)
- ➕ __tests__/f088-dashboard-control.spec.ts (8) + ✏️ controller spec mock

## Tests
- 155/155 invoice-reconcile module PASS. tsc 0 new errors. admin next build ✓.
- Chi tiết deviations/tradeoffs/hotspots: IMPLEMENTATION_NOTES.md.
