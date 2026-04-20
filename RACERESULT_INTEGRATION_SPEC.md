# 5BIB × RaceResult — Integration Data Contract

**Phiên bản:** 1.0 · **Ngày phát hành:** 2026-04-20 · **Trạng thái:** DRAFT — cần team setup race đọc & ký xác nhận trước mỗi event

> Tài liệu này là **nguồn chân lý duy nhất** cho việc cấu hình và xuất data từ RaceResult (timing vendor) sang hệ thống 5BIB. Mọi sai lệch so với spec này **phải được fix ở cấu hình RaceResult**, không phải patch ở code 5BIB.
>
> **Lý do tồn tại:** trong 2 năm qua, nhiều race được set lên RaceResult không đúng chuẩn (chamlon, prenn, cao-bang, …) → data sync về 5BIB bị sai phân loại finisher/DNF, country thiếu/sai, stats card 0% — trông xấu hổ trước runner. Spec này đóng cửa các lỗ đó ở gốc.

---

## 1. Đối tượng & cách dùng

| Vai trò | Trách nhiệm |
|---|---|
| **Timing Operator** (người set RaceResult) | Tuân thủ 100% spec này trước khi mở event |
| **Race Setup Lead** (5BIB) | QC lại Timing Operator đã làm đúng; ký `Pre-Publish Checklist` |
| **Engineer 5BIB** | KHÔNG patch code để đỡ cho data sai; thay vào đó push-back lên Timing Operator |
| **QA 5BIB** | Chạy `Post-Sync Validation` mỗi khi có race mới + kiểm tra spec compliance |

**Cách dùng tài liệu:**
1. Timing Operator đọc §2–§7 trước khi cấu hình race trên RaceResult
2. Race Setup Lead chạy `§9 Pre-Publish Checklist` trước giờ go-live
3. Engineer/QA chạy `§10 Post-Sync Validation` sau khi data sync về

---

## 2. Luồng data tổng quan

```
┌─────────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐
│ RaceResult API  │──▶│ 5BIB Sync    │──▶│ MongoDB      │──▶│ Public FE │
│ (timing vendor) │   │ Cron (10p/1) │   │ race_results │   │           │
└─────────────────┘   └──────────────┘   └──────────────┘   └──────────┘
       ▲                    │                                     ▲
       │                    ▼                                     │
   CONFIG đúng         VALIDATION                              Runner thấy
   TẠI ĐÂY             (§10)                                   đúng 100%
```

Source of truth là **RaceResult config**. Sync chỉ map field 1-to-1 + classify vào bucket — không "đoán" data thiếu.

---

## 3. Field Contract — mỗi athlete record

Mỗi kết quả athlete RaceResult trả về PHẢI có đủ các field sau. Field nào thiếu → data tại 5BIB sẽ hỏng theo cách mô tả ở cột cuối.

### 3.1 Required fields

