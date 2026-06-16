# FEATURE-086 — IMPLEMENTATION_NOTES

## 1. 🚧 Deviations from Spec (intentional)
- **Spec said (synthesis map):** "INCR cumulative theo diff event ISSUED".
  **I did:** cumulative = MISA `TotalCount` over [08/06→today], SET (không INCR).
  **Why:** diff `ISSUED` chỉ fire khi đơn ĐI QUA missing list rồi resolved → đơn xuất nhanh (chưa kịp vào missing) bị MISS → undercounting. MISA TotalCount là authoritative + idempotent (SET, gọi lại ra cùng số → zero double-count by construction).
  **Reviewer check:** `refreshCumulativeIssued` không INCR; `setCumulativeIssued` dùng `redis.set`.
- **Spec said (option synthesis):** error có thể tính cumulative.
  **I did:** error = **snapshot hiện tại** (không tích lũy).
  **Why:** đơn UNISSUED hôm nay → mai xuất xong là hết lỗi; đếm tích lũy lỗi phình ảo/vô nghĩa. "Đang có N đơn lỗi" actionable hơn. (Manager design call, Danny review được.)
  **Reviewer check:** `computeErrorBreakdown` đọc `report.missing`/`duplicateCount`/`misaOrphan` (snapshot), KHÔNG persist.

## 2. ⚙️ Forced Changes (reality ≠ spec)
- **PRD assumed:** test mock F-079 cũ tự tương thích.
  **Reality:** `buildRecapExtras` gọi `misa.countInvoicesInRange` + `counters.getCumulativeIssued`/`setCumulativeIssued` — 3 method MỚI chưa có trong mock của `invoice-reconcile.service.spec.ts`.
  **Workaround:** thêm `countInvoicesInRange`/`getCumulativeIssued`/`setCumulativeIssued` vào 4 mock factory trong service spec (replace_all). KHÔNG đổi assertion cũ (extras là arg thứ 4, F-079 destructure `[, , raceTitlesByid]` không đụng).
  **Manager/BA action:** none.

## 3. ⚖️ Tradeoffs Considered
| Decision | Option chosen | Alternative | Why chose | Cost paid |
|----------|---------------|-------------|-----------|-----------|
| Nguồn cumulative | MISA TotalCount (SET) | INCR theo diff ISSUED | Authoritative + idempotent, không undercount | TotalCount gồm cả HĐ hủy/thay thế → số hơi cao vs issued-gốc (TD-F086-01) |
| Refresh tần suất | Mỗi heartbeat (2h) + EOD | Chỉ EOD 1×/ngày | Số "tổng" tươi trong ngày, không stale 1 ngày | +8 MISA call/ngày (1 page take=1 — rẻ) |
| Error metric | Snapshot hiện tại | Cumulative lỗi | Actionable ("đang có N"), không phình ảo | Không có "tổng lỗi lịch sử" (không ai cần) |
| misaFail trong error | Gộp vào errorTotal | Tách riêng infra | Danny chốt gộp cả 4 loại | Trộn lỗi nghiệp vụ + hạ tầng → mitigate bằng breakdown hiển thị rõ |

## 4. 🔬 Reviewer Notes (Manager + QC focus — priority order)
1. **`invoice-reconcile.service.ts` `buildRecapExtras`/`refreshCumulativeIssued`** — throw-safety 2 tầng (heartbeat MUST send). Hotspot: catch lồng nhau — inner catch fallback `getCumulativeIssued()` nếu cũng throw thì outer catch → `{0,0}`. Test TC-86-09.
2. **`alert-composer.ts` `computeErrorBreakdown`** — breached ⊂ unissued, KHÔNG cộng `breachedCount` riêng (test TC-86-03 chống double-count).
3. **`misa-meinvoice.client.ts` `countInvoicesInRange`** — fetch 1 page take=1, đọc TotalCount. Reuse `fetchPageWithRetry`.
4. **`daily-counters.service.ts`** — cumulative SET no-TTL (idempotent). `getCumulativeIssued` defensive (negative→0).
5. Type safety: KHÔNG raw `any` ngoài `[{} as any]` trong test fixture (orphan length). Best-effort try/catch mọi Redis/MISA.

## Tests
- 145/145 invoice-reconcile module PASS (gồm f086-visibility-counters.spec 18 test + misa countInvoicesInRange 2 test).
- tsc: 0 lỗi trong invoice-reconcile (4 lỗi `upload/*.spec` `vi` global = PRE-EXISTING, module khác).
- QC adversarial verify (independent agent): 7/7 PASS, 0 bug blocking.

## Known limitation → TD
- **TD-F086-01-MISA-TOTALCOUNT-RAW** 🟢 — "Tổng từ 08/06" = MISA TotalCount raw, gồm cả HĐ hủy/thay thế (không lọc ReferenceType như classifier). Số hơi cao vs issued-gốc. Visibility OK, ghi memo cho Hiền. Refine nếu Danny thấy lệch.
