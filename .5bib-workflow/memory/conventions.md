# 5BIB Result — Coding Conventions

> **Owner:** 5bib-manager
> **Last updated:** 2026-05-03 (bootstrap from CLAUDE.md "Development Rules")
>
> Quy ước thực tế — đã được team confirm trong CLAUDE.md.

---

## 🅰️ Naming

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Folder modules | kebab-case | `chip-verification/`, `race-master-data/` |
| File | `[name].[type].ts` | `order.service.ts`, `transfer-bib.dto.ts` |
| Class | PascalCase + suffix | `RaceService`, `RaceResultDto`, `RacesController` |
| Interface | PascalCase, NO `I` prefix | `RaceState` (không phải `IRaceState`) |
| Type alias | PascalCase | `type RaceStatus = 'draft' \| 'pre_race' \| 'live' \| 'ended'` |
| Constant | SCREAMING_SNAKE_CASE | `RENDER_MAX_CONCURRENT = 8` |
| Function/method | camelCase | `importBatch()`, `renderResultImage()` |
| MongoDB schema | `[name].schema.ts` | `race.schema.ts` |

---

## 🛠️ Backend Rules (NestJS)

### ⭐ API Endpoint Rules (BẮT BUỘC — CLAUDE.md)

> Mọi endpoint mới PHẢI có đầy đủ Swagger decorators. Thiếu = SDK generate sai.

```typescript
@ApiTags('races')
@ApiBearerAuth()
@Controller('races')
export class RacesController {
  @Get(':slug')
  @ApiOperation({ summary: 'Get race by slug' })
  @ApiResponse({ status: 200, type: RaceResponseDto })  // ← BẮT BUỘC
  async findOne(@Param('slug') slug: string): Promise<RaceResponseDto> {
    return this.racesService.findBySlug(slug);
  }
}
```

**Required decorators:**
- `@ApiTags(...)` — group endpoint trong Swagger
- `@ApiOperation(...)` — mô tả endpoint
- `@ApiResponse({ status, type: DtoClass })` — proper response DTO
- `@ApiBearerAuth()` — nếu auth required

**DTO requirements:**
- Mọi field phải có `@ApiProperty()` cho Swagger → SDK
- Mọi field input phải có `class-validator` decorator
- Response DTO ≠ Schema. KHÔNG return Mongoose Document trực tiếp.

```typescript
export class CreateRaceDto {
  @ApiProperty({ description: 'Race slug', example: '5km-saigon-2026' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({ enum: RaceStatus })
  @IsEnum(RaceStatus)
  status!: RaceStatus;
}

export class RaceResponseDto {
  @ApiProperty()
  id!: string;  // ← inject từ _id.toString() TRƯỚC khi strip _id

  @ApiProperty()
  slug!: string;

  @ApiProperty({ enum: RaceStatus })
  status!: RaceStatus;

  // KHÔNG expose: internal IDs, fee configs, draft data
}
```

### ⭐ Strip `_id` ANTI-PATTERN — MUST READ (CLAUDE.md Pre-Deploy)

**Bài học từ bug thực tế:** security fix strip `_id` → frontend mất `raceId` → toàn bộ race results trả về EMPTY ARRAY ÂM THẦM (không có 4xx error).

**Pattern an toàn:**
```typescript
// stripRacePrivateFields helper
function stripRacePrivateFields(race: RaceDocument): RacePublicDto {
  return {
    id: race._id.toString(),  // ← INJECT alias TRƯỚC
    slug: race.slug,
    status: race.status,
    // ... explicit whitelist
  };
  // _id automatically dropped
}
```

**Fields nguy hiểm tuyệt đối KHÔNG được strip mà không inject alias:**

| Field | Dùng ở đâu | Downstream call |
|-------|-----------|----------------|
| `race.id` / `race._id` | `races/[slug]/page.tsx`, `[bib]/page.tsx`, `ranking/page.tsx`, `compare/page.tsx` | `/api/race-results?raceId=` |
| `course.courseId` | tất cả result pages | `/api/race-results?course_id=` + stats |
| `result._id` | admin `results/page.tsx` | PATCH `/api/race-results/:id` |

### Atomic ops cho concurrency
```typescript
// ✅ ĐÚNG — atomic findOneAndUpdate
const race = await this.raceModel.findOneAndUpdate(
  { _id: id, status: 'pre_race' },           // condition trong cùng query
  { $set: { status: 'live' } },
  { new: true }
);
if (!race) throw new ConflictException('Race not in pre_race status');

// ❌ SAI — race condition
const race = await this.raceModel.findById(id);
if (race.status === 'pre_race') {
  race.status = 'live';
  await race.save();   // 2 request đồng thời sẽ ghi đè
}
```

### Redis Lock Pattern (cho image generation, master sync, badge computation)
```typescript
// SETNX với TTL để dedupe concurrent
const lockKey = `render-lock:${raceId}:${bib}:${hash}`;
const acquired = await redis.set(lockKey, '1', 'EX', 60, 'NX');
if (!acquired) {
  // Khác đang render — return cached result hoặc đợi
  return existingUrl;
}
try {
  // ... heavy work
} finally {
  await redis.del(lockKey);
}
```

### Cache key pattern
Theo Redis Keys Registry (xem `architecture.md`). Format:
```
[prefix]:<id>:<variant>
```

TTL chuẩn: 60s (stats), 300s (homepage/articles list), 600s (article detail), 24h (master data, badge), 5m (rate limit view), 24h (rate limit vote), ∞ (counters share-count, bib-count).

---

## ⚛️ Frontend / Admin Rules (Next.js 16)

### ⭐ API Call Rules (BẮT BUỘC — CLAUDE.md)

```typescript
// ✅ ĐÚNG — Generated SDK + TanStack Query hook
'use client';
function RaceList() {
  const { data, isLoading } = useGetRaces();  // hook từ admin/src/lib/api-hooks.ts
  // ...
}

// ❌ SAI — fetch() thủ công
function RaceList() {
  const { data } = useQuery({
    queryKey: ['races'],
    queryFn: () => fetch('/api/races').then(r => r.json()),  // BANNED
  });
}
```

**Quy tắc:**
- Tất cả API calls dùng `@hey-api/openapi-ts` generated SDK từ `lib/api-generated/`
- TanStack Query hooks trong `lib/api-hooks.ts` wrap SDK
- Sau backend đổi DTO/endpoint → chạy `pnpm generate:api` ở admin/frontend
- KHÔNG bao giờ dùng raw `fetch()` cho API calls

### Server vs Client Component
```typescript
// ✅ MẶC ĐỊNH: Server Component (no 'use client')
async function RacePage({ params }: { params: { slug: string } }) {
  const race = await fetchRace(params.slug);
  return <RaceDetail race={race} />;
}

// ✅ 'use client' CHỈ khi cần useState/useEffect/event handler
'use client';
function RaceFilterForm() {
  const [filter, setFilter] = useState('');
  return <input value={filter} onChange={(e) => setFilter(e.target.value)} />;
}
```

### Runtime Proxy Pattern (KHÔNG dùng Next.js rewrites)
```typescript
// admin/src/app/api/[...proxy]/route.ts
// Frontend/Admin → /api/* → proxy route → BACKEND_URL (set runtime trong docker-compose)
```

`BACKEND_URL` set qua env runtime, KHÔNG qua build-time rewrites trong `next.config.*`.

---

## 🎨 Tailwind / shadcn/ui

- Mobile-first: `sm: → md: → lg:`
- Dùng shadcn/ui component có sẵn, không tự tạo button/input/dialog
- Theme tokens trong `frontend/app/globals.css` ("Velocity" design system)

### Velocity Design System utilities (frontend)
- Animation: `stagger-in`, `slide-up`, `scale-in`, `shimmer`
- Texture: `grain`, `topo-lines`, `hero-pattern`, `diagonal-lines`
- Glass: `glass-light`, `glass-dark`
- Typography: `text-gradient`, `text-gradient-warm`, `mono-data`, `accent-underline`
- Athletic: `rank-gold`, `rank-silver`, `rank-bronze`
- Interactive: `card-hover`, `result-row-hover`, `glow-accent`, `focus-ring`
- Layout: `scrollbar-hide`, `scrollbar-thin`, `sep`

---

## 🧪 Testing Conventions

### Unit test (Coder bắt buộc)
- File: `[name].service.spec.ts` ngay cạnh `[name].service.ts`
- Tool: Jest
- Coverage tối thiểu: happy path + 3 edge case quan trọng nhất
- Mock external deps (Mongoose model, Redis, S3)

### Integration/E2E test (QC bắt buộc)
- API: Jest + Supertest, file trong `backend/test/`
- UI: Playwright, file trong `admin/e2e/` hoặc `frontend/e2e/`
- 10x flaky test cho critical paths (image generation, race state transition, master sync)

---

## 🛑 Anti-patterns — REJECT khi review

| Anti-pattern | Tại sao sai | Fix |
|--------------|-------------|-----|
| `any` type | Mất type safety | Dùng `unknown` + type narrow |
| `as unknown as X` | Bypass type check | Sửa type ở nguồn |
| `console.log` trong prod code | Pollute log | Dùng `Logger` của NestJS |
| `fetch()` thủ công ở client | Bypass SDK | Dùng generated SDK + TanStack Query |
| Missing `@ApiResponse({ type: Dto })` | SDK generate sai | Thêm full Swagger decorators |
| Strip `_id` không inject `id` alias | Frontend mất ref → empty array | Pattern: inject `id` → filter `_id` |
| `find() → save()` thay vì atomic op | Race condition | `findOneAndUpdate` với điều kiện |
| Hardcoded secret | Lộ key | env + ConfigModule |
| Skip generate:api sau đổi DTO | SDK lệch backend | `pnpm generate:api` ở admin/frontend |
| Cache transformed result thay vì raw | Inconsistent across responses | Cache raw, transform khi đọc |
| Build-time API rewrites | Cần rebuild để đổi BACKEND_URL | Runtime proxy via `app/api/[...proxy]/route.ts` |
| Bypass Logto auth | Security risk | Mọi protected route đi qua Logto guard |
| Delete keys khi filter vendor JSON (Chiptimes/Guntimes) | Schema mismatch real RR vendor (luôn full keys) | Set `value=""` để keep schema, downstream filter bằng `e.sec > 0` |
| DTO field set không sync với Mongoose schema | NestJS `whitelist:true, forbidNonWhitelisted:true` reject → 400 silent | Mỗi field Mongoose subschema PHẢI có decorator tương ứng trong DTO (e.g. `CourseCheckpointDto.distanceKm` hotfix FEATURE-001) |
| Test fixture dropping single field khi downstream merge từ 2 fields | Bug "rescued" bởi merge → test pass nhầm | Drop CẢ HAI field symmetric (e.g. cả Chiptimes lẫn Guntimes), reflect downstream consumer logic |
| Giả định vendor schema không curl real API | Sai logic xử lý → bug production | LUÔN curl real RR API trước khi viết test fixture |
| `new Date().toISOString().slice(0, 10)` để derive YYYY-MM-DD | Sai ở UTC+7 edge time (lúc 17:00 UTC = ngày kế tiếp local) | UTC math + offset (`getTime() + 7*3600*1000`) hoặc string template `${y}-${pad2(m)}-${pad2(d)}` (FEATURE-003 BR-06) |
| DTO optional field thiếu `@IsOptional()` decorator | ValidationPipe `whitelist: true` strip silent → service nhận `undefined` | Mọi field public PHẢI có ít nhất 1 class-validator decorator. Optional dùng `@IsOptional()` (FEATURE-003 PreflightBatchDto bug) |
| Route literal sau `:id` route trong cùng controller | NestJS routing match `:id` trước → shadow literal route | Declare literal route TRƯỚC `:id` (e.g. `@Get('audit/...')` BEFORE `@Get(':id')`) — FEATURE-003 |
| Render S3 URL trực tiếp ở admin UI khi bucket private | Bearer auth của app != AWS SigV4 → S3 trả 403/400 | Dùng backend stream endpoint với app-level auth (vd: `GET /api/.../download/xlsx` re-generate + Logto guard), hoặc presigned URL với 5-15 phút TTL. JSDoc cảnh báo field response (FEATURE-004) |
| Pattern `data.[name]_url \|\| /api/...` short-circuit cho download URL | Khi field populate từ S3 → UI ưu tiên S3 → 403. Pattern tưởng defensive nhưng là bug magnet | Drop short-circuit, 1 path duy nhất qua backend endpoint (FEATURE-004) |
| Dialog với table dài + cell content variable-width (VN names, emails, error messages) — KHÔNG set `table-fixed` + column widths + `truncate` | Long content overflow horizontally → table tràn ra ngoài DialogContent → cột phải bị cut + footer buttons bị đẩy off-screen + horizontal scrollbar xấu | `<DialogContent className="flex flex-col p-0 gap-0 max-h-[90vh] overflow-hidden w-[min(95vw,1200px)]">` + sticky Header/Footer (`shrink-0 border-t/border-b`) + scrollable body (`flex-1 overflow-y-auto min-h-0`) + `<Table className="table-fixed w-full">` + explicit `min-w-[Npx]` / `w-[Npx]` per `<TableHead>` + `<TableCell className="truncate" title={value}>` (native tooltip). Invalid-row error cell: `line-clamp-2` thay vì single-line. FEATURE-031 + FEATURE-032 UX hotfix (`6c6ce8a` 2026-05-14) — Danny report screenshot. |

---

## 🆕 Visual QC mandatory pre-merge cho UI feature (FEATURE-032 UX hotfix lesson)

**Trigger:** Bất kỳ feature có dialog / modal / table / form / multi-state UI component.

**Vấn đề:** F-031 + F-032 ship với 9 unit tests PASS (backend logic) nhưng dialog overflow horizontally trên screen thật vì:
- Test chỉ cover service-level parse/validate/insert logic
- QC checklist "UI states" chỉ tick `[x]` mà không mở dialog thật
- DialogContent `max-w-5xl` không đủ cho table 5-cột với VN long names
- Cell content không có `truncate` / column width

**Mandatory cho QC từ FEATURE-032 trở đi:**
1. Mở admin browser, navigate đến page, trigger dialog/modal/state
2. Test với **real-world data** — không phải fixture ngắn (e.g. "Co A"). Dùng tên VN dài như "CÔNG TY TNHH ĐẦU TƯ THƯƠNG MẠI DỊCH VỤ XYZ"
3. Screenshot evidence trong `04-qc-report.md` Phase 5 section (nếu screenshot khó capture thì paste DOM snapshot via Chrome MCP / Claude_Preview)
4. Check 4 layout invariants:
   - Header sticky? Footer sticky?
   - Body scrollable? (vertical only — horizontal overflow phải bounded trong cell)
   - Long content `truncate` + tooltip?
   - All buttons visible without scroll?

**Manager `/5bib-deploy` gate addition:** Reject deploy nếu QC report thiếu visual evidence cho UI feature. Backend-only feature exempt.

**Pattern khuyến nghị cho mọi shadcn Dialog với table:**
```tsx
<DialogContent className="max-w-6xl w-[min(95vw,1200px)] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
  <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">...</DialogHeader>
  <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
    {/* body content */}
    <div className="rounded-lg border overflow-hidden">
      <div className="max-h-[40vh] overflow-auto">
        <Table className="table-fixed w-full">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableHead className="w-10">#</TableHead>
            <TableHead className="min-w-[200px]">Tên</TableHead>
            <TableHead className="w-[120px]">MST</TableHead>
            ...
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="truncate" title={r.name}>{r.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
  <DialogFooter className="px-6 py-4 border-t shrink-0">...</DialogFooter>
</DialogContent>
```

---

## 🆕 Patterns được team confirm (FEATURE-019 — Awards AG Podium + Warnings)

### 1. Independent calc + 2-layer verify (anti-vendor-lockin pattern)

**Khi nào dùng:** Mọi metric phụ thuộc vendor BÊN NGOÀI (RaceResult, MyLaps, vendor timing systems...) làm input — ranking, AG bracket, podium, awards, pace alerts, anomaly detection.

**Convention:**
> **5BIB primary calc (Path A) + Vendor cross-check (Path B). Mismatch giữa 2 path → emit anomaly warning, KHÔNG block (5BIB là source-of-truth).**

**Anti-pattern (BUG F-019 v1 root cause):**
```ts
// ❌ Trust vendor 'Category' field 100% làm source-of-truth
const ageGroupKey = athlete.Category;  // vendor có thể đẩy whitespace/empty/inconsistent
podium.add(athlete);  // 100% race fail nếu vendor đổi format → silent false negative
```

**Pattern:**
```ts
// ✅ Path A: 5BIB independent calc
const ageGroupKey = computeAgeBracketFromDob(athlete.dob, race.startDate, presetConfig);
const rank5bib = sortByChipTime(athletes, 'ASC');

// ✅ Path B: Vendor cross-check
const rankVendor = athlete.OverallRank;
if (Math.abs(rank5bib - rankVendor) > THRESHOLD) {
  emitAnomalyWarning('VENDOR_MISMATCH', { rank5bib, rankVendor, athleteId });
}

// 5BIB source-of-truth — vẫn publish podium dù mismatch
publishPodium(rank5bib);
```

**Lý do:** F-019 v1 fail UAT 100% races (Giải Công An 4 courses × 3039 finishers, 0 podium). Trust vendor = single point of failure. Pattern này áp dụng cho mọi metric mới đụng vendor data — F-005 timing-alert + F-010 paceBuffer + F-019 awards đều cần refactor về pattern này (TD candidate cho v3).

---

### 2. PII compute-and-drop (Option B isolation, BR-03 strict allowlist preserved)

**Khi nào dùng:** Service cần PII (DOB, phone, address) để compute derived value (age cohort, region, demographic) NHƯNG KHÔNG được persist PII raw vào MongoDB theo BR-03 strict allowlist.

**Convention:**
> **Entity isolation pattern. Query PII qua entity riêng (read-only) → compute trong service → persist CHỈ derived number (không phải PII raw).**

**Anti-pattern (rejected v2 Option A):**
```ts
// ❌ Mở allowlist BR-03, thêm `dob` vào AthleteSubinfoReadonly
@Entity('athlete_subinfo')
class AthleteSubinfoReadonly {
  // ... existing fields
  @Column() dob: Date;  // BR-03 violation — PII leak vào tất cả queries
}
```

**Pattern (F-019 v2 Option B):**
```ts
// ✅ Entity riêng cho DOB, ngữ cảnh hẹp
@Entity('athletes')
class AthleteDobReadonly {
  @PrimaryColumn() id: number;
  @Column() dob: Date;  // chỉ entity NÀY, không expose qua AthleteSubinfoReadonly
}

// Service compute-and-drop
const dob = await dobRepo.findOne({ id });
const ageOnRaceDay = computeAge(race.startDate, dob);
await raceAthleteSchema.update(
  { athleteId },
  { $set: { ageOnRaceDay } }  // ✅ persist CHỈ derived number, KHÔNG có DOB raw
);
// dob biến mất khỏi memory sau hàm trả về — không log, không persist Mongo
```

**Lý do:** Giữ tinh thần BR-03 strict allowlist mà vẫn cho awards/AG calc dùng được DOB-based age. Rủi ro PII leak được isolate trong 1 service hẹp + cần DPO verify trong v3 (TD-F019-V2-DB-COLUMN).

---

### 3. VN amateur convention default cho podium calc