| RaceResult field | Kiểu | Required? | Quy tắc | Hậu quả nếu sai |
|---|---|---|---|---|
| `Bib` | integer / string | ✅ MUST | Duy nhất trong một course; không được = 0 | Fallback lấy từ Certificate URL hoặc index → bib "giả" |
| `Name` | string | ✅ MUST | Họ tên đầy đủ, tiếng Việt có dấu | Runner tìm không ra mình |
| `TimingPoint` | enum (xem §4) | ✅ MUST | Phải thuộc enum cố định trong §4 | **Bucket classify SAI** → toàn bộ ranking page 0 finisher / 0% |
| `OverallRank` | string | ✅ MUST | Số nguyên (`"1"`, `"42"`) HOẶC status literal (`"DNF"`, `"DNS"`, `"DSQ"`, `"DSQ-F"`, `"OOC"`) | Rank/percentile sai, chart progression nhảy lung tung |
| `GenderRank` | string | Nên | Số nguyên hoặc status | Gender leaderboard thiếu |
| `CatRank` | string | Nên | Số nguyên hoặc status | Category tab trống |
| `ChipTime` | `HH:MM:SS` hoặc `H:MM:SS` | ✅ MUST cho finisher | `00:48:54` OK; `48:54` KHÔNG OK với ultras | Sort theo thời gian sai, avgTime/fastestTime lệch |
| `GunTime` | `HH:MM:SS` | Optional | Format giống ChipTime | — |
| `Pace` | `M:SS` hoặc `M:SS/km` | Nên | Per-km | Pace card trống |
| `Gender` | enum `"M"` \| `"F"` | ✅ MUST | Chỉ 2 giá trị này, không được `"Nam"`/`"Nữ"`/`"Male"`/`"Female"` | Gender stats 0/0 |
| `Category` | string | Nên | VD: `"M30-39"`, `"F40-49"`. Không được rỗng nếu race có category | Category filter chết |
| `Nationality` | string | ✅ MUST | Xem §6 — TUYỆT ĐỐI không được `"0"`, `"250"`, số, `"null"` | Country ranking table leak "0" hoặc "250" |
| `Nation` | string | Optional | Alias cũ; giữ lại nếu upstream có | — |
| `Started` | integer | Nên | Tổng số xuất phát của course (không phải từng athlete) | Stats card "Started" sai |
| `Finished` | integer | Nên | Tổng số hoàn thành course | Trùng khớp với derived bucket |
| `DNF` | integer | Nên | Tổng số DNF course | Trùng khớp với derived bucket |

### 3.2 Optional nhưng khuyến nghị

| Field | Dùng để làm gì |
|---|---|
| `OverallRanks` (JSON string) | Rank snapshot tại mỗi checkpoint — dùng cho `RankProgressionChart` |
| `Chiptimes` (JSON string) | Split time tại mỗi checkpoint |
| `Paces` (JSON string) | Pace per segment |
| `TODs` | Time of day per checkpoint |
| `Sectors` | Sector splits |
| `Certi` / `Certificate` | URL ảnh certificate từ RaceResult |
| `Gap` | Khoảng cách thời gian với rank 1 |

**Quan trọng về JSON-stringified fields:** 5BIB parse chúng ở FE dưới dạng `JSON.parse(str)`. Key trong object phải match `key` của checkpoint config trong Course admin (Start / TM1 / TM2 / Finish / …). Nếu RaceResult trả key khác → FE sẽ không match được và không hiện split.

---

## 4. TimingPoint — enum cố định (điểm then chốt)

**Đây là field gây lỗi nhiều nhất trong 2 năm qua.** Phân loại finisher/DNF/DSQ/DNS của cả course phụ thuộc 100% vào field này.

### 4.1 Enum chuẩn — CHỈ được dùng các giá trị sau

| Giá trị | Ý nghĩa | Runner đó sẽ được xếp vào |
|---|---|---|
| `"Finish"` | Athlete đã về đích hợp lệ | **finisher** ✅ |
| `"DNF"` | Did Not Finish — bỏ cuộc giữa chừng | **dnf** |
| `"DNS"` | Did Not Start — không xuất phát | **dns** |
| `"DSQ"` | Disqualified | **dsq** |
| `"OOC"` | Out Of Cut — quá COT (cut-off time) | **dnf** (treat as DNF nếu không có category riêng) |
| Tên checkpoint chưa về đích (VD `"TM2"`, `"CP3"`) | Athlete đang ở checkpoint đó, chưa về đích | **dnf** (khi race đã kết thúc) |

### 4.2 ❌ KHÔNG BAO GIỜ được dùng cho finisher

Các giá trị sau đây đã gây bug production — **cấm dùng** để đánh dấu athlete hoàn thành:

- `"Lap 2"`, `"Lap 12"`, `"Lap 20"` — backyard/multi-lap format
- `"5KM"`, `"10KM"`, `"Cat Tien 10K"` — tên distance
- `"End"`, `"Complete"`, `"Completed"`, `"Done"` — từ đồng nghĩa của Finish
- `""` (empty string)
- `null`
- Số nguyên thuần (`12`, `48`)

