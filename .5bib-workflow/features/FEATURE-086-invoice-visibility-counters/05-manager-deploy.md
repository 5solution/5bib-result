# FEATURE-086: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-06-16
**Author:** 5bib-manager

## 🔬 Manager Code Review (đọc code thật)
- **`invoice-reconcile.service.ts buildRecapExtras/refreshCumulativeIssued`** — throw-safety 2 tầng đúng (inner catch fallback persisted, outer catch → {0,0}). Heartbeat MUST send guaranteed (TC-86-09 verify). MISA fail KHÔNG overwrite 0 (TC-86-05b). PASS.
- **`alert-composer.ts computeErrorBreakdown`** — breached ⊂ unissued (verified classifier: breachedCount chỉ set trên bucket UNISSUED), KHÔNG cộng đôi. PASS.
- **`misa-meinvoice.client.ts countInvoicesInRange`** — 1 page take=1, reuse fetchPageWithRetry, đọc totalCount. Idempotent. PASS.
- **`daily-counters.service.ts`** — cumulative SET no-TTL (không INCR), defensive parse. PASS.
- **`invoice-alert.service.ts`** — extras optional, backward-compat. PASS.

Zero red flag. Independent adversarial agent 7/7 PASS. 145/145 test. tsc clean (invoice-reconcile).

## 📊 Summary
- Base: `2e3f993` (= PROD release/v1.18.0). Branch `5bib_invoice_v2`.
- 5 service + 2 test file. KHÔNG đụng reconcile/classify/schema/SQL. Bot isolation intact.
- Resolves Danny visibility gap: tổng từ 08/06 + hôm nay N/M + đang lỗi N(breakdown) vào heartbeat 2h + EOD.

## 📝 Memory diff
- feature-log: F-086 DEPLOYED, counter → F-087.
- change-history: F-086 entry (5 file + design SET-not-INCR + error snapshot).
- known-issues: +TD-F086-01-MISA-TOTALCOUNT-RAW 🟢.

## 🌿 Deploy
- Commit chọn lọc: CHỈ invoice-reconcile + .5bib-workflow/F-086 + memory. KHÔNG commit package.json/landing/igloo (work dở branch igloo).
- Push `5bib_invoice_v2` → cut `release/v1.19.0` → PROD.

## 🔮 Follow-up
- Sau deploy: verify heartbeat tick kế (8/10/12/14/16/18/20/22h ICT) hiển thị 3 dòng + "Tổng từ 08/06" ra số thật từ MISA.
- TD-F086-01: nếu Danny/Hiền thấy số "tổng" cao bất thường → lọc ReferenceType (HĐ gốc) trong countInvoicesInRange.