**Khi nào dùng:** Race admin VN config awards podium — chốt cứng default mode.

**Convention:**
> **Default `awardsCompoundingMode = 'mutually_exclusive'` (top 3 overall EXCLUDED khỏi AG buckets — VN amateur convention "mỗi BIB chỉ 1 giải"). WA TR9 `'compounding'` chỉ kích hoạt khi race opt-in qua field `Race.awardsCompoundingMode = 'compounding'`.**

**Race-level field (NOT course-level):**
```ts
// race.schema.ts — race-level (mode áp dụng cho toàn race)
@Prop({
  enum: ['mutually_exclusive', 'compounding'],
  default: 'mutually_exclusive',
})
awardsCompoundingMode: 'mutually_exclusive' | 'compounding';
```

**Service read pattern (race-level read, lazy default):**
```ts
const raceCompoundingMode =
  (race as { awardsCompoundingMode?: 'mutually_exclusive' | 'compounding' })
    .awardsCompoundingMode ?? 'mutually_exclusive';
// Triple-safe: Mongoose default + ?? fallback + lazy schema → race cũ vẫn work, no migration
```

**Logic exclude top-N overall:**
```ts
if (compounding === 'mutually_exclusive') {
  const cutoff = options.excludeOverallTopN ?? 3;
  const sorted = [...athletes]
    .filter((a) => a.chipTimeMs != null && a.chipTimeMs > 0)
    .sort((a, b) => (a.chipTimeMs ?? Infinity) - (b.chipTimeMs ?? Infinity));
  for (let i = 0; i < Math.min(cutoff, sorted.length); i++) {
    excludeIds.add(sorted[i].bib);
  }
}
// ... loop athletes:
if (excludeIds.has(a.bib)) continue;  // skip top 3 khi compute AG buckets
```

**Lý do:** F-019 v1 default WA TR9 `'compounding'` (chuẩn quốc tế). UAT Danny clarification: "nếu vào top chung cuộc thì không được tính top lứa tuổi nữa" — VN amateur cảm thấy compounding "ưu ái không công bằng". Race muốn theo WA → opt-in qua admin selector. 100% race admin VN sẽ default mode mới.

---

## 🆕 Patterns được team confirm (TD-CI-001 — Manager `/5bib-deploy` verify rule)

### Verify ALL 5 PROD containers (KHÔNG chỉ backend) post-deploy

**Khi nào dùng:** Manager `/5bib-deploy` step verify PROD container image match commit shipped.

**Anti-pattern (gây incident 2026-05-13 F-031):**
```bash
# ❌ Chỉ check backend → false positive nếu admin/frontend chưa update
ssh 5solution-vps "docker ps | grep 5bib-production-backend"
# → backend = 6e30ef9 ✓ → claim deploy success
# → REALITY: admin = 4372773 ✗ → F-031 button "Import Excel" mất trên PROD ~2h
```

**Pattern đúng:**
```bash
# ✅ Check tất cả 5 containers PROD
ssh 5solution-vps "docker ps --format '{{.Names}} {{.Image}}' | grep 5bib-production"
# Expected: 5 lines, ALL same tag (backend/frontend/admin/crew/content-web)
# Nếu ANY mismatch → recovery needed
```

**3 nguyên tắc Manager verify post-deploy:**

1. **List tất cả 5 PROD containers** — `5bib-production-{backend,frontend,admin,crew,content-web}`. KHÔNG chỉ check service mày nghĩ là changed. UI buttons có thể nằm trong admin container, FE public trong frontend, etc.
2. **Verify TAG match** commit SHA shipped — `git rev-parse --short HEAD` release branch == container image tag.
3. **Verify compose pin match** — `ssh ... cat /opt/5bib-result-production/docker-compose.yml | grep image:` → tất cả pinned cùng tag. Compose pin ≠ container tag → race condition, recovery needed (container sẽ revert tag cũ khi next restart).

**Recovery script template** (sed compose + pull + force-recreate 5 containers — xem TD-CI-001 trong known-issues.md).

**Reuse:** Mọi PROD deploy (release/v* push), hot fix, workflow_dispatch manual.

**Root cause CI gap:** `deploy-production.yml` thiếu `concurrency` lock → 2 concurrent runs race write compose. `workflow_dispatch` cho phép trigger từ main branch (KHÔNG validate `github.ref` startswith `release/`) → main commit có thể accidentally deploy lên PROD. Fix CI workflow là separate TD (TD-CI-001).

---

## 🆕 Patterns được team confirm (FEATURE-030 — Add-on Visual + 5BIB Provider Config)

### Fail-soft env defaults cho business legal info

**Khi nào dùng:** Env var chứa thông tin business legal (company info, address, bank account, tax code) — value đúng được biết tại code time, ít khi đổi, override qua env optional.

**Anti-pattern:**
```typescript
// ❌ .required() — PROD container fail-start nếu env unset
PROVIDER_COMPANY_NAME: Joi.string().required(),
PROVIDER_TAX_CODE: Joi.string().required(),
// Hậu quả: deploy mới → ops quên update env → container restart loop → PROD outage
```

**Pattern đúng:**
```typescript
// ✅ .default() — fail-soft, defaults từ trusted source (Danny confirmed)
PROVIDER_COMPANY_NAME: Joi.string().default('CÔNG TY CỔ PHẦN 5BIB'),
PROVIDER_ADDRESS: Joi.string().default(
  'Tầng 9, Tòa nhà Hồ Gươm Plaza (tòa văn phòng), Số 102 Phố Trần Phú, Phường Hà Đông, TP Hà Nội, Việt Nam',
),
PROVIDER_TAX_CODE: Joi.string().default('0110398986'),
// ... etc

// Trong export env:
provider: {
  companyName: envVars.PROVIDER_COMPANY_NAME as string,
  address: envVars.PROVIDER_ADDRESS as string,
  // ...
},
```

**3 nguyên tắc:**

1. **`.default()` cho business legal info** — Defaults phải match info đúng tại code-time (Danny confirmed). Override qua env chỉ khi business info đổi.
2. **`.required()` cho security-critical** — Secrets (JWT, DB pass, API keys) PHẢI `.required()` để fail-fast nếu missing.
3. **Document trong `.env.example`** — Đầy đủ comment giải thích override mechanism + current values.

**Khi nào KHÔNG dùng `.default()`:**
- Secrets / credentials (JWT_SECRET, MYSQL_PASS, AWS_SECRET_ACCESS_KEY)
- Cross-environment differential config (different DEV/PROD endpoints)
- User-provided sensitive data

**Trade-off:**
- Pros: Deploy resilient, container restart KHÔNG outage khi env partial set. Dev/local KHÔNG cần copy `.env.example` đầy đủ.
- Cons: Defaults trong code có thể out-of-sync với actual business info nếu KHÔNG maintain. Mitigation: Manager review khi business info đổi, update defaults + bump version.

**Reuse candidates:**
- Company legal info (address, tax code, bank, representative) — F-030 case
- Default page sizes, sort orders, cache TTLs
- Display labels (Vietnamese microcopy fallbacks)

### Bottom summary row conditional pattern (DOCX/PDF)

**Khi nào dùng:** Document render có Section với line items + summary, cần thêm row mới cho data optional (vd: add-on, surcharge, discount aggregate) NHƯNG KHÔNG muốn redesign table layout cho recon không có optional data.

**Pattern:**
```typescript
const totalOptional = items.reduce((s, li) => s + li.optional_value, 0);
const optionalRow: TableRow | null =
  totalOptional > 0
    ? new TableRow({
        children: [
          tCell([{ text: 'Vật phẩm bổ sung (áo, ...)' }], { colspan: 5 }),
          tCell([{ text: fmtVnd(totalOptional) }], { align: AlignmentType.RIGHT }),
        ],
      })
    : null;

const summaryRows: TableRow[] = [
  ...(optionalRow ? [optionalRow] : []),
  // ... rest of summary rows (Tổng cộng, etc.)
];
```

**Benefits:**
- KHÔNG redesign table 6-col → 7-col (low-risk)
- Clean render khi không có optional data (recon majority case)
- Conditional spread `...(row ? [row] : [])` clean idiom

**Reuse candidates:**
- Reconciliation add-on row (F-030)
- Discount row (nếu future tách discount aggregate)
- Tax row (nếu VAT > 0)
- Surcharge row (express fee, late fee)

### Order-level field dedup pattern via Set<string>

**Khi nào dùng:** Aggregate field từ MySQL JOIN result mà field là **order-level** (1 value per order) nhưng rows là **line-item-level** (multiple per order). Cần dedup để KHÔNG over-count.

**Pattern (extracted từ F-030 fix):**
```typescript
// Reuse cùng `_seenOrderIds` Set với các order-level fields khác (discount, etc.)
if (!item._seenOrderIds.has(orderId)) {
  item._seenOrderIds.add(orderId);
  // Tất cả order-level fields dedup TRONG block này:
  item.discount_amount += Number(r.total_discounts || 0);
  item.add_on_price += Number(r.total_add_on_price || 0);
  item.shipping_fee += Number(r.shipping_fee || 0);
  // ...
}
// Line-item-level fields tiếp tục per-row outside block:
item.quantity += Number(r.qty || 0);
item.subtotal += Number(r.line_price || 0) * Number(r.qty || 0);
```

**Identification heuristic — order-level vs line-item-level:**
- Field name có prefix `total_` thường order-level (vd: `total_discounts`, `total_add_on_price`, `total_tax`)
- Field name không có prefix thường line-item-level (vd: `qty`, `price`, `line_price`)
- Verify trong MySQL schema: `o.{field}` vs `oli.{field}` — `o.` là order, `oli.` là line item

**Reuse candidates:** Bất kỳ aggregate field có pattern `SUM(order-level)` qua JOIN trong reconciliation, analytics, P&L modules.

---

## 🆕 Patterns được team confirm (FEATURE-025 — Reconciliation Bulk Delete)

### Bulk delete idempotent return shape

**Khi nào dùng:** Admin bulk action xóa N entities cùng lúc (recon, athletes, sponsors, contracts, orders) với UI confirmation modal.

**Anti-pattern:**
```typescript
// ❌ Loop N x delete(id) — N round trips MongoDB + throw nếu 1 ID missing
async deleteMany(ids: string[]): Promise<void> {
  for (const id of ids) {
    await this.delete(id);  // throw NotFoundException nếu không tồn tại
  }
}
// Hậu quả: N=50 → 50 RTT (~1.5s vs 50ms), partial failure halfway = data inconsistent
```

**Pattern đúng:**
```typescript
// ✅ Mongoose deleteMany atomic 1 RTT + idempotent return shape
async deleteMany(ids: string[]): Promise<{ deleted: number; not_found: number }> {
  const result = await this.model.deleteMany({
    _id: { $in: ids },  // Mongoose auto-cast string[] → ObjectId[]
  });
  const deleted = result.deletedCount;
  const not_found = ids.length - deleted;

  this.logger.warn('domain_bulk_delete', {
    ids_count: ids.length,
    deleted_count: deleted,
    not_found_count: not_found,
  });

  return { deleted, not_found };
}
```

**3 nguyên tắc:**

1. **`deleteMany` atomic 1 RTT** — Mongoose `deleteMany({_id:{$in:ids}})` 1 round trip regardless N. Perf khác biệt rõ với N=50: ~30-50ms vs loop ~1.5s.
2. **Return granular counts `{deleted, not_found}` thay vì throw** — Bulk semantics khác single. Single `delete(id)` throw 404 OK vì 1 unit failed = whole request failed. Bulk: nếu 1 ID missing trong array of 50, throw 404 toàn request = 49 IDs khác cũng bị treat as failed UI-side. Idempotent counts cho FE quyết handle.
3. **Frontend handle both branches** — primary `toast.success(\`Đã xóa ${deleted}\`)` + secondary `toast.message(\`${not_found} không tìm thấy\`)` nếu `not_found > 0`. User click lại OK (idempotent), không hiển thị error.

**DTO validation BẮT BUỘC:**

```typescript
export class DeleteBatchDto {
  @IsArray()
  @ArrayMinSize(1)           // KHÔNG empty payload
  @ArrayMaxSize(50)          // DOS protection — admin lỡ click "Select all" 10K
  @IsMongoId({ each: true }) // Block CastError trước khi vào service
  ids: string[];
}
```

**Audit logging:**

NestJS `Logger.warn` structured `{event, ids_count, deleted_count, not_found_count}` đủ cho MVP. KHÔNG cần MongoDB audit collection. Compliance/GDPR future feature riêng nếu cần persist trail.

**Caller FE pattern:**

```typescript
async function handleBulkDelete() {
  if (selectedIds.size === 0) return;
  setBulkDeleteLoading(true);
  try {
    const ids = Array.from(selectedIds);
    const res = await fetch('/api/[domain]/delete-batch', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = (await res.json()) as { deleted: number; not_found: number };
    toast.success(`Đã xóa ${result.deleted}`);
    if (result.not_found > 0) {
      toast.message(`${result.not_found} không tìm thấy (có thể đã bị xóa trước đó)`);
    }
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
    fetchItems();
  } catch (err: any) {
    toast.error(`Xóa hàng loạt thất bại: ${err.message}`);
  } finally {
    setBulkDeleteLoading(false);
  }
}
```

**Route ordering note:**

`@Post('delete-batch')` literal phải declared TRƯỚC `@Get/@Patch/@Delete(':id')` để literal segment "delete-batch" không bị nuốt bởi `:id` param. Theo "NestJS route ordering" convention (single-segment literal BEFORE param, đã có trong section riêng).

**Threat model:**

- DOS via large payload → mitigated `@ArrayMaxSize(50)`
- CastError invalid hex → mitigated `@IsMongoId({each:true})`
- Auth bypass → mitigated class-level guard inherit
- Race condition concurrent bulk delete → Mongoose atomic per-doc + idempotent counts (TC 10x stability verified)
- Log injection via attacker IDs → mitigated `Logger.warn` structured (no string concat)

**Reuse candidates:**
- Bulk delete athletes (admin clean test data)
- Bulk delete sponsors (admin reorganize)
- Bulk delete contracts (admin reorder/cleanup)
- Bulk cancel orders (admin refund batch)
- Bulk archive races (admin housekeeping)

---

## 🆕 Patterns được team confirm (FEATURE-016 v1.6.5 — Reconciliation include GROUP_BUY)

### Defensive enum guard với Set lookup + structured Logger.warn

**Khi nào dùng:** Khi service đọc enum từ external source (MySQL platform vendor, vendor API, untrusted upstream) và cần phân loại theo whitelist. Vendor có thể thêm enum mới mà code chưa update → silent drop = mất data tài chính.

**Anti-pattern (BUG F-016 root cause):**
```typescript
// ❌ Hardcoded array whitelist + .includes — O(n) per row + KHÔNG defensive
const FIVE_BIB_CATEGORIES = ['ORDINARY', 'PERSONAL_GROUP', 'CHANGE_COURSE'];
const fiveBibOrders = rows.filter((r) =>
  FIVE_BIB_CATEGORIES.includes(r.order_category)
);
// Hậu quả: vendor thêm GROUP_BUY → silent drop khỏi reconciliation → underbill 5BIB fee
// 613 đơn (82 GROUP_BUY + 517 GROUP_BUY_FIXED + 14 CODE_TRANSFER) bị mất silently
```

**Pattern đúng:**
```typescript
// ✅ Set<string> O(1) lookup + 2-tier categorization + defensive guard
const FIVE_BIB_CATEGORIES = new Set([
  'ORDINARY', 'PERSONAL_GROUP', 'CHANGE_COURSE',
  'GROUP_BUY', 'GROUP_BUY_FIXED', 'CODE_TRANSFER',
]);
const SPLIT_BY_PAYMENT_REF = new Set([
  'PERSONAL_GROUP', 'GROUP_BUY', 'GROUP_BUY_FIXED', 'CODE_TRANSFER',
]);

private categorize(rows, ctx): QueryOrdersResult {
  const fiveBibOrders = [];
  const manualOrders = [];
  const unknownRows = [];
  const distribution: Record<string, number> = {};

  for (const r of rows) {
    const category = r.order_category as string | null | undefined;

    // Defensive guard #1: typeof check catches null/undefined/non-string
    if (typeof category !== 'string') {
      unknownRows.push(r);
      distribution['__null__'] = (distribution['__null__'] ?? 0) + 1;
      continue;
    }

    // MANUAL preserve
    if (category === 'MANUAL') { manualOrders.push(r); continue; }

    // Defensive guard #2: unknown enum (vendor mới) → drop + log
    if (!FIVE_BIB_CATEGORIES.has(category)) {
      unknownRows.push(r);
      distribution[category] = (distribution[category] ?? 0) + 1;
      continue;
    }

    // 5BIB-eligible → check split-by-payment_ref rule
    if (SPLIT_BY_PAYMENT_REF.has(category)) {
      if (r.payment_ref) fiveBibOrders.push(r);
      else manualOrders.push(r);
      continue;
    }

    // ORDINARY + CHANGE_COURSE preserve (no payment_ref split)
    fiveBibOrders.push(r);
  }

  // Structured logger.warn — KHÔNG console.log, KHÔNG string concat (anti log-injection)
  if (unknownRows.length > 0) {
    this.logger.warn('Unknown order_category dropped during reconciliation query', {
      ...ctx,                         // mysql_race_id, period_start, period_end
      dropped_count: unknownRows.length,
      category_distribution: distribution,
    });
  }

  return {
    fiveBibOrders,
    manualOrders,
    missingPaymentRef,
    unknownCategoryCount: unknownRows.length,  // additive — backward-compat
  };
}
```

**3 nguyên tắc:**

1. **`Set<string>` thay `Array.includes`** — O(1) lookup vs O(n) per row. Trên 10K rows reconciliation = perf khác biệt rõ.
2. **2-tier categorization** — tier 1 whitelist (eligible vs unknown), tier 2 sub-rule (split vs preserve). Tách 2 Set giúp đọc code dễ + test riêng từng rule.
3. **Defensive guard 2 lớp** — `typeof !== 'string'` (null/undefined) + `!Set.has(category)` (vendor enum mới). KHÔNG silent drop — emit `unknownCategoryCount` field + structured `Logger.warn` để future engineering thấy.

**Backward-compat additive interface:**

```typescript
// ✅ Thêm field vào return interface, KHÔNG break old caller
export interface QueryOrdersResult {
  fiveBibOrders: Record<string, unknown>[];
  manualOrders: Record<string, unknown>[];
  missingPaymentRef: Record<string, unknown>[];
  unknownCategoryCount: number;  // NEW additive — old caller destructure subset → undefined → falsy → no-op
}
```

Old caller pattern `const { fiveBibOrders, manualOrders } = await queryService.queryOrders(...)` vẫn hoạt động — không destructure `unknownCategoryCount` → undefined → falsy check trong preflight emit warning chỉ khi `> 0` → no warning emit cho old caller. Verified TC-QC-PRE-04 backward-compat spec.

**Caller emit downstream warning:**

```typescript
// preflight.service.ts — emit ERROR-severity warning khi defensive guard trigger
const { fiveBibOrders, manualOrders, unknownCategoryCount } = await this.queryService.queryOrders(...);

if (unknownCategoryCount && unknownCategoryCount > 0) {
  warnings.push({
    type: 'UNKNOWN_CATEGORY_DROPPED',
    severity: 'ERROR',
    count: unknownCategoryCount,
    message: `${unknownCategoryCount} đơn có order_category không xác định đã bị bỏ qua khỏi đối soát.`,
  });
}
```

