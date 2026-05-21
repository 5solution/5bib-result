# FEATURE-049: F-048 Admin UX Humanization (engineer-speak → business language)

**Status:** 🟡 INITIATED
**Created:** 2026-05-20 23:30 ICT
**Owner:** Danny
**Type:** EXTEND_EXISTING (admin UI layer cho F-048 — không đụng backend domain logic)
**Created by:** 5bib-manager
**Parent feature:** `FEATURE-048-athlete-identity-foundation` (Phase 3 admin UI đã ship engineer-speak, F-049 humanize)
**Parallel ship:** F-047 resume (cùng 1 release — option C Danny chốt 2026-05-20)

---

## 🎯 Why this feature

> Danny critique 2026-05-20 sau khi review F-048 admin UI:
> *"Tao nhìn vào đây tao đéo hiểu gì hết ấy :v. Với ở phía người dùng thì họ xem ở đâu và như nào"*

F-048 Phase 3 admin UI ship được FUNCTIONAL nhưng nội dung toàn engineer-speak:
- Cluster ID UUID đầy đủ (`f47ac10b-58cc-4372-a567-0e02b2c3d479`)
- Email hash SHA256 prefix (`emailHash: a8d3f9b1`)
- Tier labels code (T1 / T2 / T3 / T4)
- Foreign keys raw (MYSQL RACE ID 192 / ATHLETES ID 9897)
- Mongo ObjectId reference (MONGO REF)
- Action labels engineer-y (Tách cluster / Gộp cluster khác)
- Confidence score number raw (0.85 / 0.60)

Admin staff (Hằng Sales, Hiền Finance, Tùng Ops) **không phải engineer** — họ cần UI tiếng Việt business-friendly để moderate identity clusters mà KHÔNG cần training về data model.

**Business value:** Unlock F-048 cho admin staff thực tế dùng (without F-049, F-048 chỉ engineer dùng được → ROI thấp). Foundation cho future admin UI features (clustering review = touchpoint cao tần ~daily với 94K athletes scale).

---

## 📂 Impact Map (theo memory hiện tại + Danny screenshot review)

### Module sẽ chạm — ZERO BACKEND DOMAIN LOGIC

**ADMIN UI ONLY (3 files):**
- `admin/src/app/(dashboard)/athletes/identity-clusters/page.tsx` — coverage dashboard rewrite columns + labels + filter
- `admin/src/app/(dashboard)/athletes/identity-clusters/[clusterId]/page.tsx` — detail rewrite race name join + action labels
- `admin/src/lib/identity-cluster-labels.ts` (NEW) — dictionary VN labels per `conventions.md` Display Convention

**BACKEND READ-ONLY ENRICHMENT (1 endpoint extend):**
- `backend/src/modules/race-master-data/controllers/identity-cluster-admin.controller.ts` — EXTEND response DTO to include `raceName` + `bibNumber` join (currently only mysql_race_id + athletes_id)
- `backend/src/modules/race-master-data/services/athlete-identity-clustering.service.ts` — ADD `enrichClusterWithRaceContext(cluster)` method (lookup races.title from mysql_race_id, race_athletes.bib_number from athletes_id)
- 1 NEW DTO field: `IdentityClusterAdminDto.linkedRaces[].raceName` + `bibNumber`

**NO CHANGES to:**
- ❌ Identity clustering algorithm logic
- ❌ Bulk sync orchestrator
- ❌ Database schema (athlete_identity_clusters collection unchanged)
- ❌ Cron jobs
- ❌ Public API

### File then chốt cần Coder đọc trước khi code

- `admin/src/app/(dashboard)/athletes/identity-clusters/page.tsx` — current engineer-speak rendering (target rewrite)
- `admin/src/app/(dashboard)/athletes/identity-clusters/[clusterId]/page.tsx` — detail page với merge/split forms
- `admin/src/lib/finance-labels.ts` — REFERENCE pattern cho `identity-cluster-labels.ts` dictionary
- `.5bib-workflow/memory/conventions.md` — Display Convention rule (KHÔNG render raw enum/snake_case)
- `backend/src/modules/race-master-data/controllers/identity-cluster-admin.controller.ts` — current response shape (chỉ trả raw IDs)
- `backend/src/modules/race-master-data/services/athlete-identity-clustering.service.ts` — `getClusterById()` để biết enrich injection point

### Endpoint liên quan

- `GET /api/admin/identity-clusters` — EXTEND response DTO add raceName/bibNumber per linked record
- `GET /api/admin/identity-clusters/:clusterId` — EXTEND response DTO add raceName/bibNumber + email semi-redacted
- 3 other endpoints (merge/split/coverage-stats) — NO CHANGE (write ops không cần enrich)

### Schema/DB

- MongoDB: collection `athlete_identity_clusters` (F-048) — READ-ONLY join với `races` collection (title field) + `race_athletes` collection (bib_number field)
- Redis: KHÔNG cache mới (admin read-heavy chấp nhận MongoDB query — F-048 đã có `${MS_PER_PAGE}=20` pagination)
- NO migration needed

---

## ⚠️ Risk Flags

