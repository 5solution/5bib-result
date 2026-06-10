# FEATURE-080: Race Title Resolver — MySQL Platform Fallback Layer 3

**Status:** 🟡 INITIATED
**Created:** 2026-06-09
**Owner:** Danny
**Type:** BUGFIX (resolve TD-F079-MONGODB-RACE-SYNC-MISSING)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

F-079 heartbeat dùng F-049 resolver (Redis → MongoDB `races` collection). PROD verify: MongoDB chỉ có 60 race docs, KHÔNG có race 140 + 220 (races chưa được tạo trong hệ result) → resolver miss → composer fallback `Race 220` degraded. Workaround hiện tại: Manager warm Redis tay TTL 3600s — **expire mỗi giờ, không bền**.

Fix: thêm Layer 3 MySQL platform fallback trong `resolveRaceTitlesSafe()` — khi F-049 miss, query `races.title` MySQL platform trực tiếp (InvoiceReconcileModule ĐÃ có connection 'platform') + warm Redis F-049 key để các lần sau Layer 1 hit.

> Ironic note: BA F-079 PRD BR-79-21 đề xuất MySQL direct, Manager Plan correct sang reuse F-049 — đúng về pattern nhưng thực tế MongoDB data gap. F-080 = MySQL làm FALLBACK layer 3 (không thay thế F-049 chain), best of both.

## 📂 Impact Map

### Module sẽ chạm
- `backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts` — extend `resolveRaceTitlesSafe()` thêm Layer 3
- `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.service.spec.ts` — extend tests

### Resolver chain mới
```
Layer 1: Redis `races:title:byMysqlId:<id>` (3600s)     — F-049
Layer 2: MongoDB `races` collection (mysql_race_id)      — F-049
Layer 3: MySQL platform `races.title` (NEW F-080)        — + warm Redis
Layer 4: Composer fallback `Race {raceId}`               — F-079 BR-79-23
```

### Schema/DB
- MySQL platform: READ-ONLY `SELECT race_id, title FROM races WHERE race_id IN (?)` — verified PROD có data (140="5BIB x COROS", 220="LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG")
- Redis: warm key F-049 namespace existing — KHÔNG key mới
- MongoDB: KHÔNG đụng

## ⚠️ Risk Flags
- 🟢 LOW — single method extend, defensive try/catch giữ nguyên BR-79-23 (heartbeat MUST NOT block)
- 🟢 LOW — raw SQL `?` placeholder pattern F-016/F-028 existing trong cùng service

## 🚧 PAUSE Conditions cần BA xác nhận
- [ ] PAUSE-80-01: Redis warm từ Layer 3 dùng TTL bao nhiêu? Đề xuất 3600s match F-049.
- [ ] PAUSE-80-02: Race title rỗng/null trong MySQL → skip warm (composer fallback `Race {id}`)?

## ✅ Sẵn sàng cho /5bib-prd
- [x] Yes