Severity `ERROR` (không phải `WARN`) vì đây là financial data integrity — admin BẮT BUỘC phải biết để follow-up trước khi sign reconciliation.

**Khi nào áp dụng:**
- Service đọc enum từ vendor MySQL/external API
- Phân loại bằng whitelist mà silent drop = mất data tài chính / business-critical
- Có thể có future enum mới mà code chưa kịp update

**Trade-off:**
- Pattern này thêm ~15-20 LOC vs simple filter, nhưng zero silent-drop guarantee + IDE autocomplete via `Set.has()` typed.
- Logger.warn structured chỉ vào server log, KHÔNG expose qua HTTP — KHÔNG là information disclosure.
- Distribution map key có thể là user-controlled (vendor có thể tạo enum tên bậy) — Logger sanitize tự động, KHÔNG dùng trong SQL/HTML render.

**Reuse candidates:**
- Sync logic vendor → master-data (`order_category`, `payment_method`, `chip_status`)
- Reconciliation calc (nếu mở rộng beyond `'CHANGE_COURSE' | 'ORDINARY'` label)
- Analytics aggregation (mặc dù analytics hiện dùng `!= 'MANUAL'` negation pattern, an toàn hơn nhưng kém audit-trail)

---

## 🆕 Patterns được team confirm (FEATURE-003 — Reconciliation period)

### Custom class-validator decorator pattern

Khi cần validation logic phức tạp (regex domain-specific, cross-field), tạo decorator riêng trong `backend/src/common/validators/[name].validator.ts`:

```typescript
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function IsXxx(opts?: ValidationOptions): PropertyDecorator {
  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'isXxx',
      target: object.constructor,
      propertyName: propertyName as string,
      options: opts,
      validator: {
        validate(value: unknown, args?: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;  // narrow before parse
          // ... domain logic
          return true;
        },
        defaultMessage(args: ValidationArguments): string { return `${args.property} must ...`; },
      },
    });
  };
}
```

**Cross-field decorator** (đặt trên field thứ 2, đọc sibling từ args.object):
```typescript
validate(value: unknown, args: ValidationArguments): boolean {
  const obj = args.object as Record<string, unknown>;  // NEVER `any`
  const sibling = obj.period_start;
  if (typeof sibling !== 'string') return false;
  // ... compare
}
```

Reusable across modules. Đặt trong `backend/src/common/validators/`.

### Frontend timezone-safe date helpers (UTC math)

NEVER:
```typescript
new Date().toISOString().slice(0, 10)  // ❌ Sai ở UTC+7 edge time
```

PREFER (string template):
```typescript
const y = d.getUTCFullYear();
const m = String(d.getUTCMonth() + 1).padStart(2, '0');
const day = String(d.getUTCDate()).padStart(2, '0');
return `${y}-${m}-${day}`;
```

PREFER (UTC math cho timezone-aware):
```typescript
const VN_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const t = now.getTime() + VN_TZ_OFFSET_MS;
const d = new Date(t);
return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
```

PREFER (last day of month):
```typescript
const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();  // month 1-indexed; works leap year
```

### NestJS route ordering — literal BEFORE param

Trong cùng controller, declare route literal TRƯỚC route param:

```typescript
@Get('audit/period-boundary')   // ✅ literal — DECLARE TRƯỚC
auditPeriodBoundary() { ... }

@Get('cron-logs')                // ✅ literal
getCronLogs() { ... }

@Get(':id')                       // ✅ param — DECLARE SAU
findOne(@Param('id') id: string) { ... }
```

Vi phạm: NestJS match `:id` cho `audit` → controller call `findOne('audit')` → `findOne` shadow literal handler.

#### Trường hợp 2 — 2-param generic vs literal-suffix (NEW 2026-05-11 PROD incident)

Khi cùng controller có nhiều route 2-segment, declare route có **literal segment suffix** TRƯỚC route 2-param thuần:

```typescript
// ✅ ĐÚNG ORDER:
@Get('stats/:courseId/distribution')  // literal suffix "distribution" — TRƯỚC
async getTimeDistribution(@Param('courseId') courseId: string) { ... }

@Get('stats/:courseId/countries')      // literal suffix "countries" — TRƯỚC
async getCountryStats(@Param('courseId') courseId: string) { ... }

@Get('stats/:raceId/:courseId')        // 2-param thuần — SAU CÙNG
async getCourseStats(@Param('raceId') raceId, @Param('courseId') courseId) { ... }

// ❌ SAI (F-021 PROD incident — public ranking page crash):
@Get('stats/:raceId/:courseId')        // declare TRƯỚC → catch hết 2-segment
@Get('stats/:courseId/distribution')   // SHADOWED, unreachable
```

**Hậu quả vi phạm thực tế** (URL `GET /api/race-results/stats/5km/distribution`):
- First-match wins → route `stats/:raceId/:courseId` match với `raceId="5km", courseId="distribution"` → handler `getCourseStats` chạy → trả course-stats shape `{totalFinishers, started, ...}` (NO `buckets` field)
- Frontend `TimeDistributionChart` đọc `data.buckets.length` → `undefined.length` → TypeError → React crash → page "Application error: a client-side exception"

#### Tổng quát — domain principle

Trong cùng controller, route phải sort theo **độ cụ thể giảm dần**:
1. Route literal hoàn toàn (no param): `@Get('cron-logs')`
2. Route có literal prefix + param: `@Get('audit/:id')`
3. Route có literal suffix + param: `@Get(':courseId/distribution')`, `@Get(':id/audit')`
4. Route 1-param: `@Get(':id')`
5. Route 2-param: `@Get(':a/:b')`
6. Route 3-param: `@Get(':a/:b/:c')`

**Manager review checklist tại `/5bib-plan`:** Khi feature thêm route mới trong controller đã có route param → grep file controller cho `@Get/@Post/@Patch/@Delete` → verify declaration order theo specificity. Coder pin behavior bằng controller spec test (TC route-ordering).

### DRY shared helper cho domain với conditional render

Khi cùng logic render xuất hiện ở 3+ caller (DOCX, XLSX, filename), extract helper:
- Đặt trong cùng module `services/[name].helper.ts`.
- Pure function, không dependency.
- Spec test riêng — caller test thay vì lặp lại logic.

Ví dụ: `period-label.helper.ts` với `renderPeriodLabel()` + `filenamePeriodSegment()` dùng ở 3 caller (docx.service, xlsx.service, batch-export.service).

### JSDoc cảnh báo field internal-use-only (FEATURE-004)

Khi response DTO chứa field như S3 URL của bucket private mà UI client KHÔNG được render trực tiếp (Bearer auth ≠ AWS SigV4 → 403):

```typescript
type ReconciliationDetail = {
  /** S3 URL — INTERNAL USE ONLY (batch-export pipe to ZIP server-side với AWS SDK signed request).
   *  DO NOT render trực tiếp ở UI client — bucket private, Bearer Logto KHÔNG hợp với S3 auth.
   *  Dùng `GET /api/reconciliations/:id/download/xlsx` cho user download (FEATURE-004). */
  xlsx_url: string | null;
  /** Same as `xlsx_url` — internal use only. Use backend download endpoint for UI. */
  docx_url: string | null;
};
```

- Dev tương lai đọc JSDoc → biết KHÔNG render `<a href={data.xlsx_url}>`.
- Pattern reusable cho domain khác có S3 URL field (BIB photo, sponsor logo, etc.).
- Long-term: ESLint custom rule enforce (TD-F004-01).

---

## 🆕 Patterns được team confirm (FEATURE-002 — toàn bộ 3 round)

### HttpError class retains status code (Round 2)

> Frontend cần discriminate exception class trên status code (vd toast UX khác nhau cho 404/409/400/500). Plain `new Error(string)` mất status info.

```typescript
// admin/src/lib/timing-alert-api.ts
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

// clientGet/Post/Patch throw HttpError thay vì Error
async function clientPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.post({ url, body });
  if (res.error) throw new HttpError(res.response?.status ?? 0, extractError(...));
  ...
}

// Caller discriminate
mutation.useMutation({
  onError: (err) => {
    if (err instanceof HttpError) {
      if (err.status === 404) { ... }
      if (err.status === 409) { ... }
      if (err.status === 400) { ... }
    }
  },
});
```

### Test-only export namespace cho file-local pure functions (Round 3)

> Khi cần unit test pure helpers không exported (file-local), KHÔNG refactor sang public API (sẽ pollute service). Thay vào đó expose qua `__test__` namespace.

```typescript
// simulator.service.ts (cuối file)
function filterAthlete(...) { /* file-local */ }
function filterMapField(...) { /* file-local */ }
function safeParseMap(...) { /* file-local */ }

// Test-only exports — convention rõ ràng KHÔNG được dùng runtime
export const __test__ = {
  filterAthlete,
  filterMapField,
  safeParseMap,
};

// simulator-helpers.spec.ts
import { __test__ } from './simulator.service';
const { filterAthlete, filterMapField, safeParseMap } = __test__;
```

### 3-tier fallback chain pattern (Round 2)

> Khi compute derived value từ data có thể missing/dirty, dùng tier chain với label rõ ràng. Frontend hiển thị độ chính xác của source.

```typescript
// dashboard-snapshot.service.ts
function computeRaceStartedAt(race): { startedAt: string|null, source: 'status_history'|'course_start_time'|'recent_history'|null } {
  // Tier 1: most accurate
  const tier1 = ...;
  if (tier1) return { startedAt: tier1, source: 'status_history' };

  // Tier 2: estimate
  const tier2 = ...;
  if (tier2) return { startedAt: tier2, source: 'course_start_time' };

  // Tier 3: fallback for legacy data
  const tier3 = ...;
  if (tier3) return { startedAt: tier3, source: 'recent_history' };

  return { startedAt: null, source: null };
}
```

Frontend hiển thị label "✓ Most accurate" / "≈ Estimate" / "⚠️ Fallback" để user trust appropriately.

---

## 🆕 Patterns được team confirm (FEATURE-002 Round 1)

### NestJS exception class > generic Error

> Anti-pattern critical — đã có trong table REJECT, FEATURE-002 reinforce qua reset endpoint fix.

```typescript
// ❌ SAI — generic Error → ExceptionsHandler maps thành 500 + body "Internal server error" (mất message + risk leak stack)
if (race.status === 'live') {
  throw new Error(`Race ${race.title} đang ở status 'live' — KHÔNG cho phép reset`);
}

// ✅ ĐÚNG — NestJS exception class với HTTP status + safe message
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

if (!race) throw new NotFoundException(`Race ${raceId} not found`);
if (race.status === 'live' || race.status === 'ended') {
  throw new ConflictException(
    `Race ${race.title} đang ở status '${race.status}' — KHÔNG cho phép reset`,
  );
}
if (options.confirmToken !== expected) {
  throw new BadRequestException(`confirmToken sai — phải gửi exact "${expected}"`);
}
```

**Rule:** mỗi business validation → exception class phù hợp. Server bug (DB connection fail, etc.) → để default Error → 500.

### Per-severity infinite query > 1 big paginated query

> Pattern cho dashboard có severity/category grouping (alerts by severity, orders by status, etc.)

```typescript
// ❌ Cũ — 1 query lớn pageSize=100, refetchInterval=30s
const alerts = useInfiniteQuery({
  queryKey: ['alerts', raceId, status],
  queryFn: ({ pageParam }) => list(..., { page: pageParam, pageSize: 100 }),
  refetchInterval: 30_000,  // refetch ALL loaded pages → spam
});

// ✅ Mới — 4 query per severity, pageSize=20, drop refetchInterval
const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'WARNING', 'INFO'];
const stats = useQuery({ queryKey: [..., 'stats'], queryFn: () => list(..., { pageSize: 1 }) });
const criticalQ = useInfiniteQuery({ queryKey: [..., 'CRITICAL'], queryFn: ..., staleTime: 15_000 });
const highQ = useInfiniteQuery(...);
const warningQ = useInfiniteQuery(...);
const infoQ = useInfiniteQuery(...);
```

**Trade-off:** 5 calls mount thay vì 1, nhưng pageSize=20 (4× nhẹ hơn 100). User chỉ load thêm severity họ care → tổng dài hạn ÍT calls hơn.

### SSE invalidation debounce

> Race day 1000+ alerts/cycle có thể fire 100+ SSE events trong 1 giây. Mỗi event invalidate 4 queries → 400+ refetches.

```typescript
let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
const invalidateAll = () => {
  if (invalidateTimer) return; // already scheduled — coalesce
  invalidateTimer = setTimeout(() => {
    qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
    qc.invalidateQueries({ queryKey: ['timing-alerts-stats', raceId] });
    qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
    invalidateTimer = null;
  }, 1500);
};
```

**Cleanup:** clearTimeout trong useEffect return.

### Re-derive scalar fields post-mutation

> Khi có 2-pass mutation (filter pre + scenarios post), scalar fields phải re-derive ở pass cuối để đảm bảo consistent với map fields.

```typescript
// Pass 1: time-based filter, derive scalars from raw times
const filtered = items.map(item => filterAthlete(item, cutoff));

// Pass 2: scenarios mutate Chiptimes/Guntimes (drop keys) — KHÔNG touch scalars
const postScenario = applyScenarios(filtered, scenarios);

// Pass 3: re-derive scalars based on POST-scenario chip state → consistent
return postScenario.map(item => deriveScalarsFromTimes(item));
```

### Vendor field nullable → server-side fallback

> Vendor RR API có thể không emit field tuỳ template. Đừng trust frontend self-derive — server biết context (đang poll course nào).

```typescript
// Parser fallback ở poll service — server biết course hiện tại
const parsed = rawAthletes
  .map(a => parseRaceResultAthlete(a, checkpoints))
  .map(a => (a.contest ? a : { ...a, contest: course.name }));  // ← fallback
```

**Lý do:** alert document chỉ lưu `contest: string`. Frontend lookup trajectory cần match course → name match fail → no checkpoints → empty trajectory. Server fallback giữ contract intact.

---

---

## 🆕 Patterns được team confirm (FEATURE-001)

### Schema-from-1-athlete với fallback aggregate

> Use case: detect schema từ vendor data có thể inconsistent (vd: RR API trả timing keys khác nhau cho từng athlete).

```typescript
// Sample N athletes đầu, check Object.keys consistency
const sampleSize = Math.min(10, athletes.length);
const sample = athletes.slice(0, sampleSize);
const firstKeys = JSON.stringify(Object.keys(parsed(sample[0])).sort());
const matchCount = sample.filter(a => JSON.stringify(Object.keys(parsed(a)).sort()) === firstKeys).length;
const consistency = matchCount / sampleSize;

if (consistency >= 0.8) {
  // Trust vendor schema — use first athlete's keys
  return Object.keys(parsed(sample[0]));
} else {
  // Fallback: aggregate keys across all athletes (defensive)
  return aggregateKeys(athletes);
}
```

**Trade-off:** O(1) sample check vs O(N) aggregate. RR vendor verified luôn consistent → 80% threshold đủ rộng cho edge case (e.g. 1-2 athletes có DSQ keys lạ).

### Set `value=""` thay vì delete (vendor schema match)

> Use case: filter timing JSON theo cutoff time, vẫn giữ schema match vendor.

```typescript
// ❌ SAI — drop key
for (const [key, time] of Object.entries(parsed)) {
  if (seconds <= cutoff) filtered[key] = time;
  // else: key bị drop → schema mismatch real RR
}

// ✅ ĐÚNG — keep key, empty value
for (const [key, time] of Object.entries(parsed)) {
  filtered[key] = seconds <= cutoff ? time : ''; // empty string khớp vendor
}
```

**Lý do:** Real RR API ALWAYS returns full schema (vd: `{Start, TM1, TM2, TM3, TM4, TM5, Finish}`), value="" cho checkpoint chưa qua. Nếu simulator drop keys → schema mismatch → downstream consumers (poll service, frontend) xử lý sai.

### Redis SETNX lock với TTL — 3rd usage (BR-06, FEATURE-001)

Reinforce existing pattern. Naming convention prefix:
- `render-lock:<raceId>:<bib>:<hash>` — image gen
- `master:sync-lock:<raceId>` — full master sync
- `master:cron-lock:<raceId>` — per-race cron tick
- `master:lookup-lock:<raceId>:<bib>` — on-demand MySQL fallback
- `master:discover-lock:<raceId>:<courseId>` — checkpoint discovery (FEATURE-001)
- `badge-lock:<raceId>:<bib>` — badge computation

**TTL chọn:** = max acceptable operation duration. Discovery: 30s = max network + parse RR API. Image gen: 60s = max canvas render.

---

## 📋 Pre-Deploy Checklist (5 mục — BẮT BUỘC)

> Bài học thực tế từ CLAUDE.md. Manager dùng để gate `/5bib-deploy`.

### 1. API Response Shape Changed?
```bash
# Grep toàn bộ frontend + admin tìm consumer
grep -rn "field_name" frontend/ admin/ --include="*.tsx" --include="*.ts"
```
Đặc biệt nguy hiểm: `_id`, `id`, `slug`, `courseId`, `raceId`.

### 2. Strip / Scrub Fields khỏi Public API?
- Field đó có dùng làm key gọi API downstream không?
- Nếu strip `_id` → **PHẢI inject alias `id = _id.toString()` TRƯỚC khi strip**

### 3. DTO thêm Required Field?
- Chạy `pnpm generate:api`
- Check tất cả call site truyền đủ field mới chưa

### 4. Redis Cache?
- Cache stores **raw DB document** (có `_id`), transform **khi đọc** — KHÔNG cache transformed result
- Sau deploy có thay đổi response shape, cache cũ vẫn valid vì transform chạy lại

### 5. Verify End-to-End Trước Khi Báo Done
Không chỉ test endpoint vừa sửa — test cả **flow downstream**:
```
1. GET /api/races/slug/:slug → kiểm tra `id` có trong response
2. Lấy `id` → gọi GET /api/race-results?raceId={id}&course_id={x}
3. Confirm athletes trả về > 0
```

---

## 🆕 Patterns được team confirm (FEATURE-014 — Athletes tab + Settings full redesign)

### Client-derive status with editHistory precedence (Option C)

> Use case: status enum needed for admin roster but backend schema has no `status` field; manual override (admin DSQ/MED/CUT) must persist via existing audit trail subdoc, not new endpoint.

```typescript
// admin/src/lib/deriveAthleteStatus.ts
export function deriveAthleteStatus(
  row: AthleteRow,
  raceStatus: RaceStatus
): AthleteStatus {
  // 1. Manual override ALWAYS wins (BR-AS-02 trust-admin)
  const overrides = (row.editHistory ?? [])
    .filter(e => e.field === 'status' && e.newValue);
  if (overrides.length) {
    const last = overrides[overrides.length - 1];
    return last.newValue as AthleteStatus;
  }

  // 2. DSQ via 3 paths (editHistory above + timingPoint sentinel + dsqReason)
  if (row.timingPoint?.startsWith('DSQ')) return 'DSQ';
  if (row.dsqReason?.trim()) return 'DSQ';

  // 3. DNF via 3 paths (numeric / boolean / timingPoint)
  if (typeof row.dnf === 'number' && row.dnf > 0) return 'DNF';
  if (row.dnf === true) return 'DNF';
  if (row.timingPoint === 'DNF') return 'DNF';

  // 4. FIN gates: hasFinishMarker AND hasTimeData AND hasFiniteRank
  //    (rejects vendor sentinels '-' / '00:00:00' / '0')
  // 5. DNS gated on raceStatus === 'ended' (prevents pre-race no-show mis-class)
  // 6. LIVE: startTime OR partial split (timingPoint not FINISH/DNS/DNF)
  // 7. PICKED: racekitReceived (camelCase + snake_case both)
  // 8. REG fallback (default)
}
```

