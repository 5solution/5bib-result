# FEATURE-066 — Implementation Notes

> Mandate Danny 2026-05-19: mỗi feature phải có IMPLEMENTATION_NOTES.md 4 sections để Coder/QC/Manager đồng bộ context.

---

## 1. Quyết định kỹ thuật trọng yếu

### 1.1 Overload signature thay vì breaking change

`ContractNumberService.generateNumber()` thêm overload mới `generateNumber({signDate, partnerShortName?, entityName?, providerId})` BÊN CẠNH legacy 3-positional signature `(signDate, clientShortName, providerId)`. Lý do:

- F-024 existing tests + call sites (vd tests F-044/F-064 multi-provider render) dùng legacy signature → không muốn force migrate hết trong 1 PR.
- TypeScript overload resolution chọn args-object khi gọi `generateNumber({...})`, fallback legacy khi gọi `(date, 'TAM', '5BIB')`.
- Test mock của F-024 (`mockRedis.incr` shared counter) vẫn work — KHÔNG break 10 existing tests.

Trade-off: 2 signatures cùng tồn tại → tăng complexity đọc code. Mitigation: JSDoc rõ ràng + comment khuyến nghị args-object cho new code.

### 1.2 Partner lookup defensive try/catch

Trong `contracts.service.activate()` thêm partner lookup để đọc `shortName` mới nhất:

```typescript
let partnerShortName: string | null | undefined;
try {
  if (c.partnerId) {
    const partner = await this.partnerModel
      .findOne({ _id: c.partnerId, deletedAt: null }, { shortName: 1 })
      .lean();
    partnerShortName = partner?.shortName ?? null;
  }
} catch (err) {
  this.logger.warn(`lookup partner.shortName fail — fallback strip entity...`);
  partnerShortName = null;
}
```

Lý do:
- Test mock `mockPartnerModel.findOne` return undefined → `.lean()` throws → catch → fallback null → service tiếp tục bằng `stripCompanyPrefix(entityName)`.
- Production: partner có thể đã soft-delete khi admin activate HĐ DRAFT cũ → fallback null acceptable.
- Network/Mongo blip → log warn + continue. KHÔNG block activate flow.

### 1.3 Per-key counter mock cho TC-66

F-024 spec dùng shared counter `let counter = 0; incr: () => ++counter` — 2 keys khác nhau vẫn share counter → test `'2 contracts cùng day → unique seq'` chỉ assert `r1.sequence !== r2.sequence` (mơ hồ, vẫn pass).

F-066 cần verify chính xác per-(year, client) isolation → tạo `perKeyRedis` mock mới:

```typescript
const counters: Record<string, number> = {};
perKeyRedis = {
  counters,
  incr: jest.fn(async (key: string) => {
    counters[key] = (counters[key] ?? 0) + 1;
    return counters[key];
  }),
  ...
};
```

Tách `describe` block riêng → KHÔNG đụng F-024 tests (counter-shared).

### 1.4 Diacritics handling

`stripVietnameseDiacritics()` dùng NFD normalize + range `[̀-ͯ]` (U+0300–U+036F combining marks) + d/D map. Verify với Node:

```js
'CÔNG'.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
// → 'CONG'
```

Source: token CLIENT trong số HĐ phải ASCII safe (filename / DOCX header / URL slug downstream). Diacritics gây issue với contract render template (Times New Roman có thể không hỗ trợ glyph compound).

## 2. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Admin nhập shortName trùng partner khác | Medium | Medium (counter share → số HĐ "lệch" — vd partner B seq=5 vì partner A trước đó dùng "TAM") | OQ-66-01 = YES — `assertShortNameUnique()` throw 409 với VN message |
| 2 admin tạo HĐ cùng ms cho cùng client | Low | Low | Redis INCR atomic + collision retry 5x (F-024 BUG-002 giữ nguyên) |
| Existing HĐ cũ contractNumber inconsistent | High (by design) | Low (cosmetic) | PAUSE-66-03 forward-only documented |
| Legacy `contracts:sequence:<year>` keys orphan | Low | Trivial | BR-66-16 acceptable — manual cleanup nếu cần |
| Race condition partner update vs HĐ activate | Low | Low (BR-66-10 read shortName ngay tại activate) | partner lookup lúc activate luôn fetch fresh, không snapshot. Eventual consistency acceptable |
| Partner lookup fail (Mongo blip) | Low | Low | defensive try/catch → fallback strip entityName |
| DTO bypass: admin send lowercase shortName via raw HTTP | Low | Low | class-validator @Matches reject 400. Service sanitize defense-in-depth |