- 🟢 **[LOW] Zero backend domain logic risk** — chỉ thêm DTO field enrich + admin UI label rewrite. Backend algorithm/cron/schema unchanged.
- 🟢 **[LOW] Race name lookup performance** — N+1 query risk khi pagination 20 clusters × 10 linked races = 200 race lookups. Mitigate via `$in` aggregation pipeline (single MongoDB query) hoặc Redis cache `races:title:byMysqlId:<mysql_race_id>` TTL 1h.
- 🟡 **[MED] Email full display admin trust boundary** — PAUSE-49-02 OVERRIDE: admin UI shows full email (no redact). PII defense relies on `LogtoAdminGuard` gate + `select:false` MongoDB schema layer + log sanitize hash proxy. **BA PRD MUST document:** boundary giữa UI render (full email for admin) vs log output (hash proxy `[emailHash:abc12345]`) — không nhầm lẫn.
- 🟡 **[MED] Traffic light threshold consistency** — confidence ≥0.9 🟢 / 0.6-0.9 🟡 / <0.6 🔴 phải align với F-048 T1/T2/T3 tier boundaries (T1=1.0/T2=0.85/T3=0.6) để không conflict user mental model.
- 🟢 **[LOW] Bilingual UI risk** — toàn UI tiếng Việt mới, KHÔNG mix English. Backend giữ enum code (T1/T2/T3/T4) — chỉ FE map qua dictionary.

---

## 🚧 PAUSE Conditions — ✅ ALL CONFIRMED Danny 2026-05-20 23:45 ICT

- [x] **PAUSE-49-01:** ✅ Cluster ID truncate `#abc12345` (8 char) + copy-to-clipboard icon (Linear/GitHub pattern).
- [x] **PAUSE-49-02:** ⚠️ **OVERRIDE — admin context không che chắn email.** Hiển thị full email `daohaian@gmail.com` (no semi-redact). Lý do Danny: admin staff trusted, không cần PII proxy khi đã pass guard `LogtoAdminGuard`. **PII defense vẫn giữ:** select:false at MongoDB schema layer + DTO whitelist + log sanitize `[emailHash:abc12345]` (logger output proxy giữ nguyên, KHÔNG ảnh hưởng UI render). **BA PRD MUST document:** UI shows full email for admin role, log output STILL uses hash proxy (no raw email log).
- [x] **PAUSE-49-03:** ✅ shadcn Badge variant traffic light: ≥0.9 `success` "Tin cậy cao" / 0.6-0.9 `warning` "Tin cậy trung bình" / <0.6 `destructive` "Cần xem xét".
- [x] **PAUSE-49-04:** ✅ Tier business labels confirmed:
  - T1 → "Định danh qua email — Tin cậy cao"
  - T2 → "Định danh qua Tên + Năm sinh + Giới tính — Tin cậy trung bình"
  - T3 → "Cần xem xét lại — Tin cậy thấp"
  - T4 → "Không định danh được"
- [x] **PAUSE-49-05:** ✅ "Tách cluster" → "Phân tách hồ sơ" / "Gộp cluster khác" → "Hợp nhất với hồ sơ khác".
- [x] **PAUSE-49-06:** ✅ MONGO REF ẩn behind toggle "Hiển thị thông tin kỹ thuật" (default OFF).
- [x] **PAUSE-49-07:** ✅ Race name `races.title` truncate 40 char + `title` attr tooltip hover full text.
- [x] **PAUSE-49-08:** ✅ Confidence raw number XÓA primary UI, tooltip on hover traffic-light badge.

**Status:** ALL 8 PAUSE confirmed → BA sẵn sàng viết PRD với 5 mandatory tables.

---

## ✅ Sẵn sàng cho /5bib-prd

**Sẵn sàng** với defaults recommendation cho 8 PAUSE-49-* questions (Danny override per question nếu khác).

Danny next step:
1. Confirm 8 PAUSE defaults (hoặc override) → BA `/5bib-po-ba FEATURE-049-f048-admin-ux-humanization` viết PRD
2. **PARALLEL:** trigger F-047 resume via Coder skill — Coder reads `06-defer-postmortem.md` resume conditions, updates `AthleteIdentityMergeService.computeCanonicalIdentity()` query `athlete_identity_clusters` collection thay vì broken `race_results.email` path. ~70% code reuse per post-mortem.

**Ship plan:** F-049 + F-047 resume ship cùng 1 release (release/v1.9.x) — option C Danny chốt.

---

## 🔗 References

- F-048 deploy artifact: `.5bib-workflow/features/FEATURE-048-athlete-identity-foundation/03-coder-implementation.md`
- F-048 admin UI engineer-speak issue: Danny screenshot 2026-05-20 23:00 ICT (Cluster Detail page show UUID + emailHash + T2 labels + raw MYSQL RACE ID)
- F-047 defer post-mortem: `.5bib-workflow/features/FEATURE-047-athlete-profile-pages/06-defer-postmortem.md`
- Display Convention rule: `CLAUDE.md` "KHÔNG render raw enum/snake_case cho user" + `docs/conventions.md` registry
- Dictionary pattern reference: `admin/src/lib/finance-labels.ts`