**Quy tắc vàng:** nếu athlete đã về đích hợp lệ → `TimingPoint = "Finish"` (exact string, case-sensitive). Không có trường hợp ngoại lệ.

### 4.3 Race format đặc biệt

#### Backyard race (chạy lặp lại đến khi bỏ cuộc, VD Chamlon)

Trong backyard, **không có "finish line" cố định** — runner chạy bao nhiêu vòng được thì về. Convention:

- `TimingPoint = "Finish"` cho **tất cả** athlete đã nghỉ trong thời gian cho phép (dù chạy 1 lap hay 20 lap). Coi như họ đã "finish" với số vòng đó.
- Số vòng lưu trong `Category` (VD `"12 laps"`) hoặc `Sectors` — KHÔNG được để ở TimingPoint.
- Winner = athlete có ChipTime dài nhất (chạy được nhiều vòng nhất).

❌ Cách SAI (đã thấy ở Chamlon 474): `TimingPoint = "Lap 12"` cho mọi athlete → tất cả bị classify DNF → ranking page hiện "0 Finished / 48 DNF".

✅ Cách ĐÚNG: `TimingPoint = "Finish"` cho tất cả, `Category = "12 laps"`.

#### Multi-lap / course có nhiều vòng (VD 3 laps × 10K)

- Checkpoint intra-lap: đặt tên có số vòng — `"L1-CP1"`, `"L2-CP1"`, `"L3-CP1"`, `"Finish"` (lap cuối).
- Runner về đích hợp lệ: `TimingPoint = "Finish"`.
- Runner dừng giữa chừng: `TimingPoint = "L2-CP1"` (checkpoint cuối cùng anh ta pass) → classify DNF.

#### Relay / Team race

- **Mỗi member** là 1 record riêng, bib có suffix (VD `"T001-A"`, `"T001-B"`, `"T001-C"`).
- Hoặc: 1 record duy nhất cho team, field `Member` chứa JSON mapping `{"lap1": "Nguyễn A", "lap2": "Trần B"}`.
- `TimingPoint = "Finish"` cho team hoàn thành.

#### Time-limited race (VD "24H ULTRA" — chạy trong 24h)

- Coi như backyard: mọi athlete vượt qua thời điểm cut-off đều là finisher (dù chạy được ít).
- `TimingPoint = "Finish"`, distance thực tế lưu ở `Sectors` hoặc `Category`.

---

## 5. Course-level counters

### 5.1 Ý nghĩa

| Field | Định nghĩa | Cần gửi mỗi record |
|---|---|---|
| `Started` | Tổng số athlete xuất phát của course | ✅ Yes, giá trị GIỐNG NHAU cho mọi athlete trong cùng course |
| `Finished` | Tổng số finisher của course | ✅ Yes |
| `DNF` | Tổng số DNF của course | ✅ Yes |

5BIB lấy 3 field này từ record ĐẦU TIÊN của course (`firstDoc.started/finished/dnf`). Nếu upstream không gửi → 5BIB **tự derive** từ bucket classifier (§4).

### 5.2 Invariant BẮT BUỘC

```
Started = Finished + DNF + DSQ + OOC
     (DNS không tính — athlete chưa bao giờ xuất phát)
```

### 5.3 Cập nhật khi data thay đổi

Nếu race đang `live` và counter phải cập nhật (có người DNF thêm, có người DSQ):
- Upstream PHẢI cập nhật `Started/Finished/DNF` trên TẤT CẢ records của course đó, không chỉ trên record mới đổi status.
- Nếu upstream chỉ update record mới → 5BIB sẽ lấy `firstDoc` cũ → stale count (case ha-giang).

### 5.4 Race đã kết thúc

Trước khi set race `status = 'ended'`, chạy `§10 validation` để confirm `Started = Finished + DNF + DSQ` cho mọi course.

---

## 6. Nationality — chuẩn hóa

