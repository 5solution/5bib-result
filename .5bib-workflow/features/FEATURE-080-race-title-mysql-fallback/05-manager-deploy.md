# FEATURE-080: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-06-09
**Author:** 5bib-manager

## 🔬 Manager Code Review
- **`invoice-reconcile.service.ts` resolveRaceTitlesSafe + queryRaceTitlesMysql** — verified: 2-phase chain đúng Plan tech approach, `?` placeholder line query, title trim + skip empty BR-80-03, setex catch best-effort BR-80-02, outer try/catch BR-80-04. Zero red flag.
- **Spec +7 TC** — coverage đủ 5 BR + double-fail + Redis-fail edge. PASS.

## 📊 Summary
- QC ✅ APPROVED · 21/21 + 124/124 zero regression · Scope 2 file exact
- Resolves **TD-F079-MONGODB-RACE-SYNC-MISSING** (Redis warm tay không cần nữa — Layer 3 tự warm-back mỗi khi miss)

## 📝 Memory diff
- feature-log: F-080 DEPLOYED, counter → F-081
- known-issues: TD-F079-MONGODB-RACE-SYNC-MISSING → RESOLVED (Layer 3); note F-048 backfill races 140/220 vào MongoDB vẫn là việc riêng (nice-to-have, không còn urgent)
- conventions: F-080 pattern "Resolver chain multi-layer + warm-back" footnote vào F-079.3

## 🔮 Follow-up
- Resolver chain giờ 4 layer: Redis → Mongo → MySQL → `Race {id}`. Future feature cần race title → dùng pattern này.
