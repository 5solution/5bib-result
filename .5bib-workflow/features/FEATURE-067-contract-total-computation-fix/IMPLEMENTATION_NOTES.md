# F-067 — Implementation Notes (Danny 2026-05-19 mandate)

## 1. Quyết định kỹ thuật quan trọng

### 1.1 `beforeSnapshot` shallow copy thay vì full `current.toObject()`
Lúc đầu định clone `current.toObject()` ngay sau `findOne()` để có before-state cho diff. Nhưng `toObject()` trên Mongoose document có thể trigger virtuals + transform side-effects (nhất là khi `lineItems` là subschema Map). Chuyển sang **shallow snapshot CHỈ 5 fields** (`lineItems`, `totalAmount`, `vatRate`, `signDate`, `status`) là đủ cho diff payload + tránh hidden cost. Mỗi line item snapshot là literal object — KHÔNG share reference với Mongoose doc → sau `Object.assign(current, ...)` mutate `current.lineItems`, `beforeSnapshot.lineItems` vẫn intact.

### 1.2 Fire-and-forget pattern — `void this.regenerate(...)` không `await`
Manager PAUSE-67-CODER-03 chốt Phase 1 acceptable. Cụ thể implementation:
- `void this.regenerateContractDocxAsync(String(current._id))` — không await
- Bên trong `regenerateContractDocxAsync` có try/catch toàn body → never throws lên caller
- Errors → `Logger.warn` + secondary `emitAudit('contract.docRegenFail')` đảm bảo UI history tab vẫn surface được failure

Vấn đề tiềm năng: nếu admin save mutation rồi đóng browser ngay → fire-and-forget vẫn chạy backend (NestJS lifecycle giữ promise). Acceptable Phase 1. Phase 2 BullMQ candidate khi spike concurrent regen có thật.

### 1.3 `actorId = 'system:auto-regen'` thay vì `'admin'` cho auto-regen
Trong audit timeline UI, phân biệt:
- `contract.update.force` actor=`admin` → human edit
- `contract.generateDocument` actor=`system:auto-regen` → fired bởi F-067 hook
- `contract.generateDocument` actor=`admin` → manual "Tạo lại tài liệu" button click

UI tự render `e.actor.displayName ?? e.actor.userId` → admin nhìn vào timeline biết ngay event nào là tự động vs manual.

### 1.4 Diff line items match theo `stt` (KHÔNG match theo description / position)
`stt` là stable identifier xuyên qua reorder + rename. Nếu admin đổi description của line item stt=4 từ "Áo XL" → "Áo XL Premium", diff sẽ ghi `modified[].before.description='Áo XL', after.description='Áo XL Premium'`, KHÔNG ghi nhầm thành `removed + added`. Match by index sẽ bị false-positive khi admin chèn 1 line ở giữa.

### 1.5 `DIFF_LINE_ITEM_CAP = 100` exported constant
Manager APPROVE perf protection (PAUSE-67-CODER-02). Export constant để QC test có thể import + assert. KHÔNG hardcode magic number 100 ở 2 nơi (diffLineItems + spec). Nếu Phase 2 cần raise cap (vd 200), chỉ sửa 1 dòng.

### 1.6 Constructor `@Optional()` cho new params
ContractsService có 16+ existing jest specs gọi constructor theo positional pattern (no DI container). Thêm 2 required params sẽ break tất cả. Pattern: thêm `@Optional()` + nullable types — production `ContractsModule` wires đầy đủ, jest specs pass `undefined` cho 2 slot mới.

### 1.7 `getHistory()` defense-in-depth limit clamp
DTO `@Max(200)` đã reject 400 ở controller layer. Nhưng service method có default `limit = 50` được caller có thể bypass (vd internal call). Vì vậy thêm server-side `Math.min(Math.max(1, ...), 200)` clamp + `Math.floor` cho NaN safety.

## 2. Vấn đề gặp phải + cách giải quyết

### 2.1 Multi-Claude session conflict — git checkout race
**Vấn đề:** Trong session implement F-067 này, phát hiện có **3 Claude sessions parallel** đang chạy trên cùng repo. Một session khác đang implement F-064 và liên tục `git checkout` qua lại giữa F-064 và F-067 branches → mỗi lần tôi `Edit` xong file thì 1-2 giây sau workdir bị reset về branch khác → edit mất.

**Reflog evidence:**
```
6c47adc HEAD@{0}: checkout: moving from feat/F-067-stale-docx-auto-regen to feat/F-064-docx-phase-4-hardcoded-cleanup
6c47adc HEAD@{2}: checkout: moving from feat/F-064 to feat/F-067
6c47adc HEAD@{4}: checkout: moving from feat/F-067 to feat/F-064
```