### 6.1 Format

Chỉ dùng **một** trong 2 format, thống nhất toàn bộ event:

**Option A — Full English name (ưu tiên):**
```
"Vietnam", "United States", "Malaysia", "Philippines", "France"
```

**Option B — ISO 3166-1 alpha-2:**
```
"VN", "US", "MY", "PH", "FR"
```

### 6.2 ❌ CẤM

- `"0"`, `"250"`, `"1"`, `"99"`, bất kỳ số nào (đã gây leak "country 0" ở Brah Yang)
- `"null"`, `"undefined"`, `"N/A"`, `"-"`, `""`
- Đồng thời `"Vietnamese"` và `"Vietnam"` trong cùng event (duplicate row trong Country Ranking)
- `"Việt Nam"` với unicode — dùng `"Vietnam"` ASCII
- Lowercase `"vietnam"` + title case `"Vietnam"` cùng lúc

### 6.3 Mapping chuẩn cho runner Việt

| Input có thể gặp | Convert sang |
|---|---|
| `"Vietnamese"`, `"Việt Nam"`, `"VIETNAM"`, `"VN"` | `"Vietnam"` |
| `""`, `null`, `"0"`, `"-"` | **Phải điền thủ công** — hỏi runner hoặc default `"Vietnam"` nếu event nội địa |

### 6.4 Runner không có nationality

Nếu không có thông tin:
- Event có pre-registration → bắt buộc hỏi trên form đăng ký
- Event walk-in → default `"Vietnam"` (nếu event nội địa) hoặc rỗng `""` (sẽ bị FE filter ra, không hiện ở Country Ranking — OK)

---

## 7. Rank fields — OverallRank vs OverallRanks

### 7.1 OverallRank (singular, authoritative)

- Là **rank cuối cùng chính thức** của athlete, sort theo ChipTime.
- Value: số nguyên dương (`"1"`, `"42"`) HOẶC status literal (`"DNF"`, `"DNS"`, `"DSQ"`).
- Là field hero card trên trang 5BIB — **phải chính xác**.

### 7.2 OverallRanks (plural, snapshot)

- JSON string: `{"Start":"1","TM1":"5","Finish":"3"}`
- Là **snapshot rank** tại từng checkpoint — dùng cho RankProgressionChart.
- `OverallRanks["Finish"]` = rank tại thời điểm **cắt vạch đích** (crossing-line timing).
- **Có thể khác** `OverallRank` khi race có wave-start: runner cắt vạch thứ 3 nhưng ChipTime nhanh nhất → `OverallRank="1"`, `OverallRanks["Finish"]="3"`.

### 7.3 Quy tắc cho Timing Operator

- Luôn gửi cả hai: `OverallRank` (authoritative) + `OverallRanks` (snapshot với key `"Finish"`)
- Nếu race không có wave-start → 2 giá trị sẽ bằng nhau, không vấn đề.
- Nếu race CÓ wave-start → 2 giá trị có thể lệch. 5BIB FE đã handle: `RankProgressionChart` override final dot bằng `OverallRank` (authoritative), không dùng snapshot.

### 7.4 ❌ KHÔNG ĐƯỢC làm

- Gửi `OverallRank = "3"` nhưng `OverallRanks["Finish"] = "1"` rồi đổi ý (inconsistent state)
- Gửi `OverallRank = null` cho finisher
- Để `OverallRank = "DNF"` nhưng `TimingPoint = "Finish"` (mâu thuẫn nội bộ)

---

## 8. Course / Checkpoint / Distance naming

### 8.1 Course name

- Dùng format chuẩn: `"42K"`, `"70KM"`, `"100KM"`, `"5K"` (không trailing space, không comma decimal).
- ❌ `"6,8KM"` → phá Recharts tooltip. Dùng `"6.8KM"` hoặc `"7K"` (rounded).
- ❌ `"25KM "` trailing whitespace → layout shift.
- ❌ `"24H ULTRA "` → tương tự.