## 3. Migration & deploy notes

### 3.1 Pre-deploy steps
1. Verify branch `feat/F-066-contract-number-format` rebased lên `origin/main` mới nhất.
2. CI green (TSC contracts module + 295/295 tests).
3. Backend deploy DEV → smoke test create Partner với shortName → tạo HĐ → activate → verify số HĐ format đúng.
4. Frontend admin deploy DEV → verify PartnerPicker form field "Tên viết tắt" hiển thị helper text + auto-transform.

### 3.2 Database migration
**KHÔNG cần migration script.** `Partner.shortName` field đã exists trong schema từ F-024. Existing partners có shortName=undefined → fallback strip entityName tự động. Bandwidth-friendly deploy.

### 3.3 Redis migration
**KHÔNG migrate keys cũ.** BR-66-16 acceptable. Cron `redis-cli DEL contracts:sequence:2024 contracts:sequence:2025` chạy 1 lần sau deploy để cleanup ~5 keys orphan (optional, low priority).

### 3.4 Rollback plan
Single commit revert: `git revert <merge-commit>` trên main → CI tự deploy. Contract numbers đã sinh giữ nguyên (immutable trong Mongo). Sequence Redis state không cần rollback (key mới `:client` keys orphan tự nhiên).

## 4. Lessons learned

### 4.1 Forward-only > retroactive migration
Manager BA chốt PAUSE-66-03 forward-only sớm → tiết kiệm scope. KHÔNG cần background job regenerate HĐ cũ (high-risk, audit trail break). Existing HĐ ACTIVE giữ contractNumber → admin/finance không bị confused số HĐ đổi đột ngột.

### 4.2 OQ early identification = scope clarity
OQ-66-01 (pre-check uniqueness shortName) — BA raise sớm trong PRD Section 10. Manager Plan chốt YES → Coder implement gọn 30 LoC. Không có OQ này, coder có thể implement sai (skip uniqueness) → QC fail → rework. Pattern: BA raise OQ → Manager decide → Coder execute.

### 4.3 Test mock parity với real Redis behavior
F-024 shared-counter mock đã "đủ tốt" cho F-024 logic (single global key) nhưng KHÔNG đủ cho F-066 per-key isolation. Bài học: khi service-level semantics đổi (sequence key sharding), test mock cũng phải refactor — KHÔNG dùng lại pattern cũ blind. Per-key counter `Record<string, number>` là pattern chuẩn cho future per-X sharding tests.

### 4.4 Defense-in-depth UI + DTO + service
3 layers validate cho shortName:
- L1 UI: onChange auto-transform `.toUpperCase().replace(/[^A-Z0-9]/g,"")` + maxLength=16
- L2 DTO: `@MaxLength(16) @Matches(/^[A-Z0-9]+$/)` reject 400
- L3 Service: `sanitizeToken()` defensively strip + slice trước khi build contractNumber

Lý do: admin có thể bypass L1 (curl/Postman), L2 catches. Service-layer `sanitizeToken()` defense-in-depth nếu DTO config sai sót sau refactor tương lai. Chuẩn 5BIB hardening practice (referenced trong F-049/F-057 lessons).

### 4.5 Args-object signature > positional for >3 params
Legacy 3-positional `(signDate, clientShortName, providerId)` giới hạn — không thể thêm `partnerShortName` mà không break call sites. Args-object `({signDate, partnerShortName?, entityName?, providerId})` cho phép:
- Future-proof: thêm field mới (vd `forceSequence?: number` cho admin override) không break existing callers.
- Self-documenting: caller đọc `{partnerShortName, entityName}` rõ hơn `(undefined, 'CTCP TAM AN')` positional.
- TypeScript narrowing tốt hơn cho optional fields.

Pattern này nên apply cho future services với >3 args.
