# FEATURE-088 — IMPLEMENTATION_NOTES

## 1. 🚧 Deviations from Spec (intentional)
- **Spec said:** "thao tác từng đơn (đánh dấu đã xử lý)".
  **I did:** resolved = SET Redis scope-by-date + TTL 7d, flag `resolved` trên row, FE ẩn/giảm mờ. KHÔNG re-issue/hủy hóa đơn.
  **Why:** F-076 READ-ONLY (webhook legacy xuất, F-076 chỉ đối soát) → không thể xuất/hủy. "Đã xử lý" = ack nội bộ declutter.
  **Reviewer check:** markOrderResolved chỉ SADD/SREM Redis, không chạm MISA/DB.

## 2. ⚙️ Forced Changes (reality ≠ spec)
- **PRD assumed:** trang dashboard mới.
  **Reality:** trang `/invoice-reconcile` đã tồn tại (F-076) với KPI/table/trigger/poll.
  **Workaround:** EXTEND trang sẵn có (thêm 2 card + health panel + 2 nút), KHÔNG tạo route mới.
- **Forced:** /trigger phải enrich (không thì FE mất card F-088 sau khi bấm). Cả /today + /trigger giờ đều enrich.

## 3. ⚖️ Tradeoffs
| Decision | Chosen | Alternative | Why | Cost |
|---|---|---|---|---|
| Cumulative trong /today | persisted + refresh throttled SETNX 5p | refresh mỗi poll | Không hammer MISA (poll 60s) | Số "tổng" trễ tối đa 5p |
| resolved scope | per-date + TTL 7d | global no-TTL | Tránh phình + ngữ nghĩa "hôm nay" rõ (QC BUG-01) | Đơn còn lỗi sang ngày mới phải ack lại (đúng nghiệp vụ) |
| Poll vs optimistic | overridesRef merge | skip poll khi in-flight | Đơn giản, tự clear khi server bắt kịp (QC BUG-03) | 1 ref Map |

## 4. 🔬 Reviewer Notes (priority)
1. `service.ts enrichReport` — KHÔNG mutate report gốc (clone missing). refreshCumulativeThrottled SETNX `acquired==='OK'` mới gọi MISA.
2. `service.ts markOrderResolved(date,...)` — SADD key `invoice-reconcile:resolved:<date>` + EXPIRE 7d; SREM không EXPIRE.
3. `controller` — 2 endpoint mới dưới class `@UseGuards(LogtoFinanceGuard, ThrottlerGuard)`; /send-heartbeat @Throttle 3/min; /resolve ResolveOrderDto validate (IsInt/Min/IsBoolean/Matches date).
4. `client.tsx onResolve` — overridesRef.set + optimistic; rollback xóa override + revert UI; applyOverrides merge mỗi fetch (poll + trigger) → tự clear khi server.resolved===want.
5. VN convention: KpiStrip subtitle đã Việt hóa (Chưa xuất/trùng/lạc/MISA lỗi); health-panel map MISA_STATUS_LABEL.

## Tests
- backend 155/155 (8 F-088: enrich/throttle/resolved SADD-SREM-EXPIRE/no-mutate/best-effort + controller mock).
- admin `next build` ✓ compiled; backend tsc 0 new errors.
- Adversarial QC agent: 8 mục, 1 MEDIUM (BUG-03) + 3 LOW fixed; 2 INFO + audit-actor accepted as TD.

## TD
- TD-F088-AUDIT-ACTOR 🟢 — audit emit hardcode userId='unknown' (pre-existing F-076 pattern, lan sang 2 endpoint mới). Cần đọc req.logto.userId. Defer.
- TD-F088-RESOLVE-NO-EXISTENCE-CHECK 🟢 INFO — /resolve SADD orderId bất kỳ (chỉ rác Redis nội bộ, đã guard finance). Accept MVP.