### 8.2 Checkpoint key

- Key là identifier để match với `OverallRanks` / `Chiptimes` / `Paces` JSON object.
- Chuẩn: `Start`, `TM1`, `TM2`, …, `TMn`, `Finish` (PascalCase, exact).
- Admin Course config phải có `checkpoints[]` đầy đủ với `{key, name, distance}`:
  - `key` = giá trị trong RaceResult JSON (`"TM1"`)
  - `name` = display name (`"CP1 - Suối Vàng"`)
  - `distance` = distance từ start (`"5K"`)

### 8.3 CourseId

- Dạng numeric (`474`) hoặc slug (`42km`, `100km`). Nhất quán trong một event.
- ❌ Trộn numeric và slug trong cùng event (VD event vừa có `course 474` vừa có `course "10km"`).

---

## 9. Pre-Publish Checklist — Race Setup Lead PHẢI ký trước go-live

Dán checklist này vào Jira/Notion ticket của mỗi event. **Không event nào được đặt status = `live` hoặc `pre_race` trên 5BIB nếu còn ô nào chưa tick.**

```
[ ] RaceResult event đã mở, API key cấp cho 5BIB sync
[ ] Courses trên 5BIB admin đã tạo đủ, courseId match với RaceResult
[ ] Checkpoint config mỗi course đã setup với đúng `key` (khớp JSON RaceResult)
[ ] Sample 5 athlete test record có đủ: Bib (≠0), Name, TimingPoint, OverallRank,
    ChipTime, Gender, Nationality
[ ] TimingPoint enum check: với 5 athlete mẫu, confirm value thuộc
    {Finish, DNF, DNS, DSQ, OOC, <checkpoint_name>}
[ ] Gender: chỉ "M" hoặc "F" — grep mọi value khác nếu có
[ ] Nationality: KHÔNG có "0", "null", "-", số, rỗng.
    Vietnam/Vietnamese không được cùng xuất hiện
[ ] Course name: không trailing space, không comma decimal
[ ] Race format đặc biệt (backyard / relay / time-limited) → §4.3 convention
    được ghi vào ticket, Timing Operator đã ack
[ ] Started/Finished/DNF counters có được gửi từ upstream? Nếu không, 5BIB
    sẽ derive — OK nhưng phải confirm sau event kết thúc
```

**Ký tên** Race Setup Lead + date trước khi switch status sang `pre_race`.

---

## 10. Post-Sync Validation — Engineer/QA chạy sau mỗi sync

Sau khi race sync về 5BIB, chạy các query sau để verify data sạch:

### 10.1 Vocabulary audit

```javascript
// Mongo shell — chạy trên DB race_results
db.race_results.distinct("timingPoint", { raceId: "<race_mongo_id>" })
// Expected: chỉ chứa ["Finish", "DNF", "DNS", "DSQ", "OOC", "TM1", "TM2", ...]
// Nếu có "Lap N", "5KM", "End", "Complete" → SAI, push-back Timing Operator

db.race_results.distinct("gender", { raceId: "<race_id>" })
// Expected: ["M", "F"] — nothing else

db.race_results.distinct("nationality", { raceId: "<race_id>" })
// Expected: ISO 3166 names hoặc ISO alpha-2
// SAI nếu có: "0", "250", "-", "", "null", "Vietnamese" (dùng "Vietnam" thôi)
```

### 10.2 Invariant check per course

```javascript
// Mỗi course: Finished + DNF + DSQ + OOC === Started
db.race_results.aggregate([
  { $match: { raceId: "<race_id>", courseId: "<course_id>" } },
  { $group: {
      _id: null,
      started: { $first: "$started" },
      finished: { $first: "$finished" },
      dnf: { $first: "$dnf" },
      n: { $sum: 1 }
  }}
])
// Nếu started ≠ finished + dnf → push-back upstream hoặc re-sync
```

### 10.3 Bucket sanity check