**Cách giải quyết:** Tạo dedicated worktree `/tmp/5bib-f067` từ F-067 branch. Worktree khác KHÔNG bị parallel sessions checkout race. Symlink `node_modules` + `.env` từ main repo để chạy jest tests. All 13 tests PASS + 272 contracts regression PASS.

### 2.2 Test fixture inconsistency (TC-67-01 totalAmount.delta)
**Vấn đề:** First run TC-67-01 fail với expected `297_000` got `-218_205_900`. Root cause: fixture contract có `subtotal: 213_042_500` + `totalAmount: 230_085_900` (real VCB KID RUN 2026 numbers từ Danny audit) nhưng line items chỉ có 2 entries totaling 10_725_000.

**Cách giải quyết:** Đổi fixture cho subtotal/total **match đúng** với 2 line items: 1*100*5500 + 1850*5500 = 10_725_000 → vat 8% = 858_000 → total = 11_583_000. After edit (qty 1850→1900): subtotal 11_000_000 → total 11_880_000 → delta = +297_000 ✅. Đúng 297K khớp business expectation.

### 2.3 `mockModel.findOne` call count brittle
TC-67-01 ban đầu `expect(mockModel.findOne).toHaveBeenCalledTimes(2)` (1 update + 1 regen). Thực tế gọi 3 lần (update + regen lookup + generateDocument internal lookup). Sửa: assertion shift về `renderAndUpload` đã được gọi → bằng chứng pipeline regen đã chạy. Robust hơn cho refactor future.

## 3. Code quality observations

### 3.1 Pattern reuse từ F-023/F-024 + F-018 medical
- Audit emit: copy y nguyên pattern `actor.userId / action / entity.{type,id,displayName} / metadata` từ F-023 — ZERO net new audit infrastructure
- generateDocument version increment: reuse existing F-024 logic (`existingPrimary.length + 1`) — KHÔNG duplicate
- Best-effort fail handling: emit warns không throw → mirror F-023 AuditLogService.emit + F-018 medical-incident-lock fallback

### 3.2 Display Convention compliance
Tất cả enum render qua dictionary. 16 audit actions có VN label. Stale badge text từ `REGEN_STATUS_LABEL`. Date format `formatVnDateTime` consistent `HH:mm DD/MM/YYYY`.

### 3.3 No XSS surface (JSON.stringify in HistoryTab)
`<pre>{JSON.stringify(e.metadata, null, 2)}</pre>` — React escape default, không có `dangerouslySetInnerHTML`. Metadata payload chỉ chứa scalars + arrays + plain objects từ trusted backend → no injection.

## 4. Open items / future work

### 4.1 Real Logto userId attribution (TD-CONTRACTS-ACTOR-001)
PAUSE-67-CODER-01 carry-forward. Khi F-068 (hoặc parallel feature) implement `@CurrentUser()` decorator hoặc lấy `req.user.sub` từ Logto JWT → swap `'admin'` literal toàn bộ contracts.service.ts.

### 4.2 Phase 2 BullMQ regen queue
PAUSE-67-CODER-03 noted. Khi Sales report duplicate version noise (2 mutations parallel → 2 versions gần nhau), implement Redis SETNX lock `contract-regen-lock:<contractId>` TTL 30s + BullMQ queue cho fairness. Phase 1 fire-and-forget acceptable cho expected load (1-2 edit/min/contract).

### 4.3 Diff truncation — full snapshot fallback
TC-67-08 verifies 150 items → modified.slice(100) + `truncated: true`. UI history tab hiện chỉ render JSON stringified. Nếu admin cần audit full delta khi bị truncated, Phase 2 thêm `GET /history/:entryId/full` endpoint trả về full diff (bypass cap) — chỉ render khi entry có `metadata.diff.lineItems.truncated`.

### 4.4 Diff visualization rich (Phase 2)
Hiện UI render `<pre>{JSON.stringify(...)}</pre>`. Sales team cuối tháng audit có thể muốn rich diff table (red/green cell coloring kiểu git diff). Phase 2 candidate: parse `diff.lineItems.modified[]` → render `<Table>` với "Cũ → Mới" 2 cột.

### 4.5 Backward-compat data integrity check (Phase 2)
Contracts pre-F-067 đã có `generatedDocuments[]` nhưng `audit_logs` thiếu `metadata.diff`. UI render placeholder "Không có chi tiết delta" OK. Nhưng nếu Sales audit cuối quý cần fix retroactive cho 1 hợp đồng cụ thể, admin click "Sửa" → save mutation mới generates first proper diff. Document trong runbook.