**When to use:**
- Status enum needed but backend has no `status` field → derive client-side from existing fields
- Manual admin override must persist → use existing audit-trail subdoc (`editHistory[]`) with `field='status'`
- Vendor signals must coexist with admin overrides → editHistory entries take precedence

**When NOT to use:**
- Server-side filter/aggregation needs status → MUST add real `status` field to schema (client-derive can't be queried)
- Multiple consumers need status → consider promoting to backend persisted field (TD-F014-02 refactor trigger)

**Field tolerance:** vendor APIs may return PascalCase (`Bib`, `ChipTime`) or lowercase (`bib`, `chipTime`); accessor helpers tolerate both. Vendor sentinels (`'-'`, `'00:00:00'`, `'0'`) rejected as meaningful values.

**Race Ops Expert 9-status standard** (LOCKED for cluster #8): `REG / PICKED / DNS / LIVE / FIN / DNF / CUT / DSQ / MED`. MED + CUT manual-only (no vendor signal — BTC race-day judgment).

### Sectioned-scroll IA with sticky left nav + hash deep-link

> Use case: settings/admin page with >40 fields; legacy 4-tab IA insufficient.

**Layout:**
- Sticky left rail (desktop, lg≥1024px) listing 6 section labels with icons + chấm cam (orange dot) dirty indicator
- Mobile (<1024px): horizontal scroll bar with same labels
- Active section highlight via IntersectionObserver (`useUrlHashScroll`)
- HTML5 hash anchor `#section-id` enables bookmark + section discovery
- URL preserved on navigation (no migration; existing `/races/[id]/settings` URL unchanged)
- Reduced-motion respected (`prefers-reduced-motion`)

**Composition:**
```tsx
// page.tsx (composer ~268 LOC max)
<SettingsLayout sections={SECTION_IDS} dirtyMap={dirtyMap}>
  <RaceMetaSection id="race-meta" race={race} ... />
  <CourseSection id="course" race={race} ... />
  <TimingSection id="timing" race={race} ... />
  <PublishingSection id="publishing" race={race} ... />
  <IntegrationsSection id="integrations" race={race} ... />
  <AdvancedSection id="advanced" race={race} ... />
</SettingsLayout>
```

**Each section:**
- Self-contained — owns its own form state via react-hook-form + own save mutation
- Per-section save button (preserves legacy 4-button pattern — BR-AS-42)
- Reports dirty state up via `useDirtyFormPerSection` (orange dot fires)
- No autosave block, no leave-confirm — admin trust philosophy

### Per-section save state with chấm cam dirty indicator

```typescript
// admin/.../settings/hooks/useDirtyFormPerSection.ts
const dirtyMap = {
  'race-meta': formA.formState.isDirty,
  'course': formB.formState.isDirty,
  ...
};
// SettingsLayout reads dirtyMap → renders <span className="orange-dot" /> per nav item
```

Per-section save buttons preserved from legacy (BR-AS-42 mandate). No leave-confirm — admin can navigate freely; data loss responsibility on admin. Pattern alternative to global save bar at top.

### Side drawer for edit + profile (preserves list context)

> Use case: high-frequency admin entity edit flow where modal/inline form would lose list context.

```tsx
// shadcn Sheet right-side
<Sheet open={mode !== 'closed'} onOpenChange={...}>
  <SheetContent side="right" className="w-[480px] sm:w-full">
    {mode === 'edit' && <AthleteEditForm row={row} />}
    {mode === 'profile' && <AthleteProfileView row={row} />}
  </SheetContent>
</Sheet>
```

**State machine** prevents two drawers stacking: `mode: 'edit' | 'profile' | 'closed'`. Two-tab toggle inside drawer for switching between edit/profile modes. Thin wrapper component (`AthleteProfileDrawer`) opens merged drawer in `mode='profile'` for code reuse.

**Sizing:**
- Desktop: 480px width
- Mobile: fullscreen (`sm:w-full`)

**Anti-pattern:** modal centered overlay (loses list scroll position) or inline expansion row (compresses other rows).

### Server-side pagination with URL-synced filters

```typescript
// admin/.../athletes/hooks/useAthletesList.ts
const queryKey = ['athletes', raceId, { q, statuses, courseIds, gender, ag, paid, view, page }];
// 50/page server-side; load-more append (NOT virtual scroll)
```

**URL sync via `useSearchParams`:**
- Filter values written to URL via `router.replace` (no back-button pollution)
- Read from URL on mount + validate against constant arrays — unknown values filtered out
- Page resets to 1 on filter change (prevents empty-page state)
- Search debounce 300ms + `flush()` exposed for Enter-key shortcut

**Why not virtual scroll for 2K rows:**
- Server-side filter latency dominates (300ms debounce + ~500ms p95 query)
- Load-more pagination simpler UX + better mobile + URL-shareable page state
- Selection state preserved across pages via Set<string> in `useAthletesBulkActions`

---

## 🆕 Patterns được team confirm (FEATURE-015 — Check-In Kiosk)

### Shared admin lib pattern at `admin/src/lib/`

> Use case: cross-feature shared utilities (hooks, helpers, types). Live here, NOT in feature folders.

First established by F-014 `admin/src/lib/deriveAthleteStatus.ts`. F-015 expands with `admin/src/lib/kiosk/` sub-folder.

```
admin/src/lib/
├── deriveAthleteStatus.ts          # F-014 — 9-status enum derivation (singleton file)
├── kiosk/                          # F-015 — generalized kiosk hooks (sub-folder for related items)
│   ├── useFullscreen.ts
│   ├── useKioskIdle.ts
│   ├── useKioskSound.ts
│   ├── kiosk.constant.ts
│   ├── types.ts
│   └── index.ts                    # barrel re-export
├── api-hooks.ts                    # TanStack Query wrappers (pre-existing)
├── api-generated/                  # @hey-api/openapi-ts SDK (pre-existing)
└── ...
```

**When to use:**
- Cross-feature reusable utility, hook, or type → `admin/src/lib/`
- Sub-folder for related items (≥3 files sharing concern) → `lib/kiosk/`, `lib/auth/`, etc.
- Singleton helper → flat file `lib/foo.ts`

**When NOT to use:**
- Feature-specific scope-local module → feature folder (e.g., `result-kiosk/kiosk.constant.ts` for F-013-only constants)
- UI primitive component → `admin/src/components/ui/` (shadcn convention)

### Multi-station SSE realtime sync via `@Sse()` + RxJS Subject

> Use case: broadcast events to multiple admin clients (multi-tablet kiosks, multi-admin dashboards) sharing a per-race scope.

```typescript
// backend/src/modules/race-result/check-in-sse.service.ts
import { Injectable } from '@nestjs/common';
import { Subject, filter, merge, interval, map } from 'rxjs';

@Injectable()
export class CheckInSseService {
  private readonly subject$ = new Subject<{ raceId: string; type: string; payload?: any }>();

  emit(event: { raceId: string; type: string; payload?: any }) {
    this.subject$.next(event);
  }

  streamForRace(raceId: string) {
    const events$ = this.subject$.asObservable().pipe(
      filter(event => event.raceId === raceId),
      map(event => ({ data: event })),
    );
    const heartbeat$ = interval(25_000).pipe(
      map(() => ({ data: { type: 'heartbeat' } })),
    );
    return merge(events$, heartbeat$);
  }
}

// controller
@Sse(':raceId/sse')
@UseGuards(LogtoAdminGuard)
streamCheckIn(@Param('raceId') raceId: string) {
  return this.sseService.streamForRace(raceId);
}
```

**Pattern advantages:**
- Single global Subject (in-memory) + filter per-race scope = O(1) emit, sub-second broadcast latency
- 25s heartbeat keeps EventSource alive (proxy/load-balancer timeout typically 30-60s)
- No Redis pub/sub overhead for single-instance backend; if scaling to multi-instance backend → migrate Subject to Redis pub/sub channel
- Reuses F-005 timing-alert SSE pattern (precedent)

**When to use:**
- Multi-client realtime sync sharing per-resource scope
- Backend emits → all subscribers receive within 1s
- Single-instance backend OR Redis pub/sub bridge available

**When NOT to use:**
- Bidirectional client→server messaging → use WebSocket
- Cross-instance backend without Redis bridge → SSE Subject in-memory only reaches subscribers on same instance
- High-volume firehose (>100 events/sec/race) → consider message queue

### Redis SETNX distributed lock + MongoDB atomic update (two-tier guard)

> Use case: prevent race condition when multiple admin clients can mutate same resource (e.g., 4-8 tablets confirming BIB pickup simultaneously).

```typescript
// backend/src/modules/race-result/check-in.service.ts
async confirmPickup(raceId: string, bib: string, stationId: string, source: string, checkedInBy: string) {
  const lockKey = `checkin:lock:${raceId}:${bib}`;
  const lockVal = `${stationId}:${Date.now()}`;

  // Tier 1: Redis SETNX distributed lock (5s TTL safety net)
  const acquired = await this.redis.set(lockKey, lockVal, 'EX', 5, 'NX');
  if (!acquired) {
    throw new ConflictException({ code: 'CHECKIN_LOCK_HELD', message: 'Đang xử lý...' });
  }

  try {
    // Tier 2: MongoDB atomic findOneAndUpdate (DB-level guard, survives lock TTL expiry)
    const result = await this.raceResultModel.findOneAndUpdate(
      { raceId, bib, racekit_received: false },
      { $set: { racekit_received: true, racekit_received_at: new Date() } },
      { new: true },
    );

    if (!result) {
      const exists = await this.raceResultModel.findOne({ raceId, bib });
      if (!exists) throw new NotFoundException('Athlete not found');
      throw new ConflictException({ code: 'CHECKIN_ALREADY_PICKED_UP', message: 'BIB đã nhận trước đó' });
    }

    // ... insert audit log + SSE broadcast + cache invalidation
    return result;
  } finally {
    await this.redis.del(lockKey).catch(() => {}); // best-effort; TTL safety net
  }
}
```

**Why two-tier:**
- **Tier 1 (Redis SETNX):** fast-fail < 1ms; rejects concurrent attempts immediately; 5s TTL ensures lock auto-releases if process crashes
- **Tier 2 (MongoDB atomic):** ground truth; survives lock TTL expiry edge cases; condition `racekit_received: false` prevents double-pickup even if 2 workers somehow bypass Tier 1

**Error semantics:**
- SETNX returns null → 409 `CHECKIN_LOCK_HELD` (race-condition mid-flight)
- findOneAndUpdate matchedCount=0 + athlete exists → 409 `CHECKIN_ALREADY_PICKED_UP` (already done)
- findOneAndUpdate matchedCount=0 + athlete missing → 404 NotFoundException

**When to use:**
- Multi-client mutation on shared resource (multi-station kiosks, multi-admin status changes)
- Need both fast-fail UX + ground-truth guarantee
- Reusable for: Volunteer Hub assignment conflicts, Medical Incident dispatch, BIB Assignment workflow

**When NOT to use:**
- Single-client mutation → atomic findOneAndUpdate alone sufficient
- Long-running operation → Redis lock TTL must exceed expected work duration; risky beyond ~30s

### CMND PII boundary (last-4 visual match, NEVER store full)

> Use case: Vietnamese ID number (CMND/CCCD) lookup at race-day kiosk; visual confirmation by BTC volunteer.

**Boundary rules (BR-CK-08, BR-CK-10, BR-CK-15):**
- Frontend input field accepts ONLY 4 digits (`maxLength={4}`, `pattern="[0-9]{4}"`, anchored)
- Backend lookup endpoint validates anchored regex `^[0-9]{4}$` (rejects partial or non-4-digit)
- Lookup queries master-data layer (`RaceMasterData.cmnd_last_4` field) — last-4 ONLY, populated upstream by athlete sync
- BTC volunteer visually confirms full CMND from athlete's physical ID (paper) — NOT stored
- Audit log (`check_in_logs`) stores ObjectId only — NO `cmnd`, NO `name`, NO PII
- ZERO `console.log` / `logger.{info,warn,error}` of CMND value or full-CMND payload (verified by grep audit at QC)

**Schema audit checklist for any feature involving CMND/CCCD:**
1. Grep audit for `console.log` / `logger.*` of CMND value → expected zero matches
2. Grep audit for DB persistence (Schema.Prop, save, $set) of full CMND → expected zero matches
3. Verify last-4-digit input is the ONLY user-facing field accepting CMND-style data
4. Verify lookup uses anchored regex `^[0-9]{4}$` (NOT substring/contains queries)

**When to use:**
- Any flow needing identity verification at venue without storing PII
- Last-N-digit pattern reusable for phone numbers, passport numbers, etc.

**When NOT to use:**
- Persistent identity record (account creation, KYC) → use proper PII handling with encryption + access controls + retention policy
- Authentication → use Logto OAuth, NOT CMND-based passwords

### F-013 hook extraction Option 3 (generalized shared lib)

> Use case: feature-specific hook proves reusable across features → extract to `admin/src/lib/<scope>/` shared lib.

**Option 3 vs alternatives:**
- **Option 1 (path-import):** consumer imports directly from origin feature folder → tight coupling, name confusion when origin retired
- **Option 2 (duplicate):** copy hook to new feature folder → drift risk, double maintenance
- **Option 3 (generalized shared lib):** ✅ extract to `admin/src/lib/<scope>/`, drop feature-specific prefix from name, both features import from shared location

**Naming convention when extracting:**
- Drop feature-specific prefix from hook/constant name (`useKioskFullscreen` → `useFullscreen`)
- Drop feature-specific prefix from constant name (`KIOSK_CONFIG` → `SHARED_KIOSK_CONFIG`)
- Comments rewrite to generalize (e.g., remove "F-013 PAUSE-RK-01"; replace with "Shared kiosk Fullscreen hook")

**Logic equivalence preservation:**
- Body of hook MUST be semantically equivalent (same API surface, same side effects, same lifecycle)
- BR-AF-23 verbatim port mandate honored at logic level (NOT byte-for-byte due to renaming requirement)

**Retrofit pattern:**
- Extract to shared lib → both features point at new lib (preferred); OR
- Extract to shared lib → new feature uses new lib + retrofit deferred TD (origin still uses scope-local copy until 1-line `import` swap pass)
- Either path acceptable; track retrofit in known-issues.md if deferred

**Example (F-015 minted):**
```diff
- // F-013: admin/src/app/.../result-kiosk/hooks/useKioskFullscreen.ts
- export function useKioskFullscreen() { ... }

+ // F-015: admin/src/lib/kiosk/useFullscreen.ts
+ export function useFullscreen() { ... }  // drop "Kiosk" prefix — generalization
+
+ // F-015: admin/src/app/.../check-in-kiosk/hooks/...
+ import { useFullscreen } from '@/lib/kiosk';
+
+ // F-013 retrofit deferred TD-F015-01:
+ // admin/src/app/.../result-kiosk/hooks/useKioskFullscreen.ts STILL EXISTS
+ // 1-line `import { useFullscreen } from '@/lib/kiosk'` swap × 3 files pending
```

---

## 🎛️ Patterns from FEATURE-005 (Race Day Command Center)

### Pattern: Service exists but unreachable = dead code (BR-CC-10)
Mọi public method của service phải có 1 trong 2:
- HTTP endpoint expose qua controller (REST/RPC), HOẶC
- JSDoc `/** @internal — called by [other-service] */` ghi rõ caller

QC catch dead code khi `forceRefresh()` có 3 unit tests pass nhưng không endpoint expose → frontend Force Refresh button không bấm được. Pre-QC checklist: cho mỗi public service method, grep `controller.*Service.method()` hoặc check JSDoc.

### Pattern: 2-layer rate-limit (per-user UX + per-race anti-stampede)
Khi action expensive (refresh cache, regen leaderboard) cần 2-layer guard:
- **Tier 1** per-user UX: `master:cc-refresh-lock-user:<userId>` SETNX TTL 30s → 429 "Đợi {N}s" cho user.
- **Tier 2** per-race anti-stampede: reuse F-001 `master:discover-lock:<raceId>` SETNX TTL 30s → 409 "Race đang refresh" cho race-level.

Reusable cho F-006 (Course Map upload) + F-008 (Kiosk lookup).

### Pattern: Design canvas fidelity audit (when HTML mockup reference exists)
Khi feature có design canvas reference (HTML mockup file), Coder pre-QC checklist BẮT BUỘC:
- [ ] Audit duplicate sections — KHÔNG để 3 header strips + Hero Stats grid trùng SummaryCardsRow
- [ ] Verify design tokens — copy `--5s-*` CSS vars sang globals.css
- [ ] Verify typography stack — Plus Jakarta Sans (display) + Be Vietnam Pro (body) + JetBrains Mono (data)
- [ ] Match layout primitives — rounded-[14px] cards, padding scale, color hex match canvas

User feedback: "tao khá kì vọng vào cái design đó" → fidelity ~70% sang ~98% qua visual polish round.

### Pattern: Dedicated entity query > generic activity feed
List view của entity X (alerts, orders, kits, …) phải query endpoint của X (`listX(filters)`), KHÔNG reuse generic snapshot field như `recentActivity` mix nhiều event types.

Anti-pattern caught: `AlertFeedPanel` ban đầu dùng `snapshot.recentActivity` mix `poll.completed` events + `alert.created` events → user thấy poll spam thay vì miss chip alerts. Fix: switch sang `listTimingAlerts(raceId, {status:'OPEN', pageSize:50})`.

### Pattern: Cache namespace migration via additive write+read (no manual flush)
Khi đổi namespace cache key cũ → mới (vd: `dashboard-snapshot:` → `master:rr-snapshot:`):
- Old keys với pattern cũ TTL ngắn (15s) tự expire → KHÔNG cần manual flush
- New code dùng `master:` prefix consistent
- Acceptable nếu TTL ≤ 60s; nếu TTL dài (≥1h) → flush manual `redis.del(pattern_old)`

### Pattern: Tab rename UI-only (route + query key giữ)
Khi rename tab label cho marketing/UX (vd: "Cockpit" → "Command Center"):
- Tab label trong `<TabsTrigger>` đổi
- Route URL (`/timing-alerts/cockpit`) GIỮ nguyên — không break shared link, bookmark
- TanStack Query key (`['cockpit-snapshot', raceId]`) GIỮ nguyên — backward compat consumers

---

## 🗺️ Patterns from FEATURE-006 (Course Map Visualization)

### Pattern: GPX/KML server-side parse + Douglas-Peucker simplify
Khi cần render large geo dataset trong browser (GPX 50K+ points → Leaflet polyline):
- Parse server-side qua `@tmcw/togeojson` → GeoJSON FeatureCollection
- Simplify qua `@turf/simplify` Douglas-Peucker (tolerance 0.0001 ~ 10m WGS84)
- Cache kết quả simplified (NOT raw 50K points) để tránh memory blowup
- Validate WGS84 bounds (`-90..90`, `-180..180`) trước parse

Reusable cho future feature: athlete actual track heatmap, course certification visualization, route comparison.

### Pattern: Leaflet wrapped `next/dynamic({ ssr: false })`
Next.js 16 SSR-unsafe khi import Leaflet trực tiếp (uses `window` global):
```typescript
// CourseMapTab.tsx (Server-safe wrapper)
const CourseMapTabInner = dynamic(() => import('./CourseMapTabInner'), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-stone-100 animate-pulse" />,
});
```
Pattern: outer Server Component (or 'use client' wrapper) → dynamic-imported inner with `ssr: false`. Hydration-safe, KHÔNG SSR error build.

### Pattern: escapeHtml() inline helper for divIcon HTML interpolation
Leaflet `divIcon({ html: ... })` raw interpolates strings vào innerHTML → user-controlled data = XSS vector.

```typescript
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Usage:
const safeLabel = escapeHtml(String(label));
const html = `<div ...>${safeLabel}</div>`;
```

NEVER raw interpolate user data vào `divIcon({ html })`. Pattern logged sau F-006 QC BLOCKER catch — admin-controlled checkpoint key → stored XSS public race page nếu skip escape.

### Pattern: Strict 3-level fuzzy match (no substring/Levenshtein)
Khi match user-defined names (vd: GPX waypoint name ↔ checkpoint key):
- **L1 Exact:** `a === b` (case-sensitive) → auto-assign
- **L2 Case-insensitive:** `a.toLowerCase() === b.toLowerCase()` → auto-assign + warn log
- **L3 No-match:** không match L1/L2 → manual handling

**TUYỆT ĐỐI KHÔNG** dùng substring/Levenshtein/fuzzy ngoài 2 level trên — false positive `TM10` ↔ `TM1` sẽ break user expectation. Test fixture phải cover false positive case.

### Pattern: Targeted QC re-run cho narrow Coder rework
Khi Coder rework narrow scope (1-3 file fix specific issue) → QC re-run target 4 items only thay vì full 5-phase audit:
1. Issue specific verified (grep/code inspection)
2. Regression tests still PASS (related test suite)
3. Build + tsc clean
4. F-005 lessons reaffirmed (no new violation)

Tiết kiệm ~10 min vs full re-run (F-005 BR-CC-10 + F-006 XSS rework đều áp dụng successfully). KHÔNG áp dụng cho rework scope rộng (>5 files hoặc cross-module).

### Pattern: Inline dialog extract → controlled component
Khi page.tsx > 1500 lines có inline dialog ~300 lines:
- Extract sang `[ParentName]Dialog.tsx` standalone
- Controlled component: parent giữ state (open, form, editing entity), dialog accept props in / events out
- Smoke verify: existing tabs/flows preserve byte-for-byte sau extract
- F-006 áp dụng: extract `CourseDialog.tsx` từ `page.tsx` (1500 lines) — preserve 4 baseline tabs, add 5th Map tab

### Pattern: Section-based integration drop-in tab body
Khi target page chưa có tab system trong MVP nhưng future tab structure planned:
- Insert feature as section block (mt-N spacing)
- Component shape future-proof: drop-in tab body khi tab system implement
- F-006 áp dụng: insert `<CourseMapSection>` vào race detail page section. F-007 Readiness + F-008 Kiosk sẽ implement tabs → section component drop-in.

### Pattern: DTO sync hotfix `804f707` reaffirm (F-001 → F-006)
NestJS `ValidationPipe { whitelist: true, forbidNonWhitelisted: true }` REJECT bất kỳ field không khai trong DTO → 400 silent. Mỗi field trong Mongoose schema PHẢI có decorator tương ứng:
- `Race` schema → `CreateRaceDto` + `UpdateRaceDto`
- `RaceCourse` subschema → `AddCourseDto` + `UpdateCourseDto`
- `CourseCheckpoint` subschema → `CourseCheckpointDto`

F-006 added 4 fields → all 3 DTO synced. Pre-commit check: POST với new field payload returns 200, không 400.

---

## ✏️ Cách Manager update file này

Khi feature mới ship (`/5bib-deploy`):
- Pattern mới được Coder dùng + QC chấp nhận → thêm vào section tương ứng
- Anti-pattern mới được QC bắt → thêm vào bảng REJECT
- Convention bị vi phạm phổ biến → thêm cảnh báo

Format diff trong `05-manager-deploy.md`, sau đó append vào file này.

---

## 🏗️ Patterns from FEATURE-007 v2 (Race Ops Architectural Foundation)

### Pattern: 8-tab race-ops shell layout (Next.js 16 nested route segments)

```
admin/src/app/(dashboard)/races/[id]/
├── layout.tsx                    # Shell wrapper — sticky RaceOpsHeader + <main>
├── page.tsx                      # Overview render at root (PAUSE-MGR-01 — no redirect flash)
├── overview/page.tsx             # Alias route
├── readiness/page.tsx            # Placeholder F-010
├── course-map/page.tsx           # Placeholder F-009
├── command-center/page.tsx       # Placeholder F-008
├── result-kiosk/page.tsx         # Placeholder F-011
├── athletes/page.tsx             # Placeholder F-012
├── results/page.tsx              # Existing F-013 surface preserved
└── settings/page.tsx             # 1678-line legacy editor (BR-AF-23 byte-for-byte)
```

- Tab nav via `<Link>` client-side navigation (BR-AF-05)
- Active state via `usePathname()` ('use client' wrapper)
- Mobile responsive: `overflow-x-auto scrollbar-hide` < 375px
- Touch target `min-h-[44px]` (BR-AF-27)
- Disabled tabs render `<span aria-disabled cursor-not-allowed>` with explanatory `title` (NOT a `<Link>`, prevents accidental nav)
- Reusable cho future merchant detail page hoặc race detail variants

### Pattern: RaceLiveTimer setInterval 1Hz pattern

- 'use client' minimal boundary cho pure setInterval logic
- 4 race states display matrix (`draft` / `pre_race` / `live` / `ended`) per BR-AF-07
- Pure-exported `computeTimerDisplay()` cho unit testability — 14/14 adversarial PASS (4 states + null + invalid date + 24h overflow + boundary diff=0)
- `setInterval(fn, 1000)` (KHÔNG 100ms — wasteful re-render)
- Cleanup-on-unmount per BR-AF-09; only ticks for `live`/`pre_race` to save battery on `draft`/`ended`
- Edge handling: `scheduledStartAt` null → `TBD`; `startedAt` null while `live` → `RACE LIVE · --:--:--`; `ended` without `endedAt` → `--:--:--`

### Pattern: Design Canvas Reference MANDATORY GATE (CRITICAL — applied retroactively)

- ✅ `/5bib-init` MUST require design canvas reference attached (Figma URL hoặc screenshot)
- ✅ Without canvas → scope marked "logic-only" trong `00-manager-init.md`
- ✅ PRD MUST include "Design Canvas Reference" section với image attachments
- ✅ Visual fidelity audit pre-QC = side-by-side canvas + screenshot diff, NOT self-rate

**Rationale:** F-005/F-006/F-007 v1 self-rated 94-98% fidelity mà KHÔNG link canvas → drift accumulate silently → 50-60% actual fidelity. F-007 v2 rescope cost = 1 sprint architectural rebuild.

### Pattern: Architectural Shape P0 trong PRD Section 1

- Architectural shape (modal vs page vs drawer vs sheet) MUST declared explicit trong PRD Section 1 Goal/Scope
- KHÔNG bury trong Section 6 Technical Mandates
- Coder reads Section 1 first → architecture decision lock-in

### Pattern: 3 Fidelity Scores Post-Implementation (NEW measurement)

Replace single "fidelity %" với 3 separate scores measured post-implementation:

| Score | Target | Definition |
|---|---|---|
| **Component fidelity** | ≥95% | match canvas per-component visuals |
| **Workflow fidelity** | ≥90% | match canvas user task completion path |
| **Architectural fidelity** | = **100%** (gate) | KHÔNG slip back to modal/sub-page |

QC verify post-Coder ship; record trong `04-qc-report.md` Section 6.

### Pattern: Brand Token Migration với fallback role

```css
/* BEFORE (F-005/F-006 era) */
:root {
  --5s-blue: #1D49FF;     /* primary blue */
  --5s-primary: #1D49FF;
}

/* AFTER F-007 (v2 magenta brand) */
:root {
  --5s-primary: #FF0E65;        /* magenta — brand primary */
  --5s-primary-hover: #d9094f;  /* darker magenta */
  --5s-info: #1D49FF;           /* blue retained for data viz / info banner role */
  --5s-live: #FF0E65;           /* RACE LIVE pulsing dot */
  --5s-blue: #1D49FF;           /* back-compat alias kept so F-005 components keep compiling */
  --5s-blue-50: #1D49FF0d;      /* back-compat alias */
}
```

- Migration grep + replace hex literal swap; out-of-scope files (5Solution brand + article-categories + 5bib-info data-viz tokens) preserved
- Audit gate: `grep -rn "#1D49FF" admin/src/app/(dashboard)/races/ admin/src/components/race-ops-shell/ admin/src/components/course-map/ frontend/app/(main)/races/` → 0 results (BR-AF-16)
- Pattern reusable cho future brand pivot

### Pattern: Settings tab byte-for-byte preservation (legacy migration)

- Move-not-rewrite: 1678-line legacy editor moved verbatim từ `[id]/page.tsx` → `[id]/settings/page.tsx` qua single relative-import fix (`./components/CourseDialog` → `../components/CourseDialog`)
- Smoke verify each sub-tab functional sau move (UAT-AF-07 gate)
- Reusable cho future legacy migrations: minimum-risk + zero-refactor + 100% feature parity
- F-014 future redesign Settings — for now, preservation > refactor

### Pattern: Middleware-based 301 redirect (deprecation window)

```typescript
// admin/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COCKPIT_RE = /^\/races\/([^/]+)\/timing-alerts\/cockpit\/?$/;

export function middleware(request: NextRequest) {
  const match = request.nextUrl.pathname.match(COCKPIT_RE);
  if (match) {
    const url = request.nextUrl.clone();
    url.pathname = `/races/${match[1]}/command-center`;
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/races/:id/timing-alerts/cockpit:path*',
};
```

- 30-day deprecation window then hard-delete
- Regex extracts only the race-id segment (no open-redirect surface)
- Document hard-delete date in file header
- NOTE: app has NO `basePath` (verified `admin/next.config.ts`); canonical URLs are `/races/[id]/...` NOT `/admin/races/[id]/...`

### CRITICAL Lesson Learned

> **F-005 + F-006 v1 self-rated 94-98% fidelity but actual = 50-60%. F-007 v1 polish was sai layer (modal F-006 + sub-page F-005). Rescope cost = 1 sprint. Future features MUST gate design canvas reference before /5bib-init.**

---

## 🇻🇳 VN Microcopy Glossary (F-007 BR-UX-29)

Single source of truth: `admin/src/lib/vn-microcopy.ts`. UI components MUST resolve labels qua `vnLabel(key)` / `vnHealthLabel()` / `vnSeverityLabel()` thay vì hardcode chuỗi VN tại call site. Coder add new key → đồng thời thêm vào file glossary này (manager append) + add key vào export trong `vn-microcopy.ts`.

### 1) Health badges (AthleteFlowChart per checkpoint)

| Internal key | EN legacy | VN canonical | Notes |
|---|---|---|---|
| `good` / `OK` | OK | **TỐT** | ≥90% expected count crossed CP |
| `warn` / `ATT` | ATT | **CHÚ Ý** | 70–90% — start watching trend |
| `fail` / `CRIT` | CRIT | **KIỂM TRA THIẾT BỊ** | <70% — likely timing-mat fault |

### 2) Alert severity (AlertFeedPanel filter chips)

| Internal key | EN legacy | VN canonical | Filter chip |
|---|---|---|---|
| `CRITICAL` | Critical | **NGHIÊM TRỌNG** | "Nghiêm trọng" |
| `HIGH` | High | **CAO** | "Cao" |
| `WARNING` | Med | **CẢNH BÁO** | "Trung bình" (chip "TB") |
| `INFO` | Low | **THÔNG TIN** | "Thấp" |

### 3) Race lifecycle (StatusPill)

| Code | VN label |
|---|---|
| `draft` | NHÁP |
| `pre_race` | TRƯỚC RACE |
| `live` | ĐANG DIỄN RA |
| `ended` | KẾT THÚC |

### 4) Action verbs (buttons / CTAs)

| Action key | VN canonical |
|---|---|
| `force-refresh` | Cập nhật ngay |
| `manual-mode` | Kéo thả thủ công |
| `discover` | Phát hiện checkpoint |
| `snap` | Bám đường tự động |
| `export-csv` | Tải xuống CSV |
| `export-clipboard` | Sao chép |
| `export-print` | In |
| `upload-gpx` | Tải lên GPX/KML |
| `save` / `cancel` | Lưu / Huỷ |

### 5) Convention rule

- KHÔNG hardcode chuỗi VN tại call site — luôn `vnLabel(key)`.
- KHÔNG đặt EN-VN map trong file UI — chỉ ở `admin/src/lib/vn-microcopy.ts`.
- Frontend public side hiện tại không có shared file (cross-app boundary) — copy chuỗi từ glossary trên xuống component, KHÔNG import admin lib.
- Add key mới: vừa update `vn-microcopy.ts` vừa append vào glossary này.


---

## 🏟️ Race Ops 9-tab shell patterns (FEATURE-008 v2 onwards)

### B3 hybrid drill-in pattern (BR-CC2 + 9-tab shell)

Sub-views trong shell tab body via query param thay vì nested route:

```tsx
// command-center/page.tsx
export default function CommandCenterPage({ searchParams }: { searchParams: { view?: string } }) {
  return <CommandCenterLayout drillInView={searchParams.view} />;
}

// CommandCenterLayout.tsx
function CommandCenterLayout({ drillInView }: { drillInView?: string }) {
  if (drillInView === 'alerts') {
    return <><BackToDashboardLink /><AlertsListView /></>;
  }
  return <DashboardSections />; // 7-section default
}
```

Lý do chọn query param vs nested route:
- ✅ Simpler — 1 file path, conditional render
- ✅ Shell tab nav stays active (URL  vs )
- ✅ Deep-link semantic enough
- Trade-off: bookmark less semantic than route segment

### Verbatim port pattern (BR-AF-23 chính thức formal)

Khi migrate legacy code (vd: F-005 sub-page → 9-tab shell), Coder PHẢI verbatim port với single-import-path-fix-only:

```typescript
// ❌ SAI — refactor while migrating
function MigratedComponent() {
  // logic được "clean up" hoặc "improved" trong khi port
}

// ✅ ĐÚNG — verbatim port, ZERO logic drift
// Original: timing-alerts/components/AlertsTab.tsx (491 lines)
// Migrated: command-center/components/AlertsListView.tsx (491 lines, byte-for-byte equal)
import { AlertDetailDialog } from './AlertDetailDialogWrapper'; // ← chỉ fix import path này
// Tất cả logic khác BYTE-FOR-BYTE giống bản gốc
```

Wrapper re-export pattern cho dialogs (avoid file duplication):
```typescript
// AlertDetailDialogWrapper.tsx
export { AlertDetailDialog } from '@/app/(dashboard)/races/[id]/timing-alerts/components/AlertDetailDialog';
```

Multiple imports fail = STOP, raise PAUSE; do NOT inline copy file.

### Fullscreen via CSS attr (NOT F11)

```tsx
// CommandCenterFullscreenButton.tsx — 'use client'
function toggleFullscreen() {
  document.body.toggleAttribute('data-fullscreen');
}
useEffect(() => {
  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') document.body.removeAttribute('data-fullscreen');
  };
  document.addEventListener('keydown', onEsc);
  return () => {
    document.removeEventListener('keydown', onEsc);
    document.body.removeAttribute('data-fullscreen'); // safety on unmount
  };
}, []);
```

```css
/* globals.css */
body[data-fullscreen] [data-race-ops-shell-header] {
  transform: translateY(-100%);
  transition: transform 200ms ease-out;
  pointer-events: none;
}
```

Lý do KHÔNG dùng F11 browser API: conflicts state, browser-controlled, prevents React control flow.

### 2-step typing-confirmation modal (race-day safety)

Cho destructive actions visible button (Reset, Delete, Wipe):

```tsx
// ResetConfirmModal.tsx
const [step, setStep] = useState<1 | 2>(1);
const [typed, setTyped] = useState('');
const matches = typed.trim() === race.name.trim();

// Step 1: warning + race-day status check + Cancel/Continue
// Step 2: typing exact race name to confirm + Submit disabled until matches
// On submit: server-side audit log entry + invalidate queries
```

4-layer defense pattern (race-day visible button):
1. Backend guard ()
2. Body validation (`confirmToken === race.slug`)
3. Service-level status throw (`race.status === 'live'/'ended'` raise)
4. Frontend 2-step typing modal + status-disabled trigger

### SSE listener body-scoped hook

```typescript
// admin/src/lib/use-timing-alert-sse.ts
'use client';
export function useTimingAlertSse(raceId: string, options?: { onCriticalAlert?: () => void }) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!raceId) return;
    const es = new EventSource(timingAlertSseUrl(raceId), { withCredentials: true });
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedInvalidate = () => {
      if (timer) return; // already scheduled
      timer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
        timer = null;
      }, 1500);
    };
    es.addEventListener('alert.created', debouncedInvalidate);
    return () => {
      es.close();
      if (timer) clearTimeout(timer);
    };
  }, [raceId, qc]);
}
```

Best practices:
- Body-scoped (mount/unmount với component) — KHÔNG shell-level (cross-tab leak risk)
- Debounce invalidate 1500ms (race-day 1000+ alerts spam)
- Cleanup robust (es.close + clearTimeout)
- React strict mode dev double-mount safe

### DTO additive backward compat

Khi extend response DTO cho cross-feature evolution, thêm field optional + nullable, KHÔNG rename/remove:

```typescript
// dashboard-snapshot.dto.ts — F-008 v2 additive
@ApiProperty({
  description: 'Last successful poll timestamp from TimingAlertConfig',
  example: '2026-05-07T07:30:00Z',
  nullable: true,
  type: String,
})
lastPollAt: Date | null;
```

Lý do safe: F-005 sub-page (parallel preserve 30-day window) ignore extra field per JSON spec → no breaking change.

KHÔNG: rename existing field, change type semantic, remove field. Nếu cần breaking → migration plan + raise PAUSE.


---

## 🏔 Risk-profile-based confirm UX hierarchy (FEATURE-009 onwards)

Crystallized từ F-008 v2 Reset + F-009 Drag/Auto-snap divergence:

| Risk profile | Confirm pattern | Example |
|---|---|---|
| **Reversible edit** (drag position, toggle setting) | **Lightweight toast 3s** (`sonner`) | F-009 ManualDragModeButton |
| **Override prior work** (auto-snap erases manual edits) | **MEDIUM modal** với explicit warning | F-009 AutoSnapButton "Sẽ ghi đè drag thủ công?" |
| **Destructive data loss** (Reset alerts, Delete entity) | **2-step typing confirmation** (race name match) | F-008 v2 ResetConfirmModal |

**Avoid one-size-fits-all confirm.** Match UX cost to action's reversibility cost.

```typescript
// Lightweight reversible
toast('Drag mode bật', { duration: 3000, icon: '✋' });

// MEDIUM override warning
<Dialog>
  <DialogTitle>Khôi phục vị trí tự động?</DialogTitle>
  <DialogDescription>Sẽ ghi đè vị trí drag thủ công. Hành động này không thể hoàn tác.</DialogDescription>
  <Button variant="destructive">Khôi phục</Button>
</Dialog>

// 2-step typing destructive
const [step, setStep] = useState<1 | 2>(1);
const matches = typed.trim() === race.name.trim();
// Submit disabled until matches
```

---

## 🎯 Multi-resource pill picker với 4-state status badge (FEATURE-009 onwards)

Pattern cho any multi-resource navigation (3-5 resources, alternative với dropdown):

```typescript
'use client';
const router = useRouter();
const searchParams = useSearchParams();
const currentId = searchParams.get('resource') ?? resources[0]?._id;

function getStatus(r: Resource): 'complete' | 'partial' | 'no-data' | 'error' {
  if (!r.dataA) return 'no-data';      // ❌
  if (r.dataB?.some(x => !x.field)) return 'partial';  // ⚠
  return 'complete';                     // ✅
}

const STATUS_BADGES = {
  complete: { icon: '✅', color: 'green' },
  partial: { icon: '⚠', color: 'amber' },
  'no-data': { icon: '❌', color: 'red' },
  error: { icon: '🔴', color: 'red' },
};

// Render pills horizontal scroll mobile, fixed desktop
// Click pill → router.replace với updated query param
// Selected pill highlighted, status badge top-right corner
```

Use cases ready for adoption: F-009 Course Map (course distance picker), future Athletes filter, future Results filter.

---

## ⚖️ AIMS/ITRA compliance disclaimer pattern (FEATURE-009 onwards)

Race standards transparency pattern cho features touching certifiable race data:

```typescript
'use client';
const STORAGE_KEY = 'aims-itra-disclaimer-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const [dismissed, setDismissed] = useState(false);
useEffect(() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && Date.now() - Number(stored) < DISMISS_DURATION_MS) {
    setDismissed(true);
  }
}, []);

function handleDismiss() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
  setDismissed(true);
}

// Render: <Alert variant="info"> top of page
// "GPX là tham khảo. Course measurement chính thức cần Jones Counter (AIMS) hoặc GPS multi-device average (ITRA)"
// + "Đã hiểu" dismiss button
```

**Why 7-day dismiss (not permanent):** Re-show ensures BTC remembers compliance disclaimer over time. Permanent dismiss = liability risk.

Applicable cho: Course Map (F-009), future ResultsCertification, future TimingMeasurement features.

---

## 🎯 Per-course timing presets pattern (FEATURE-010)

Pattern cho any feature có config values khác nhau theo race category. F-010 introduced `course_type` enum (`ROAD | TRAIL | ULTRA`) on `timing_alert_configs` collection với preset table.

```typescript
// admin/src/app/(dashboard)/races/[id]/settings/components/TimingDetectionConfigSection.tsx
const TIMING_PRESETS = {
  ROAD: {
    paceBuffer: 1.10,
    paceAlertThreshold: 0.80,
    overdueMinutes: 30,
    confidenceMultiplier: 0.20,
  },
  TRAIL: {
    paceBuffer: 1.35,            // Danny adjusted (Sports recommended 1.40-1.50)
    paceAlertThreshold: 0.45,    // Sports Expert recommended
    overdueMinutes: 45,
    confidenceMultiplier: 0.20,
  },
  ULTRA: {
    paceBuffer: 1.50,            // Danny adjusted upper bound
    paceAlertThreshold: 0.40,
    overdueMinutes: 60,
    confidenceMultiplier: 0.15,
  },
} as const;

// Preset selector → auto-fills 4 fields. Admin can override individual values after selection.
```

**Validation (DTO @ApiProperty + class-validator):**
- `paceBuffer` @Min(1.01) @Max(2.0) — pace buffer cannot be ≤ 1.00 (no slack) or > 2.0 (unrealistic)
- `paceAlertThreshold` @Min(0.2) @Max(0.95) — % of expected pace at which alert fires
- `confidenceMultiplier` @Min(0.05) @Max(1.0)
- `course_type` @IsIn(['ROAD','TRAIL','ULTRA'])

**Dual-expert validation precedent (F-010):** Race Operation Expert ✅ approved 8/8 PRD items + Sports Domain Expert 🟡 recommended adjustments → Danny compromise resolution → Manager plan v2 documents reasoning explicit. Reusable cho future features needing domain expert dual-validation.

**Field-test mandate post-deploy:** When values depend on race-day empirical validation, log explicit TD entry (e.g., `TD-F010-V1-tuning`) with owner + timeline + A/B adjust criteria. Avoids "ship and forget" trap.

---

## 🚦 MIDDLE_GAP severity escalation pattern (FEATURE-010 BR-FC-19)

Pattern cho multi-detection result severity escalation. Pre-F-010: MIDDLE_GAP default INFO, WARNING for TopN. Post-F-010: 4-tier escalation INFO → WARNING → HIGH → CRITICAL based on consecutive count + TopN flag.

```typescript
// miss-detector.service.ts (post-F-010)
const middleGapResults = results.filter(r => r.type === 'MIDDLE_GAP');
const isConsecutive = middleGapResults.length >= 2;
const isTopN = athlete.overallRank <= TOP_N_THRESHOLD;

function classifySeverity(isConsecutive: boolean, isTopN: boolean): Severity {
  if (isTopN) return 'CRITICAL';                  // TopN — always critical
  if (isConsecutive) return 'HIGH';               // 2+ consecutive same athlete
  return 'WARNING';                                // single MIDDLE_GAP (was INFO pre-F-010)
}
```

**Test coverage:** 4 paths in `miss-detector.service.spec.ts` — single → WARNING, 2+ consecutive → HIGH, TopN → CRITICAL, TopN + consecutive → CRITICAL.

Reusable for any multi-detection result severity grouping.

---

## 📊 Percentage-based confidence formula (FEATURE-010 OBS-2)

Pattern cho any confidence-by-progress feature. Pre-F-010: absolute threshold (50 finishers → 100% confidence regardless of race size). Post-F-010: percentage of registered athletes finished.

```typescript
// projected-rank.service.ts (post-F-010)
function calculate(totalFinishers: number, totalRegistered: number, multiplier: number): number {
  const threshold = totalRegistered > 0
    ? totalRegistered * multiplier      // percentage-based
    : 50;                                // pre-F-010 absolute fallback
  return Math.min(1, totalFinishers / Math.max(threshold, 1));
}
```

**Edge cases tested:**
- `totalRegistered === 0` → fallback to absolute 50 (pre-F-010 behavior preserved)
- Confidence cap at 1.0 (no over-100%)
- `multiplier` configurable per course_type (0.10/0.20/0.50 tested)
- Backward compat: omit params → no change vs pre-F-010

Reusable cho any feature computing confidence from progress count + total population.

---

## ⏱️ Wall-clock overdue via lastPollAt (FEATURE-010 OBS-1)

Pattern cho time-based detection that needs to account for poll-cycle gaps. Pre-F-010: static gap from expectedSeconds. Post-F-010: includes `lastPollAt` wall-clock delta.

```typescript
// miss-detector.service.ts (post-F-010)
function computeOverdueMs(
  expectedSecondsAtNext: number,
  lastSeenSeconds: number,
  lastPollAt: Date | null,
): number {
  const gapMs = Math.max(0, expectedSecondsAtNext - lastSeenSeconds) * 1000;
  if (lastPollAt) {
    return gapMs + Math.max(0, Date.now() - lastPollAt.getTime());
  }
  return gapMs;  // backward compat — fallback static gap when null
}
```

**Source of `lastPollAt`:** poll service pre-fetches `existingAlert?.last_checked_at` via `.select({ bib_number, last_checked_at }).lean()` for batch lookup, then passed into `detect()` per-athlete in options.

Reusable cho any wall-clock-aware detection (vendor sync gaps, race day poll lag, etc.).

---

## 🔌 Cross-module Mongoose DI pattern (FEATURE-005 + FEATURE-010 reaffirmed)

Pattern cho read-only cross-module data access without circular DI risk. Use `MongooseModule.forFeature()` directly trong consumer module's `imports` thay vì inject service from origin module.

```typescript
// race-result.module.ts (F-010 added)
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'RaceResult', schema: RaceResultSchema },
      // F-010 cross-module DI:
      { name: TimingAlertConfig.name, schema: TimingAlertConfigSchema },  // ← read-only access
    ]),
  ],
  providers: [RaceResultService /* ... */],
})
export class RaceResultModule {}

// race-result.service.ts
@Injectable()
export class RaceResultService {
  constructor(
    @InjectModel('RaceResult') private raceResultModel: Model<RaceResult>,
    @InjectModel(TimingAlertConfig.name) private timingAlertConfigModel: Model<TimingAlertConfig>,
  ) {}

  async getPaceAlertThreshold(raceId: string): Promise<number> {
    const config = await this.timingAlertConfigModel.findOne({ raceId }).lean();
    return config?.pace_alert_threshold ?? 0.80;  // fallback default
  }
}
```

**Circular DI guard:** opposite module (here: TimingAlertModule) MUST NOT import consumer module (RaceResultModule) directly. F-005 used reverse direction (TimingAlertModule reading RaceResultModel); F-010 uses forward direction (RaceResultModule reading TimingAlertConfigModel). Both proven safe via `tsc --noEmit` clean.

**Trade-off vs `@nestjs/event-emitter`:** Direct InjectModel = simpler + zero indirection cost. Use event-emitter only when need fire-and-forget pub-sub semantics (e.g. F-001 frontend-driven debounce avoided event hook for circular DI risk between RacesModule ↔ TimingAlertModule). For read-only model access — InjectModel preferred.

---

## 🎓 Expert advisory collaboration model (FEATURE-009 + FEATURE-010 precedent)

Pattern cho cluster features touching specialized domains (race operations, sports physiology, competitor analysis). 3-skill consultation format established F-009 → F-010.

**Workflow:**
1. **PRD draft** — BA produces baseline spec với best-effort default values
2. **Expert review consolidated** — separate skill agents produce structured reviews:
   - **Race Operation Expert** — race-day operational correctness (CUTOFF_RISK auto-resolve, DNS 3-state, sweep protocol parity với UTMB/Western States, photo evidence companions)
   - **Sports Domain Expert** — physiological realism (back-of-pack pace variance, terrain elevation impact, VN amateur context, ultra aid station stops)
   - **Strategic Scout** — competitor parity gap analysis (5BIB vs RaceResult/RunSignup/ChronoTrack/UTMB Live; TOP N missing features ranked; kill strategies)
3. **Consolidated artifact** — `expert-review-consolidated.md` (~100 lines, 3 sections)
4. **Manager plan v2** — incorporate expert advisories: explicit Danny adjustments + risk flags + post-deploy roadmap. Plan verdict can stay UNCHANGED if values are mid-range compromises (vs blocking on extreme conservatism).
5. **Coder implementation** — references both PRD + plan v2 + consolidated review
6. **QC verifies** — expert advisory items each have explicit ✓ status row in QC report (8/8 grid)

**When to invoke:** cluster features touching real-world operational domain (race day, sports physiology, vendor competitive landscape). NOT needed for pure tech features (DTO sync, cache invalidation, internal refactor).

**Reproducible precedent:** F-009 introduced Race Operation Expert; F-010 added Sports Domain Expert + Strategic Scout. Reusable cho future race-day-operations cluster features (F-012/F-013/F-014 candidates).

---

## 🚦 Status-aware UI guard pattern (FEATURE-011 BR-PB-04)

Pattern cho UI components có logic-correct backend output nhưng UX-misleading rendering trong specific race lifecycle states. Use early-return guard ABOVE existing render ladders để bypass logic-correct-but-misleading paths per-state, while preserving backend logic verbatim.

```tsx
// AthleteFlowChart.tsx (F-011 BR-PB-04 + BR-PB-05)
type RaceStatus = 'draft' | 'pre_race' | 'live' | 'ended';

interface AthleteFlowChartProps {
  // ... existing
  raceStatus?: RaceStatus;  // optional, default undefined → backward compat
}

export function AthleteFlowChart({ progression, raceStatus, ... }: AthleteFlowChartProps) {
  // NEW pre-race guard ABOVE existing empty-state ladder
  if (raceStatus === 'draft' || raceStatus === 'pre_race') {
    return (
      <CardShell>
        <div className="flex items-center gap-2 px-4 py-6 text-stone-600 bg-stone-50 border rounded-lg">
          <span aria-hidden>⏱</span>
          <span>Race chưa khởi động — chờ start gun</span>
        </div>
      </CardShell>
    );
  }

  // ... existing 3-tier empty-state ladder + FlowRows render
  // F-005 health() calc preserved verbatim (lines 144-145):
  //   const status = c >= e * 0.9 ? 'good' : c >= e * 0.7 ? 'warn' : 'fail';
}
```

**Key invariants:**
- Backend logic preserve verbatim (F-005 health() calc lines 144-145 untouched)
- Frontend interprets `race.status` per-state via early-return guard ABOVE existing render ladders
- Optional prop default `undefined` → guard does NOT fire → backward-compat 100% (legacy consumers unaffected)
- Status discriminator literal union `'draft' | 'pre_race' | 'live' | 'ended'` (matches Mongoose race lifecycle)

**Reusable cho:** any race-lifecycle-dependent component where backend output is logic-correct but UX-misleading in specific states. Examples for future cluster features: Awards pre-race "chưa có podium" state, Result Kiosk pre-race "chưa có kết quả" state, Athletes filter status-dependent view.

**Anti-pattern (REJECT in review):** modifying backend logic to handle UI-state edge cases (e.g. returning 0% as "OK" instead of "fail"). Backend logic must stay correct; frontend interprets per-state.

---

## 🪟 Fullscreen scope dual-layer pattern (FEATURE-011 BR-PB-02)

Pattern cho fullscreen mode that needs to hide MULTIPLE shell layers (admin shell + route-specific shell). Use parallel data-attribute selectors with route-agnostic admin layout shared via attrs additive (zero class change per BR-AF-23).

```tsx
// (dashboard)/layout.tsx — shared admin layout (used by ALL admin routes)
<aside data-admin-sidebar className="hidden lg:flex ...">  {/* F-011: +1 attr additive */}
  ...
</aside>
<header data-admin-topbar className="sticky top-0 ...">  {/* F-011: +1 attr additive */}
  ...
</header>

// races/[id]/components/RaceOpsHeader.tsx (F-008 v2 baseline)
<header data-race-ops-shell-header ...>
  ...
</header>
```

```css
/* globals.css — fullscreen scope dual-layer (F-008 v2 + F-011) */
body[data-fullscreen] [data-race-ops-shell-header] {
  transform: translateY(-100%);  /* F-008 v2 race-ops shell */
}

body[data-fullscreen] [data-admin-sidebar],
body[data-fullscreen] [data-admin-topbar] {
  display: none !important;  /* F-011 admin shell — !important overrides Tailwind lg:flex */
}
```

**Key invariants:**
- Mechanism preserved (`body[data-fullscreen]` CSS attribute toggle, NOT F11 native)
- Scope expanded only via parallel selector additive — NEVER replace existing rules
- Route-agnostic admin layout shared via attrs (used by ALL admin routes; only `body[data-fullscreen]` toggling routes show effect)
- BR-AF-23 byte-for-byte preserve mandate honored — additive 2 data-attributes only, ZERO class change, ZERO markup restructure
- `!important` justified for overriding Tailwind utility classes (`lg:flex` on `<aside>`); precedent per F-008 v2 BR-CC2-09

**Reusable cho:** future fullscreen-aware features touching shared admin layout boundary. Pattern: ADD attribute on shared layout, EXTEND globals.css with parallel selector, DO NOT restructure markup.

**Anti-pattern (REJECT in review):** restructuring shared layout markup OR removing existing class names to add fullscreen-aware behavior. Always prefer additive data-attributes + CSS extension.

---

## 🔁 Post-deploy UX feedback loop pattern (FEATURE-011 precedent)

Pattern cho UX bugs surfacing during BTC race-day prep AFTER cluster feature deploy. Establish a small-scope BUGFIX feature ship-in-1-sprint cycle parallel với feature pipeline.

**Workflow (F-011 precedent):**

1. **Deploy** — cluster feature ships (e.g. F-009 Course Map Standalone Tab 2026-05-07)
2. **BTC UAT** — race-day BTC tests on real race data (e.g. Giải Công An pre-race state)
3. **Bug discovery** — UX issues surface (logic-correct backend, UX-misleading rendering / VN microcopy gap / fullscreen scope gap / etc.)
4. **BUGFIX init** — Manager initializes new feature (`/5bib-init`), small-scope (5 files target, presentation layer only, ~40-100 LOC)
5. **PRD + Plan + Code + QC + Deploy** — full workflow lap, but condensed (Manager init same-day, BA PRD same-day, Coder same-day, QC same-day, Deploy same-day or next-day)
6. **Cluster polish slot** — bugfix runs PARALLEL với feature pipeline (e.g. F-011 + F-010 parallel), additive coexistence on shared files when both honor ADDITIVE-only mandate

**Key invariants:**
- Small-scope mandate (presentation layer only, 5-file Scope Lock, ZERO backend modify)
- ADDITIVE coexistence với in-flight features (e.g. F-011 owned 1-line at CommandCenterLayout while F-010 owned DnsBreakdownCard render block in same file)
- Pre-deploy UAT smoke test mandate cho ALL race statuses (draft / pre_race / live / ended)
- Status-aware UI guard becomes checklist item for any race-status-dependent UI

**When to invoke:** UX bugs surfacing post-deploy that are presentation layer only (not backend logic, not schema, not API contract). NOT for feature requests / scope expansion / new business rules — those go through standard feature pipeline.

**Reusable precedent:** F-011 closes Race Ops Cluster #6 polish slot. Pattern viable cho future post-deploy UAT cycles where small-scope UX bugs surface during BTC race-day prep.

---

## 💡 Inline tooltip surface pattern (FEATURE-012 BR-FH-01..05)

Pattern cho inline hint surfaces (formula explanation, field-level guidance) when shadcn `<Tooltip>` primitive NOT in repo + NO new npm install policy strict.

**Recipe:**
1. **Trigger:** `<Info />` icon (lucide-react) or equivalent next to the field/element being annotated
2. **Custom click-to-toggle popover** — component-local `useState<boolean>` open state, `onClick` toggle, no shadcn Tooltip dep
3. **3-layer content per tooltip:**
   - Formula: `<code>` block với math identifier (e.g., `pace_threshold = expected_pace × pace_buffer`)
   - VN explanation: 1-2 sentences plain language
   - 1 example: concrete numeric scenario (e.g., "VD ROAD 0.20, total 1000 athletes, 200 pass CP → confidence 100%")
4. **a11y triple (BẮT BUỘC):**
   - `aria-expanded={open}` on trigger button — screen readers announce state
   - Escape keydown listener trên `document` → set open=false (cleanup on unmount)
   - Outside-click listener trên `document` → set open=false (use ref + click-target check)
5. **Mobile responsive:** `max-w-[calc(100vw-2rem)]` on popover content prevents clipping on narrow viewports

**Anti-patterns (REJECT):**
- Hover-only trigger (mobile/touch users can't access)
- Missing aria-expanded (a11y fail)
- Missing Escape handler (UX inconsistency với native UI tooltip patterns)
- Missing outside-click handler (popover stays open, blocks underlying UI)

**Reusable cho:** future inline hint UI when shadcn Tooltip / Radix Tooltip not installed + NO new npm install. When ≥2nd consumer emerges, promote to `<InlineHintPopover />` shared primitive (TD-F012-01 P3).

**Reference impl:** `admin/src/app/(dashboard)/races/[id]/settings/components/TimingFormulaTooltipContent.tsx:80-105` (a11y triple) + `:39-72` (4 BR-FH-01..04 content blocks verbatim PRD).

---

## 📑 Multi-paragraph rationale với current selection highlight pattern (FEATURE-012 BR-FH-07)

Pattern cho "compare options side-by-side với current highlighted" rationale UI — explanation of why N options exist + why current selection makes sense.

**Recipe:**
1. **Trigger always visible** — NO `null` short-circuit if currentSelection is `null/undefined`. Use neutral label fallback (e.g., "Tại sao có 3 preset?") when no current selection. Allows user to read all rationales BEFORE choosing.
2. **Render ALL N options always** when panel opens — `OPTIONS.map(...)` unconditional iteration. Defeats-the-purpose anti-pattern: rendering only current option (user can't compare).
3. **Highlight current option** via accent border-left + background tint (e.g., `border-l-4 border-amber-500 bg-amber-50/70`) + `(đang chọn)` annotation small text below option label.
4. **Citation footer** với expert advisory references — verbatim PRD wording mandatory (e.g., "Nguồn: Race Ops Expert + Sports Domain Expert F-010 advisory (2026-05-07)"). Citation order matches PRD spec.
5. **Icons per UI mockup** (optional but spec'd) — emoji or lucide icons per option (e.g., 🛣️ ROAD / 🥾 TRAIL / 🏔️ ULTRA).
6. **Toggle entire panel** (not per-paragraph) — single `useState<boolean>` open state, all N paragraphs reveal/collapse together.

**Anti-patterns (REJECT):**
- Render only current option's rationale (defeats compare-side-by-side purpose, fails UAT testable assertion "N paragraphs render")
- Hide trigger when current selection is `null` (blocks discovery before choice)
- Custom citation wording (Race Ops content fidelity P0 — verbatim PRD only)

**Reusable cho:** any "explanation of why N options exist + why current makes sense" UI surface. Examples: timing config preset rationale (F-012), course distance comparison (future), rule ladder explanation (future).

**Reference impl:** `admin/src/app/(dashboard)/races/[id]/settings/components/TimingPresetRationalePanel.tsx:50` (always-visible trigger) + `:63 PRESET_ORDER.map(...)` (3 paragraphs always) + `:70-84` (current highlight + annotation) + `:99-102` (citation footer verbatim PRD).

---

## 🔗 Shared constant module to prevent cross-component data drift (FEATURE-012 BR-FH-09 root-cause via TD-F012-02)

Pattern cho shared values consumed by ≥2 components — extract to dedicated `*.constant.ts` module to prevent QC failure mode "values mismatch between consumers".

**Recipe:**
1. **Trigger:** when same data (config values, label maps, enum-driven UI options) needs ≥2 consumers (e.g., form input + display table, both rendering same preset values).
2. **Extract to `*.constant.ts` colocated với consumers** — e.g., `settings/components/timing-presets.constant.ts` next to `TimingDetectionConfigSection.tsx` + `TimingPresetComparisonTable.tsx`.
3. **Export named constants + types:**
   - Const data: `export const TIMING_PRESETS: Record<CourseType, TimingPreset> = { ... }`
   - Label map (VN microcopy): `export const PRESET_LABELS_VI: Record<CourseType, string>`
   - Type union: `export type CourseType = 'ROAD' | 'TRAIL' | 'ULTRA'`
4. **Import from shared module in ALL consumers** — no inline duplication, no "copy-paste then edit" risk.
5. **Module imports nothing from consumers** — keep zero-cycle (constant module is leaf, consumers depend on it).

**Anti-patterns (REJECT):**
- Inline `const TIMING_PRESETS = { ... }` duplicated in form + table (drift risk — Coder Round 1 F-012 BLOCKER #2 root cause)
- Importing display data from form file (couples display to form lifecycle, risks circular import)
- Module imports React or component code (must stay leaf, pure data + types only)

**When to extract (decision rule):**
- ≥2 consumers need same data → extract IMMEDIATELY (don't wait for 3rd)
- Same data needed across module boundaries → extract IMMEDIATELY
- Single consumer right now but spec'd to be reused later → defer to YAGNI (extract when 2nd consumer lands)

**QC failure mode this prevents:** "values mismatch between consumers" — e.g., F-012 Round 1 had form `TIMING_PRESETS.TRAIL.overdueMinutes = 45` (Danny-locked) but table cell value `60` (PRD verbatim). BTC race-day clicks TRAIL → input 45 → opens table → sees 60 → contradiction. Race Ops domain content fidelity P0.

**Reusable cho:** any cross-component data sync need — future cluster features should use this pattern when same enum/config values needed by ≥2 components.

**Reference impl:** `admin/src/app/(dashboard)/races/[id]/settings/components/timing-presets.constant.ts` (56 LOC leaf module) imported by `TimingDetectionConfigSection.tsx:42-46` (form `applyPreset()` calls) + `TimingPresetComparisonTable.tsx:21-24` (table cells render).

---

## Pattern: Scope-local microcopy module (F-013, 2026-05-08)

**Trigger:** feature has rich Vietnamese (or other locale) strings, but no shared `vn-microcopy.ts` module exists yet on the branch.

**Rule:** each feature owns its strings under its own feature folder (e.g., `result-kiosk/kiosk.microcopy.ts`). NOT shared across features. Promote to a shared module ONLY when 3+ features need the same string.

**Why scope-local:**
1. Avoids premature abstraction — first 2 consumers may diverge in tone/voice (race-day vs admin form vs marketing copy).
2. Feature folder remains self-contained — easy to delete, rename, or fork the entire feature.
3. Prevents "shared microcopy module becomes dumping ground" anti-pattern.
4. Easier to enforce VN-only (or EN-only) per surface — Phase 1 PAUSE-RK-09 default for F-013 sets VN-only kiosk strings.

**When to extract to shared:**
- ≥3 features need the SAME string (not similar — exactly the same wording).
- Consider naming/tone consistency across product (e.g., "Bỏ qua" vs "Hủy" vs "Đóng" — promote to shared once consistent verb chosen).

**When NOT to extract:**
- Feature-specific microcopy (button labels, error messages, status badges) — keep scope-local.
- Strings that mix product/brand context (e.g., "Race chưa khởi động — chờ start gun" specific to race-ops) — keep scope-local.

**Reference impl:** `admin/src/app/(dashboard)/races/[id]/result-kiosk/kiosk.microcopy.ts` (F-013 — VN-only Phase 1 PAUSE-RK-09 default). Future i18n EN toggle (PAUSE-RK-09 Phase 2) will extend the file with locale-keyed exports rather than promoting to shared.

**Reusable cho:** any feature with rich locale-specific strings where the shared module either doesn't exist or would be polluted by feature-specific microcopy.

---

## Pattern: SDK unknown-response runtime guard (F-013, 2026-05-08)

**Trigger:** generated SDK function returns `unknown` (or a loose type) because backend OpenAPI schema doesn't fully describe the response shape, OR vendor pass-through fields ride the response unmodelled.

**Rule:** before rendering or destructuring the response, validate shape with a TypeScript user-defined type guard:

```ts
export function isXxxResponse(x: unknown): x is XxxResponse {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>;
  if (typeof r.success !== 'boolean') return false;
  if (r.data !== null && (typeof r.data !== 'object' || Array.isArray(r.data))) return false;
  // ... validate every scalar field used in render path
  return true;
}
```

**Validation checklist for the guard:**
1. Reject `null`, `undefined`, primitives (number/string/boolean) — only plain objects pass.
2. Reject arrays via `Array.isArray(x)` — common attack/edge.
3. Validate every required scalar field type used in render path (NOT every field — over-validation is brittle).
4. Tolerate extra unknown fields (forward-compat — vendor adds new field shouldn't break frontend).
5. JSON.parse limited to vendor strings (e.g., `Chiptimes`, `Paces`) — wrap in try/catch, render parsed values as `{string}` in JSX (auto-escaped by React; no `dangerouslySetInnerHTML`).

**Failure mode:** guard returns false → caller throws or returns `data-error` discriminated outcome → UI renders error variant ("Lỗi dữ liệu — thử lại") with retry button. NEVER render partial/malformed data.

**Why this pattern:**
- Vendor `unknown` types in SDK are a common attack/correctness surface — runtime guard converts type-system unsafety into runtime safety.
- Prevents prototype pollution / deep-read crashes on malformed payloads.
- React JSX auto-escapes string values rendered as `{...}` so XSS is contained AS LONG AS we don't use `dangerouslySetInnerHTML`.
- Forward-compat tolerance (rule 4) means vendor backend changes don't silently break frontend — only required fields are gated.

**Required test cases for the guard (mandatory):**
- Accept well-formed envelope with object data
- Accept well-formed envelope with `data: null` (not-found case)
- Accept numeric vs string scalar variants if vendor sometimes pushes either type
- Reject `null`, `undefined`, array, primitive
- Reject missing required field
- Reject required field wrong type
- Tolerate extra unknown fields (forward-compat)

**Reference impl:** `admin/src/app/(dashboard)/races/[id]/result-kiosk/kiosk.types.ts::isAthleteDetailResponse` (F-013 BR-RK-11) — 13 unit tests cover the full matrix above + `deriveKioskStatus` 7 cases (status discriminator). All 20/20 PASS executed.

**Reusable cho:** any SDK consumer where `unknown` or loose response types appear. Especially valuable for race-result endpoints (vendor PascalCase JSON-string fields ride through), articles, sponsors.

---

## Pattern: Web Audio + Fullscreen API user-gesture co-location (F-013, 2026-05-08)

**Trigger:** feature needs both Web Audio API (sound playback) AND native Fullscreen API (kiosk-style display).

**Rule:** both APIs require a user-gesture event in the call stack (browser policy enforced — no auto-play, no programmatic fullscreen). Co-locate activation at a SINGLE trigger button click handler:

```tsx
// KioskTabBody.tsx — single user-gesture entry
onClick={() => void ctx.enterKiosk()}

// KioskModeProvider.enterKiosk — both APIs satisfy gesture inside handler:
const enterKiosk = useCallback(async () => {
  sound.ensureAudioContext();              // AudioContext born under gesture
  await fullscreen.enterFullscreen();      // requestFullscreen() under gesture
  setMode('bib-input');
}, [sound, fullscreen]);
```

**Why co-locate:**
- Browsers (Chrome/Safari/Firefox) reject AudioContext creation OR `requestFullscreen()` if the call stack didn't originate from a user gesture (click/tap/keydown).
- Multiple separate gesture-required calls forces multiple user clicks (bad UX) — co-locating at ONE button means one user gesture satisfies BOTH policies.
- Lazy AudioContext (NOT created at page load) survives SSR, prevents Chrome console warning "AudioContext was not allowed to start. It must be resumed (or created) after a user gesture".

**Failure modes (both must swallow errors silently):**
- Browser blocks `requestFullscreen` (iframe sandboxed, locked context) → fallback to soft fullscreen via DOM attribute (`body[data-fullscreen="true"]`) so CSS hides chrome regardless.
- Browser blocks AudioContext (Safari low-power mode, locked iframe) → beep no-ops; rest of UI stays functional.
- NEVER throw upward — keep surface usable even if one API fails.

**Required pattern guards:**
- AudioContext creation MUST be lazy (`ensureAudioContext()` on first beep call, NOT at hook init). Otherwise Chrome console warns + audio fails silently.
- `requestFullscreen()` MUST be called inside the click handler call stack — NOT in a `setTimeout`/`Promise.resolve().then` deferred callback (browser tracks "user activation" status synchronously).
- ALWAYS pair with cleanup: unmount → release fullscreen + close AudioContext (state safety).

**Reference impl:** `admin/src/app/(dashboard)/races/[id]/result-kiosk/components/KioskTabBody.tsx` (CTA button) → `hooks/useKioskFullscreen.ts` + `hooks/useKioskSound.ts` (lazy AudioContext under `ensureAudioContext`) co-located in `KioskModeProvider.enterKiosk` handler.

**Reusable cho:** any feature pairing audio + fullscreen (kiosk modes, presentation modes, race-ops command center fullscreen-with-alert-sound). Future F-014 Athletes tab full-screen view can reuse this pattern if it adds sound feedback.

### 🚨 Multi-agent worktree rule (Manager rút bài học 2026-05-10)

**TUYỆT ĐỐI KHÔNG spawn 2 Coder paralel cùng 1 worktree.** Sự cố F-023 + F-026 ngày 2026-05-10:
- 2 Coder paralel cùng worktree → liên tục `git checkout` qua lại giữa 2 branch
- Coder A stash work → Coder B pop → conflict → một trong 2 work bị wipe
- Hậu quả: F-026 mất hoàn toàn 28 file + 47 test PASS, phải re-spawn Coder

**Quy tắc:**
1. **Sequential spawn:** 1 Coder xong + commit → mới spawn Coder kế tiếp. An toàn nhất.
2. **HOẶC dùng 2 worktree riêng:** `git worktree add ../worktree-feature-N <branch>` để Coder paralel chạy độc lập, KHÔNG đụng worktree chính.

---

## 🏢 Provider Entities — Thông tin pháp nhân (FEATURE-024 Contract Management)

> **Dùng trong:** Contract module, Quotation, Acceptance Report, Payment Request.
> Có đúng 2 provider entity. Khi tạo hợp đồng, admin chọn 1 trong 2 tuỳ loại hợp đồng.

### Provider A: 5BIB (dùng cho contract type: TICKET_SALES)

| Field | Value |
|-------|-------|
| **Tên công ty** | Công ty cổ phần 5BIB |
| **MST** | 0110398986 |
| **Địa chỉ** | Tầng 9, Tòa nhà Hồ Gươm Plaza (tòa văn phòng), Số 102 Phố Trần Phú, Phường Hà Đông, TP Hà Nội |
| **Người đại diện** | Nguyễn Bình Minh |
| **Chức vụ** | Giám đốc |
| **Tài khoản NH** | 110398986 |
| **Ngân hàng** | MB - Thụy Khuê |

### Provider B: 5Solution (dùng cho contract type: TIMING, RACEKIT, OPERATIONS)

| Field | Value |
|-------|-------|
| **Tên công ty** | Công ty cổ phần công nghệ 5Solution |
| **MST** | 0111213998 |
| **Địa chỉ** | Văn phòng 501, tầng 5, tòa nhà Dreamland Bonanza, số 23 Duy Tân, Phường Cầu Giấy, TP Hà Nội |
| **Người đại diện** | Nguyễn Bình Minh |
| **Chức vụ** | Tổng Giám Đốc |
| **Tài khoản NH** | 111213998 |
| **Ngân hàng** | MB - Hai Bà Trưng |

### Mapping logic (hardcoded trong code)

```typescript
// contracts/constants/provider-entities.ts
export const PROVIDER_ENTITIES = {
  '5BIB': {
    companyName: 'Công ty cổ phần 5BIB',
    taxCode: '0110398986',
    address: 'Tầng 9, Tòa nhà Hồ Gươm Plaza (tòa văn phòng), Số 102 Phố Trần Phú, Phường Hà Đông, TP Hà Nội',
    representative: 'Nguyễn Bình Minh',
    position: 'Giám đốc',
    bankAccount: '110398986',
    bankName: 'MB - Thụy Khuê',
  },
  '5SOLUTION': {
    companyName: 'Công ty cổ phần công nghệ 5Solution',
    taxCode: '0111213998',
    address: 'Văn phòng 501, tầng 5, tòa nhà Dreamland Bonanza, số 23 Duy Tân, Phường Cầu Giấy, TP Hà Nội',
    representative: 'Nguyễn Bình Minh',
    position: 'Tổng Giám Đốc',
    bankAccount: '111213998',
    bankName: 'MB - Hai Bà Trưng',
  },
} as const;

// Auto-select logic:
// contractType === 'TICKET_SALES' → providerId = '5BIB'
// contractType in ['TIMING', 'RACEKIT', 'OPERATIONS'] → providerId = '5SOLUTION'
```

> ⚠️ Nếu thông tin pháp nhân thay đổi (đổi GĐ, đổi địa chỉ, thêm entity mới) → CẬP NHẬT cả file này lẫn `provider-entities.ts` trong code.
3. QC + BA + Manager spawn paralel OK (chỉ đọc file + ghi `.5bib-workflow/`, KHÔNG modify code worktree).

**Anti-pattern:** Spawn N Coder cùng `Worktree code` field trong prompt — git state sẽ tự huỷ.

---

### 🚨 Push to main / prod rule (Danny chốt 2026-05-10 — TUYỆT ĐỐI tuân)

**Manager + Coder + bất kỳ agent nào KHÔNG được push lên `main` hoặc `release/v*` (prod) khi Danny chưa cho phép explicit.**

Quy trình bắt buộc:
1. Code trên branch riêng (vd: `5bib_<feature>_<version>` hoặc `feat/<slug>`)
2. Push lên branch riêng OK (CI dev branch không trigger prod)
3. Đợi Danny xác nhận "OK push lên main" hoặc "OK release prod" mới merge/cherry-pick
4. Visual spot-check / smoke test trên branch dev trước khi xin push

**Vi phạm = production incident risk + Manager ghi vào sổ vi phạm quy trình.**

Lý do: lần ship F-020 + F-022 ngày 2026-05-10, Danny phát hiện rủi ro việc tự động push prod sau QC mà chưa visual spot-check. Rule này ban hành sau đó để đảm bảo Danny luôn là người chốt cuối cùng cho prod deploy.

---

### Pre-push CI parity check (post-F-019 deploy 3-round fail)
Before pushing to `release/v*` (prod) hoặc `main` (dev auto-deploy), Manager/Coder MUST verify Docker build parity. Local `next build` / `nest build` PASS KHÔNG đủ — local có cached `node_modules` + dev pnpm version có thể khác CI.

**Mandatory pre-push checks:**
1. **Clean install gate** cho mỗi app touched:
   ```bash
   cd <app> && rm -rf node_modules && pnpm install --frozen-lockfile && pnpm build
   ```
2. **Docker build gate** (ideal): `docker build -t test <app>/` for each Docker-deployed app
3. **pnpm version pin** trong tất cả Dockerfiles: `npm install -g pnpm@10` (KHÔNG để latest — pnpm v11+ có thể reject lockfile v10 wrote)
4. **Lockfile sync gate**: `git diff origin/main -- '*/package.json' '*/pnpm-lock.yaml'` — nếu package.json đổi mà lockfile không thay đổi tương ứng → STOP, run `pnpm install` regen.
5. **TypeScript strict gate**: `npx tsc --noEmit` để catch type errors mà Next.js dev mode skip (vd: `aria-*` attribute type mismatch).

**Failure mode catch list (lessons from F-019 4-round deploy fail):**
- Missing deps in package.json: imports `from 'foo'` mà package.json không có → `nest build` chỉ catch nếu type checking strict + clean node_modules
- Dev caches: `next build` thành công với cached `.next/` nhưng fail với clean state → run `rm -rf .next` trước build verify
- pnpm version drift: lockfileVersion 9.0 sinh bởi pnpm v10 có thể fail strict validation pnpm v11
- **(Round 4 lesson)** `tsconfig.build.json` exclude pattern: bất kỳ folder `.ts` mới ở backend root (vd `scripts/`, `tools/`, `e2e-helpers/`) mà không thêm vào exclude → TypeScript include → flatten output break → `dist/main.js` thành `dist/src/main.js` → Docker CMD `node dist/main` MODULE_NOT_FOUND. **Bug latent — không trigger trong dev mode (admin/frontend dev không proxy backend qua docker), chỉ phát ra khi prod docker build + run**.

**Mandatory pre-push CHECK 6 (added post Round 4 incident 2026-05-09):**
6. **Backend entry point smoke test:** sau `nest build`, verify `dist/main.js` tồn tại (KHÔNG phải `dist/src/main.js`):
   ```bash
   cd backend && rm -rf dist && npm run build && ls dist/main.js
   ```
   Nếu output `ls: dist/main.js: No such file or directory` → STOP, check tsconfig.build.json exclude.

**Mandatory pre-push CHECK 7 (added post F-029 CI build-admin fail 2026-05-13):**
7. **Frontend production build verify (NOT just tsc):**
   ```bash
   cd admin && rm -rf .next && pnpm build  # MUST pass
   cd frontend && rm -rf .next && pnpm build
   ```
   **Tại sao:** `tsc --noEmit` chỉ check type errors. Next.js SWC compiler ALSO enforces Rules of Hooks (hook calls inside conditional/callback bodies), JSX context validity (JSX returned from `() => void` callback), React component import constraints. tsc passes ≠ Next.js build passes.

   **Incident root cause:** F-029 Phase B subagent v3 script (regex-based, NOT AST-aware) inserted `if (!isStaff) return <RestrictedAccess />` INSIDE useEffect/function callbacks in 4 team-management pages. Local `tsc --noEmit` PASS (all 5 verify layers: subagent + Coder + QC + Manager pre-flight). CI `deploy-production.yml` build-admin FAILED at `pnpm build` step → SSH deploy step skipped → PROD release/v1.8.0 deploy blocked ~30 phút. Fix commit `a638b28` moved gate to component top-level.

   Lesson: 5 layers of defense ALL bypassed bug because all relied on same insufficient `tsc` tool. Use diversity of verify methods (tsc + pnpm build + jest + eslint react-hooks).

   See `.5bib-workflow/features/FEATURE-029-hardening-phase-1/INCIDENT-2026-05-13-CI-BUILD-FAIL-RCA.md` for full root cause analysis + 5 lessons.

**Subagent delegation rule (added 2026-05-13 post F-029 incident):**
- Bulk codemod tasks (RBAC wrap, hook insertion, etc.) PHẢI dùng AST-based tools (`jscodeshift`, `ts-morph`) — NOT regex
- Subagent self-verify claim should NOT be trusted verbatim — main session MUST re-run independent verify (especially `pnpm build` for frontend)
- Subagent verify MUST include `pnpm build`, NOT just `npx tsc --noEmit`

**Mandatory pre-deploy CHECK (CD pipeline level, future):**
- Add Docker smoke step trong `.github/workflows/deploy-production.yml`:
  ```yaml
  - name: Backend smoke - verify entry point
    run: docker run --rm <image> sh -c 'ls /app/dist/main.js'
  ```
- Tương tự cho admin/frontend/crew/content-web (`/app/.next/standalone/server.js`).

### Multi-feature deploy entry (when 1 PR ships N features)
Khi 1 PR / branch / commit ship NHIỀU features cùng lúc (vd: `feat(race-ops): Cluster #8 + #9 features F-008v2 → F-015 (8 features bundled)`):

**Manager MUST:**
1. Tạo `05-manager-deploy.md` riêng cho TỪNG feature trong batch (không gộp)
2. HOẶC tạo file batch `.5bib-workflow/features/BATCH-cluster-N/00-batch-deploy.md` liệt kê đầy đủ các features được ship trong batch + reference tới từng feature folder
3. Update `feature-log.md` shipped table với entry cho TỪNG feature (không phải 1 entry batch)
4. Verify code thay đổi trong batch khớp với Scope Lock của TỪNG feature plan (chống scope creep ẩn)

**Anti-pattern:** Ship 8 features bundled trong 1 commit + chỉ tạo 1 deploy entry cho feature thứ 9 → memory drift, 8 feature kia ở state bất hợp pháp (code ship nhưng không có deploy entry → audit trail bị thủng).

### Strategic Scout cross-platform check (post-F-015 rollback)
Before proposing new features, Strategic Scout MUST research ALL 5Solution platforms:
- 5bib-result (this repo)
- ORG.5bib.com (organizer admin)
- 5sport.vn (sports content)
- 5pix (photo platform)
- 5tech (infrastructure)
Failure caused F-015 (Check-In Kiosk = duplicate of ORG.5bib.com pickup module) to ship + roll back same day, wasting 50 files of work.

---

## 🆕 Patterns được team confirm (FEATURE-029 — Hardening Phase 1 + Phase 1.1)

### 1. Dual-check permission helpers (`logto-auth/permissions.helper.ts`)

**Pattern:** Pure functions `isStaffOrHigher(user)` + `isAdminOrHigher(user)` + `hasUser(user)` mirror backend `LogtoStaffGuard` + `LogtoAdminGuard` permission hierarchy verbatim (roles[] ∪ scopes[] dual-check).

**Use case:** Service-level state branching when need response data conditional on permission tier WITHOUT enforcing guard rejection. Example: `getRaceResults` returns 404 nếu race draft + anon, returns 200 results nếu privileged.

```typescript
import { isStaffOrHigher } from '../../logto-auth/permissions.helper';

const isPrivileged = isStaffOrHigher(user);
if (!isPrivileged && race.status === 'draft') throw new NotFoundException('Không tìm thấy giải');
```

**Anti-pattern:** Inline check `user.role === 'admin'` (string match) — Logto user has `roles: string[]` array, multi-role possible. ALWAYS use helper.

### 2. Public service helper for cross-service controller composition

**Pattern:** When controller bypasses standard public service methods (composes multiple services e.g. result-image gen + badge service + result service parallel), the visibility/permission enforcement helper PHẢI public scope so controller can call enforce BEFORE invoking other services.

```typescript
class RaceResultService {
  // public — reusable from controller
  async enforceRaceVisibility(raceId: string, user?: LogtoUser): Promise<void> {
    const isPrivileged = isStaffOrHigher(user);
    const raceLookup = await this.racesService.getRaceById(raceId, isPrivileged);
    if (!raceLookup.success) throw new NotFoundException('Không tìm thấy giải');
  }
}

@Get('result-image/:raceId/:bib')
async previewResultImage(@Param('raceId') raceId, @CurrentUser() user?: LogtoUser) {
  await this.raceResultService.enforceRaceVisibility(raceId, user); // public call
  // ... compose badge + result + image services parallel
}
```

**When to use:** Helper involves cross-resource state check + reused by ≥2 entry points.

**Anti-pattern:** Duplicate `racesService.getRaceById + permission check` inline at controller — DRY violation, drift risk.

### 3. RBAC page-level gate (3-layer defense-in-depth)

**Pattern:** Admin pages có 3 layers RBAC defense:
1. **Sidebar nav hide** (UX — F-024 `nav-groups.ts` `requireRole`)
2. **Backend guard** (security — `@UseGuards(LogtoStaffGuard | LogtoAdminGuard)` controller)
3. **Page-level gate** (defense-in-depth + UX — Client Component `useAuth().isStaff/isAdmin` + conditional `<RestrictedAccess />`)

**Tier matrix (F-029 RBAC Matrix):**
- Tier 1 `isStaff` — daily-ops modules (contracts, reconciliations, awards, medical, team-management)
- Tier 2 `isAdmin` — business/finance/security sensitive (sponsors, sponsored, bug-reports, api-keys, analytics, finance/P&L)

```typescript
"use client"; // required vì useAuth() là client hook
import { useAuth } from "@/lib/auth-context";
import { RestrictedAccess } from "@/components/admin-shell/restricted-access";

export default function ContractsPage() {
  const { isStaff } = useAuth();
  if (!isStaff) return <RestrictedAccess />;
  return <ContractsContent />;
}
```

**Anti-pattern:**
- Server Component wrap (no — `useAuth()` client hook → hydration mismatch)
- Skip page-level gate, rely on backend only (blank screen sau API 403, defense-in-depth gap)

**Choosing tier:** Match backend guard. `LogtoStaffGuard` → Tier 1. `LogtoAdminGuard` → Tier 2.

### 4. F-029 Phase 1.1 lesson — BFS attack surface enumeration

**Pattern:** When ULTRAREVIEW finding lists 1 endpoint vulnerable (e.g. HIGH-RR-01 `?raceId=` list), Manager init MUST BFS enumerate ALL related attack surfaces với same param (raceId/courseId path/query) before locking PRD scope. Avoid Phase 1.1 extension bounce loop.

**Example failure mode (F-029 v1):** Plan BR-HD-01 locked to `getRaceResults` only → Phase 1 fix incomplete → QC v1 found 13 sibling endpoint leak → forced Phase 1.1 extension.

**Detection grep template for /5bib-init Manager:**
```bash
grep -rn "@Get\|@Post\|@Put" backend/src/modules/<target>/ | grep -i "raceId\|courseId"
```

For F-029-class hardening features, Manager init Impact Map MUST list ENTIRE controller route file scan output, not just ULTRAREVIEW-cited path.

---

## FEATURE-027 — Promo Hub patterns (8 NEW, added 2026-05-13)

### 1. Anti-stampede SETNX lock (port pattern from F-004 RaceMasterDataService)

```typescript
async findBySlugPublic(slug: string): Promise<PromoHubResponseDto> {
  const cacheKey = `${CACHE_PREFIX}${slug}`;
  const cached = await this.cacheGet(cacheKey);
  if (cached) return cached;

  const lockKey = `${LOCK_PREFIX}${slug}`;
  const gotLock = await this.acquireLock(lockKey);  // Redis SET key 1 EX 5 NX
  if (!gotLock) {
    for (let i = 0; i < LOCK_RETRY_MAX; i++) {
      await this.sleep(200);
      const retryHit = await this.cacheGet(cacheKey);
      if (retryHit) return retryHit;
    }
    return this.queryAndShape(slug);  // fallback DB direct, NO cache write
  }
  try {
    const result = await this.queryAndShape(slug);
    await this.cacheSet(cacheKey, result, 60);
    return result;
  } finally {
    await this.redis.del(lockKey);
  }
}
```

**Use case:** Public endpoint with traffic spike + cold cache start. Prevents 100 concurrent requests each hitting DB.

**Re-usable for:** any public read-mostly endpoint with TTL cache.

### 2. Section-as-subdoc array (vs separate collection)

```typescript
@Schema({ collection: 'promo_hubs' })
export class PromoHub {
  @Prop({ type: [SectionSchema], default: [] })
  sections!: Section[];   // ← subdoc array
}
```

**Trade-offs:** atomic save toàn doc + no JOIN/$lookup, but 16MB MongoDB doc limit (acceptable cho ~30 sections × 5KB = 150KB).

**Anti-pattern:** Don't use subdoc array for write-heavy domain (audit log, event stream) — use separate collection.

### 3. DOM event delegation tracker (Client+Server hybrid for analytics)

```typescript
'use client';
useEffect(() => {
  fetch('/api/promo-hub-analytics/track-view', { method: 'POST', body, keepalive: true });

  const onClick = (e: MouseEvent) => {
    const target = (e.target as Element)?.closest('[data-promo-cta]');
    if (!target) return;
    fetch('/api/promo-hub-analytics/track-click', {
      method: 'POST',
      body: JSON.stringify({ hubId, sectionId: target.getAttribute('data-promo-section-id'), ... }),
      keepalive: true,  // ← survives navigation
    });
  };
  document.addEventListener('click', onClick, { capture: true });
  return () => document.removeEventListener('click', onClick, { capture: true });
}, [hubId]);
```

**Why:** Sections render Server Components (no React event handlers). Document-level listener delegates via data attributes.

**Re-usable for:** any feature mixing Server-rendered content + Client-only analytics tracking.

### 4. HOST whitelist iframe defense

```typescript
const ALLOWED_HOSTS = ['google.com', 'maps.google.com', 'www.openstreetmap.org'];

function isSafeEmbedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ALLOWED_HOSTS.includes(u.host) && u.protocol === 'https:';
  } catch { return false; }
}

if (!c.embedUrl || !isSafeEmbedUrl(c.embedUrl)) {
  return c.address ? <AddressFallback>{c.address}</AddressFallback> : null;
}
return <iframe src={c.embedUrl} loading="lazy" />;
```

**Pattern:** Whitelist hosts + HTTPS-only + graceful fallback (text/link mode, NOT hard error). Defense-in-depth alongside backend sanitize-html.

**Re-usable for:** any admin-editable embed URL (Maps, Forms, Video, Social embeds).

### 5. Inline SVG brand icons (when icon library has gap)

For Vietnamese platforms (Zalo) + brand-correct icons (TikTok, modern Twitter-X) khi `lucide-react` v1.7 thiếu:

```typescript
const PLATFORM_META = {
  zalo: { label: 'Zalo', bg: 'bg-[#0068FF]',
    svg: (<svg viewBox="0 0 24 24" fill="currentColor" className="size-6"><path d="..." /></svg>) },
  // ...
};
```

**Pattern:** Inline SVG + `viewBox` 24×24 + `currentColor` + brand-color Tailwind classes. ZERO new deps. Source from simple-icons.org (MIT licensed) or official brand kits.

**Anti-pattern:** Don't add 3-5 icon libraries just to fill gaps — inline 5-10 common platform SVGs instead.

### 6. Cross-app cache invalidation via server-side proxy + Bearer token

```typescript
// admin Next.js — server route attaches token (NEVER sent to browser)
export async function POST(req: NextRequest) {
  if (!REVALIDATE_TOKEN) return NextResponse.json({ ok: true, skipped: 'no-token' });
  await fetch(FRONTEND_REVALIDATE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REVALIDATE_TOKEN}` },
    body: JSON.stringify({ slug }),
  });
}

// frontend Next.js — verify token + revalidate
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!REVALIDATE_TOKEN || token !== REVALIDATE_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  revalidateTag(`promo-hub:${slug}`, 'default');
}
```

**Pattern:** Admin server-side proxy + Frontend verify. Fail-closed if env unset (admin gracefully skips → ISR 60s fallback, frontend 401).

**Re-usable for:** any cross-app coordination requiring shared secret.

### 7. Next.js 16 `revalidateTag(tag, profile)` 2-arg signature

```typescript
// ❌ Next.js 14/15 (deprecated in Next 16)
revalidateTag('promo-hub:my-slug');

// ✅ Next.js 16 (2-arg required)
revalidateTag('promo-hub:my-slug', 'default');
```

**Detection:** TypeScript errors `Expected 2 arguments, but got 1.` on Next 16 build.

### 8. Switch-over-registry for type-dispatching components

```typescript
// ✅ Pragmatic for N ≤ 25
switch (section.type) {
  case 'hero': return <HeroSection section={section} />;
  // ... 19 cases
  default: return null;  // forward-compat
}
```

**When to refactor to plugin registry:** types >25 OR content team adds custom types dynamically OR dynamic import needed for code-splitting.

**Anti-pattern:** Don't over-engineer with plugin registry for small N. Switch is more readable + grep-able.

---

## Manager workflow lesson — Competitor cross-check for NEW_MODULE (F-027 post-mortem)

**Failure mode:** F-027 PRD chốt 9 section types without checking real-world Linktree/addme.vn parity → Phase B addendum 10 sections post-QC.

**Manager process fix (BR-MAN-F027-LESSON, applies to ALL future NEW_MODULE):**

For `NEW_MODULE` features competing with EXISTING market products (landing builders, ticket platforms, race platforms, payment gateways), `/5bib-init` MUST require BA list:

1. **2-3 real-world competitor URLs** (must be reachable + accessible)
2. **Section/feature parity matrix:** column "Competitor X has Y" vs column "We propose Z"
3. **Decision rationale per gap:** "DROP because..." OR "INCLUDE in Phase 1" OR "DEFER Phase 2"

Failure to provide competitor analysis = `/5bib-plan` REJECT verdict, BA must extend PRD.

**Detection signal during `/5bib-init`:**
- Feature description contains: "thay thế [X]", "kill [X]", "tương đương [X]", "như [X]", "alternative to [X]"
- Type = `NEW_MODULE` (not BUGFIX/REFACTOR/EXTEND_EXISTING)
- Phrase "landing page", "promo", "marketing", "CMS", "builder" in title/scope

If any signal → REQUIRE competitor URL in `00-manager-init.md`.

**Re-usable for:** any future NEW_MODULE with market precedent.

---

## Manager workflow lesson — Confirm SEO target domain at /5bib-init (F-027 PROD deploy post-mortem)

**Failure mode:** Manager assumed Promo Hub deploy domain = `5bib.com/hub/*` based on PRD wording. Implementation deployed to `result.5bib.com/hub/*` (5bib-result-frontend VPS). Post-deploy Danny pointed out: `5bib.com` (apex) is 5Ticket Vercel app (separate codebase), KHÔNG phải 5bib-result frontend → hub không serve trên 5bib.com → SEO juice mất.

**Result:** Need follow-up PR vào 5Ticket repo to add Vercel rewrite `/hub/* → result.5bib.com/hub/*`. Documented in `docs/INTEGRATION-5ticket-promo-hub-rewrite.md`.

**Manager process fix (BR-MAN-F027-SEO):**

For features with SEO requirements, `/5bib-init` MUST explicitly capture:

1. **Target domain for indexing:** `5bib.com` apex, OR `result.5bib.com`, OR `news.5bib.com`, etc.
2. **Which app deploys that domain:** 5bib-result repo? 5Ticket Vercel repo? Content-web? Other?
3. **Cross-repo coordination needed?** If target domain ≠ this repo's deploy domain → flag as cross-team coordination item in `00-manager-init.md` "PAUSE conditions"

**Detection signal:**
- Feature description: "SEO", "Google index", "marketing landing", "promotional URL"
- Target user: end-user (consumer-facing), not internal admin

If signal → REQUIRE answer to domain/repo question in `00-manager-init.md` BEFORE BA writes PRD.

**Known domain map (as of 2026-05-13):**
| Domain | Deploys from | Stack |
|---|---|---|
| `5bib.com` (apex) | **5Ticket repo, Vercel** | Next.js (external repo) |
| `result.5bib.com` | `5bib-result/frontend/` | Next.js 16 on VPS |
| `admin.5bib.com` | `5bib-result/admin/` | Next.js 16 on VPS |
| `result-api.5bib.com` | `5bib-result/backend/` | NestJS 10 on VPS |
| `news.5bib.com`, `hotro.5bib.com` | `5bib-result/content-web/` | Next.js on VPS |
| `crew.5bib.com` | `5bib-result/crew/` | Next.js on VPS |
| `5ticket.vn`, `org.5ticket.vn` | 5Ticket repo, Vercel | Next.js (external) |
| `5sport.vn` family | 5Sport repo (separate) | TBD |

When future feature requires SEO on `5bib.com` apex → CROSS-TEAM coordination with 5Ticket needed.