```bash
# Endpoint stats trả về classifier bucket count
curl -s "http://backend/api/race-results/stats/<courseId>" | jq
# Check: finished > 0 (nếu race đã kết thúc)
#        started = finished + dnf + dsq + dns
#        totalFinishers KHÔNG lớn hơn finished bất thường
```

### 10.4 Rank consistency

```javascript
// Không athlete nào có OverallRank="Finish" + TimingPoint=<checkpoint không phải Finish>
db.race_results.find({
  raceId: "<race_id>",
  overallRank: { $regex: /^\d+$/ },
  timingPoint: { $ne: "Finish" }
}).count()
// Expected: 0 cho race đã kết thúc
// Nếu > 0 → runner "có rank finisher" nhưng TimingPoint nói họ dừng giữa chừng
```

### 10.5 Khi validation FAIL

Ngày nào fail → **push-back upstream RaceResult cấu hình** ngay ngày đó. KHÔNG:
- Patch code 5BIB để "đỡ cho" data sai
- Ghi đè bằng admin manual edit (chỉ cho phép khi upstream không thể fix)
- Delay sang sprint sau

Route eskalasi:
1. 5BIB QA gửi PR `[VALIDATION-FAIL] <race> <course>` vào Jira
2. Timing Operator có 24h để fix config RaceResult
3. Sync lại (manual trigger `/api/race-results/sync/<raceId>`)
4. QA re-run §10 — confirm pass → close

---

## 11. Fallback Strategy — khi data không thể fix upstream

Có những trường hợp **không thể** fix upstream (event đã kết thúc 2 năm trước, vendor đổi chủ, …). Lúc đó:

### 11.1 Manual override qua admin

- Admin `/races/[id]/results` có CRUD cho từng athlete record.
- Sửa field nào phải để lại `editHistory` entry + reason.
- Không override `started/finished/dnf` trực tiếp ở race config — sửa từng record, để classifier tự re-derive.

### 11.2 FE-level empty state (hotfix tạm)

Khi data legacy quá bẩn, dùng các FE guard sau để tránh hiển thị xấu hổ:

- `CourseStatsViz` — khi `started === 0 && finished === 0 && dnf === 0` → render empty state ("Dữ liệu thống kê không khả dụng cho course này"), không vẽ donut.
- `CountryRankingTable` — apply `isValidNationality()` filter ở input; merge `Vietnamese↔Vietnam` trong lookup map.
- Finish-rate badge — `started > 0 &&` guard trước tier lookup để không hiển thị "0% Poor" red badge khi `started=0`.

**Nhưng lưu ý:** các guard này là last-resort. Nguyên tắc số 1 vẫn là fix upstream.

### 11.3 Deprecate race legacy khỏi public

Race > 2 năm và data quá bẩn có thể move sang status `archived` (nếu status enum hỗ trợ) hoặc `draft` (ẩn khỏi homepage). Hiện tại 5BIB có 4 status: `draft / pre_race / live / ended`. Cân nhắc thêm `archived` trong sprint sau.

---

## 12. Version history & change control

| Version | Ngày | Thay đổi | Trigger |
|---|---|---|---|
| 1.0 | 2026-04-20 | Draft đầu tiên | Phát hiện bug chamlon + country leak trong QC pass |

**Procedure đổi spec:**
1. Tạo branch `spec/<ticket>` + cập nhật file này
2. Loop Timing Operator vendor review
3. Khi approved → merge + bump version
4. Thông báo cho team setup race next event

---

## 13. Liên hệ & owner

- **Spec owner:** 5BIB Engineering Lead
- **Timing Operator contact:** (điền info vendor RaceResult)
- **Eskalasi path:** 5BIB PM → Timing Operator Account Manager → Vendor Support

---

## Phụ lục A — Ví dụ record CHUẨN vs BẨN

### ✅ CHUẨN — finisher của race trail 100K

