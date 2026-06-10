# FEATURE-080: PRD — Race Title MySQL Platform Fallback Layer 3

**Status:** 🔵 READY
**Last updated:** 2026-06-09
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check
- [x] Đã đọc `00-manager-init.md` + F-079 IMPLEMENTATION_NOTES + PROD verify race 140/220 missing MongoDB

## 📝 Goal
Heartbeat hiển thị race title BỀN VỮNG không phụ thuộc MongoDB sync state hoặc Redis warm tay. Layer 3 MySQL platform fallback + Redis warm-back.

**Scope:**
- ✅ In: extend `resolveRaceTitlesSafe()` Layer 3 + warm Redis + tests
- ❌ Out: fix MongoDB race sync gap (F-048 backfill — feature riêng), đổi F-049 service, UI change

## 👤 Business Rules

- **BR-80-01:** Sau khi F-049 resolver return (hoặc throw → caught), compute `missing = raceIds.filter(id => !result.has(id))`. Nếu `missing.length > 0` → query MySQL platform `SELECT race_id, title FROM races WHERE race_id IN (?)` qua `orderRepo.manager.query` (connection 'platform' existing, `?` placeholder, ZERO interpolation).
- **BR-80-02:** Mỗi row trả về với `title` non-empty → `result.set(id, title)` + warm Redis `races:title:byMysqlId:<id>` TTL 3600s (PAUSE-80-01 chốt match F-049). Warm best-effort — Redis fail KHÔNG block (catch + warn).
- **BR-80-03:** Title rỗng/null/whitespace → SKIP set + SKIP warm (PAUSE-80-02 chốt) — composer fallback `Race {id}` per BR-79-23.
- **BR-80-04:** MySQL query throw → catch + log warn + return partial result hiện có. Heartbeat MUST NOT block (giữ BR-79-23 contract).
- **BR-80-05:** Layer 3 CHỈ chạy khi có missing IDs — zero overhead khi Layer 1/2 hit đủ.

## 🛡️ Testing Mandates

| TC | Setup | Expected |
|----|-------|----------|
| TC-80-01 | F-049 return đủ Map | MySQL query KHÔNG được gọi (BR-80-05) |
| TC-80-02 | F-049 return empty, MySQL trả 2 row | Map filled 2 entry + Redis setex called 2 lần TTL 3600 |
| TC-80-03 | F-049 partial (1/2), MySQL trả row còn lại | Map filled 2, MySQL query với [missing id] only |
| TC-80-04 | MySQL throw | Map = partial từ F-049, KHÔNG throw, logger.warn called |
| TC-80-05 | MySQL trả title rỗng `''` | Map KHÔNG set id đó, Redis KHÔNG warm (BR-80-03) |
| TC-80-06 | Cả F-049 throw + MySQL throw | Map empty, KHÔNG throw — composer fallback `Race {id}` |
| TC-80-07 | Redis setex throw khi warm | Map VẪN filled (warm best-effort), KHÔNG throw |

SEC-80-01: SQL `?` placeholder + params array verify (zero `${}`).

## 📌 Answers to PAUSE
- **PAUSE-80-01:** TTL 3600s match F-049 ✓
- **PAUSE-80-02:** Title rỗng → skip (BR-80-03) ✓

## ✅ Status: READY → `/5bib-plan`