```json
{
  "Bib": 71010,
  "Name": "BRĂH YÀNG",
  "TimingPoint": "Finish",
  "OverallRank": "1",
  "OverallRanks": "{\"Start\":\"1\",\"TM1\":\"2\",\"TM2\":\"1\",\"Finish\":\"3\"}",
  "GenderRank": "1",
  "CatRank": "1",
  "ChipTime": "13:21:56",
  "GunTime": "13:22:12",
  "Pace": "8:01",
  "Gender": "M",
  "Category": "M30-39",
  "Nationality": "Vietnam",
  "Started": 42,
  "Finished": 27,
  "DNF": 15,
  "Certificate": "https://raceresult.com/certificates/71010/100K"
}
```

Ghi chú: `OverallRank="1"` (authoritative chip-time) khác `OverallRanks["Finish"]="3"` (wave start snapshot) — hoàn toàn hợp lệ, 5BIB handle đúng.

### ❌ BẨN — case chamlon-474 thực tế

```json
{
  "Bib": 5015,
  "Name": "Nguyễn Văn A",
  "TimingPoint": "Lap 12",          // ❌ phải là "Finish"
  "OverallRank": "1",
  "ChipTime": "09:50:44",
  "Gender": "M",
  "Category": "",                    // ❌ thiếu — dùng "12 laps" được
  "Nationality": "0",                // ❌ phải là "Vietnam" hoặc ""
  "Started": 48,                     // ❌ nếu 5BIB derive sẽ = 0 vì bucket classify sai
  "Finished": 48,
  "DNF": 0
}
```

Hậu quả: stats card ranking page hiển thị `0 Finished / 48 DNF / 0% finish rate`, champion lộ ra ở "country 0" row của Country Ranking.

### ❌ BẨN — case brah-yang country leak

```json
{
  "Bib": 71010,
  "Name": "BRĂH YÀNG",
  "TimingPoint": "Finish",
  "Nationality": "0"                 // ❌ phải là "Vietnam"
}
// + các athlete khác có Nationality="250", "Vietnamese" (duplicate với "Vietnam")
```

Hậu quả: Country Ranking table hiển thị 3 row bẩn: `"0" × 6`, `"250" × 1`, `Vietnamese × 8` + `Vietnam × 7` (duplicate cho cùng quốc gia).

---

## Phụ lục B — Mapping field RaceResult → MongoDB 5BIB

Cho engineer debug sync. File: `backend/src/modules/race-result/services/race-result.service.ts` (`syncRaceResult`).

| RaceResult API | MongoDB 5BIB | Note |
|---|---|---|
| `Bib` | `bib` | Fallback logic nếu = 0: xem §3 |
| `Name` | `name` | — |
| `TimingPoint` | `timingPoint` | Dùng trực tiếp cho bucket classifier |
| `OverallRank` | `overallRank` + `overallRankNumeric` | Numeric fallback = 900000 cho status strings |
| `GenderRank` | `genderRank` + `genderRankNumeric` | — |
| `CatRank` | `categoryRank` + `categoryRankNumeric` | — |
| `ChipTime` | `chipTime` | String format, parse ở FE |
| `GunTime` | `gunTime` | — |
| `Pace` | `pace` | — |
| `Gender` | `gender` | — |
| `Category` | `category` | — |
| `Nationality` | `nationality` | Có alias `nation` cũ |
| `Nation` | `nation` | Alias legacy |
| `Started` | `started` | Course-level, lấy `firstDoc` |
| `Finished` | `finished` | Course-level |
| `DNF` | `dnf` | Course-level |
| `Certificate`, `Certi` | `certificate`, `certi` | URL PNG/PDF |
| `OverallRanks` (string) | `overallRanks` (string) | Parse ở FE |
| `Chiptimes`, `Paces`, `TODs`, `Sectors` | same (string) | Parse ở FE |
| `Member` (relay) | `member` | JSON string |
| Toàn bộ payload | `rawData` | Object — debug / audit |

---

**HẾT SPEC.** Mọi câu hỏi về chuẩn data gửi `#5bib-timing` Slack channel.
