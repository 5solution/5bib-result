# 5Run — Fitness Challenge & Training Platform: UI/UX Design Brief

> **Mục đích:** Tài liệu này dành cho **Claude Design Agent** để thiết kế giao diện toàn bộ nền tảng 5Run — nền tảng tổ chức thử thách chạy bộ trực tuyến (fitness challenge) thuộc hệ sinh thái 5Solution.

> **Ngày:** 25/04/2026

---

## ⚠️ LƯU Ý QUAN TRỌNG VỀ THUẬT NGỮ (Strava Compliance)

> Vì lý do tuân thủ Strava API Agreement, **TOÀN BỘ giao diện và copy** phải sử dụng các thuật ngữ sau:
>
> | ❌ KHÔNG DÙNG | ✅ DÙNG THAY THẾ |
> |--------------|-----------------|
> | Virtual Race / Giải chạy virtual | **Fitness Challenge / Thử thách chạy bộ** |
> | Race Result / Kết quả giải | **Challenge Result / Kết quả thử thách** |
> | Race Leaderboard | **Challenge Leaderboard / Bảng xếp hạng** |
> | Registration / Đăng ký giải | **Join Challenge / Tham gia thử thách** |
> | Finisher / Hoàn thành giải | **Challenge Complete / Hoàn thành thử thách** |
> | Race Ranking | **Progress Ranking / Xếp hạng tiến trình** |
> | BIB Number | **Participant ID / Mã VĐV** (hoặc bỏ hẳn) |
>
> Lý do: Strava API cấm "uses that enable virtual races or competitions". 5Run định vị là **fitness challenge / training tracker platform**, KHÔNG phải virtual race platform. Điều này ảnh hưởng đến TẤT CẢ copy, button labels, page titles, meta descriptions, và marketing materials.

---

## 1. Tổng quan sản phẩm

**5Run** là nền tảng tổ chức thử thách chạy bộ trực tuyến (fitness challenge), cho phép:
- **Người chạy (Runner):** Tham gia thử thách chạy bộ online, kết nối đồng hồ GPS (Garmin, COROS) hoặc upload file GPX/FIT, tự động ghi nhận thành tích, xem bảng xếp hạng real-time, nhận huy chương/chứng nhận điện tử
- **Ban tổ chức (Organizer):** Tạo và quản lý thử thách chạy bộ, thiết lập cự ly/thời gian/quy tắc, theo dõi tiến trình VĐV, quản lý đăng ký và thanh toán
- **Doanh nghiệp (Corporate):** Tổ chức thử thách chạy bộ nội bộ, team building, CSR campaigns

### Data Source Priority (quan trọng cho Design)
| Nguồn | Loại kết nối | Auto-sync | Ghi chú |
|-------|-------------|-----------|---------|
| **Garmin Connect** | OAuth 2.0 — webhook push | ✅ Real-time | **Primary source** — API key đã có |
| **COROS** | OAuth 2.0 | ✅ Real-time | **Primary source** — API key đã có |
| **GPX/FIT Upload** | Manual file upload | ❌ Manual | Fallback cho tất cả — bao gồm Strava users export file |
| **Manual Entry** | Form nhập tay | ❌ Manual | Cho treadmill / không GPS |
| **Strava** | OAuth 2.0 (Phase 2) | ✅ Auto | Phase 2 — chờ partnership hoặc Terra API middleware |

**Vị trí trong hệ sinh thái 5Solution:**
| Sản phẩm | Vai trò | Kết nối với 5Run |
|----------|---------|------------------|
| **5BIB** | Kết quả giải chạy thực tế | Chia sẻ database VĐV, profile chạy bộ thống nhất |
| **5Ticket** | Bán vé sự kiện | Đăng ký giải virtual qua 5Ticket |
| **5Pix** | Ảnh giải chạy | Ảnh từ giải thực tế hiển thị trên profile 5Run |
| **5Run** | Giải chạy virtual | Data tập luyện + thành tích online |

---

## 2. Phân tích đối thủ — Điểm mạnh/yếu UX

### 2.1. Đối thủ Việt Nam

#### VRun.vn (Ominext)
- **Điểm mạnh UX:** Giao diện web responsive, tích hợp Strava, leaderboard real-time theo cá nhân và đội, hỗ trợ đa dạng môn (chạy/đạp xe/kayak). Đối tác lớn: Vietcombank, VietinBank, Techcombank
- **Điểm yếu UX:** Giao diện cũ kỹ (design 2020-2021), không có mobile app native, flow đăng ký nhiều bước, không có bản đồ route ảo, không gamification
- **UX Pattern nên học:** Leaderboard chia theo cá nhân/đội, hiển thị tiến trình tích lũy km

#### vRace.com.vn (FPT Online)
- **Điểm mạnh UX:** Có mobile app native (iOS + Android), tích hợp Strava + Garmin, huy chương/chứng nhận điện tử, tính năng cộng đồng (profile nhóm)
- **Điểm yếu UX:** App rating chỉ 2.86/5, lỗi sync liên tục với Strava/Garmin, UX mobile không trực quan, hiệu suất chậm
- **UX Pattern nên học:** E-certificate + e-medal concept, cộng đồng nhóm

#### iRace.vn
- **Điểm mạnh UX:** ~200K thành viên, BMI/BMR tracking tự động, so sánh thành tích giữa runner, virtual + offline kết hợp
- **Điểm yếu UX:** Giao diện web-first không tối ưu mobile, tính năng rải rác, thiếu trải nghiệm "event" rõ ràng
- **UX Pattern nên học:** Health metrics integration (BMI/BMR), runner comparison

### 2.2. Đối thủ quốc tế

#### Challenge Hound (US)
- **Điểm mạnh:** Auto-sync Strava/Garmin/Fitbit/Apple Health, bản đồ route ảo interactive, team/individual challenges, free cho nhóm nhỏ
- **Điểm yếu:** Giao diện rất cơ bản (functional > aesthetic), không mobile app, thiếu gamification
- **UX Pattern nên học:** Virtual route map với avatar di chuyển, diversity of challenge formats (distance/duration/elevation/count)

#### Racery (US)
- **Điểm mạnh:** Route ảo trên bản đồ thực (chạy qua landmarks), avatar racer, digital bib, P2P fundraising, sponsor pin drops
- **Điểm yếu:** $9-13/racer pricing cao, giao diện web old-school, không real-time sync
- **UX Pattern nên học:** ⭐ **Virtual route map concept** — avatar chạy qua landmarks/scenic locations, pin drops cho sponsor, bib cá nhân hóa

#### viRACE (Europe)
- **Điểm mạnh:** 200K+ VĐV, 162 quốc gia, **live audio feedback qua tai nghe** (thông báo thứ hạng/khoảng cách real-time), tích hợp 8+ nền tảng (Strava/Garmin/Polar/Suunto/COROS/Wahoo/Fitbit/Apple Health), organizer tools mạnh
- **Điểm yếu:** App-heavy (buộc dùng app), giao diện không hiện đại
- **UX Pattern nên học:** ⭐ **Live audio coaching/feedback**, multi-platform integration, organizer customization (logo/sponsor/sound effects)

#### DistantRace (Europe)
- **Điểm mạnh:** **Whitelabel solution** cho organizer, API-first, tự động hóa hoàn toàn (không cần gửi kết quả manual)
- **Điểm yếu:** Strava sync hạn chế (do Strava policy), UX basic
- **UX Pattern nên học:** Whitelabel concept, full automation từ đăng ký → kết quả

#### Medal Dash (US) — #1 Ranked
- **Điểm mạnh:** 250K+ participants, vận chuyển huy chương vật lý trong 48h, event swag (áo/medal/bib), community Facebook group mạnh
- **Điểm yếu:** Thiên về physical reward hơn digital experience, không real-time tracking
- **UX Pattern nên học:** Physical reward (medal/bib/shirt) kết hợp digital, community building

#### 42Race (Singapore — SEA focused)
- **Điểm mạnh:** Wearable sync, virtual cycling/walking, reward system (đổi điểm), Southeast Asia market
- **Điểm yếu:** Giao diện đơn giản, tính năng cơ bản
- **UX Pattern nên học:** Multi-sport support, reward/point system

#### RunSignup RaceDay Virtual (US)
- **Điểm mạnh:** Upload file GPX/FIT trực tiếp, SMS result submission, real-time scoring tự động, organizer approval flow
- **Điểm yếu:** Giao diện chuyên nghiệp nhưng phức tạp, targeting organizer hơn runner
- **UX Pattern nên học:** ⭐ **GPX/FIT file upload** as fallback khi API không khả dụng, SMS submission, auto-scoring

---

## 3. Feature Matrix — So sánh đối thủ

| Tính năng | VRun | vRace | iRace | Challenge Hound | Racery | viRACE | DistantRace | Medal Dash | 42Race | RunSignup |
|-----------|------|-------|-------|----------------|--------|--------|-------------|------------|--------|-----------|
| Strava sync | ✅ | ⚠️ lỗi | ✅ | ✅ auto | ❌ manual | ✅ auto | ⚠️ hạn chế | ⚠️ manual | ✅ | ✅ via file |
| Garmin sync | ❌ | ⚠️ lỗi | ❌ | ✅ auto | ❌ | ✅ auto | ✅ | ⚠️ manual | ✅ | ✅ via file |
| COROS sync | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mobile app | ❌ | ✅ (2.86★) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Virtual route map | ❌ | ❌ | ❌ | ✅ | ✅ ⭐ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Live leaderboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Team challenge | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| E-certificate | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Physical medal | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ ⭐ | ✅ | ❌ |
| Organizer dashboard | ✅ basic | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ ⭐ | ✅ | ✅ | ✅ ⭐ |
| Whitelabel | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ ⭐ | ❌ | ❌ | ✅ |
| Anti-cheat/validation | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ basic |
| GPX/FIT upload | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ ⭐ |
| Live audio feedback | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ ⭐ | ❌ | ❌ | ❌ | ❌ |
| Fundraising/CSR | ❌ | ❌ | ❌ | ✅ | ✅ ⭐ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Gamification/badges | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

**Kết luận:** KHÔNG có đối thủ nào đạt >70% tính năng. Gap lớn nhất: anti-cheat validation, COROS sync, gamification, và kết hợp virtual + physical race data. **5Run có cơ hội xây dựng nền tảng toàn diện nhất.**

---

## 4. Design System cho 5Run

### 4.1. Triết lý thiết kế

**"Active Motion"** — Thiết kế phải truyền tải cảm giác chuyển động, năng lượng, và tiến bộ. Lấy cảm hứng từ:
- Strava: data-driven, clean typography, social feed
- Nike Run Club: bold colors, motivational, mobile-first
- UTMB Live: race-day excitement, real-time updates

### 4.2. Color Tokens

Kế thừa từ 5BIB/5Ticket design system, bổ sung tokens cho 5Run:

| Token | Hex | Sử dụng |
|-------|-----|---------|
| `--5run-primary` | `#10B981` (Emerald 500) | Primary CTA, progress bars, active states |
| `--5run-primary-dark` | `#059669` (Emerald 600) | Hover states |
| `--5run-accent` | `#F59E0B` (Amber 500) | Achievements, medals, highlights |
| `--5run-energy` | `#EF4444` (Red 500) | Live indicators, pace alerts, PR highlights |
| `--5run-distance` | `#3B82F6` (Blue 500) | Distance metrics, route maps |
| `--5run-bg` | `#FAFAF9` (Stone 50) | Page background (kế thừa 5BIB) |
| `--5run-surface` | `#FFFFFF` | Cards, modals |
| `--5run-text` | `#1C1917` (Stone 900) | Primary text (kế thừa 5BIB) |
| `--5run-text-secondary` | `#78716C` (Stone 400) | Secondary text |
| `--5run-border` | `#E7E5E4` (Stone 200) | Borders, dividers |
| `--5run-gold` | `#EAB308` | Rank 1, gold medal |
| `--5run-silver` | `#94A3B8` | Rank 2, silver medal |
| `--5run-bronze` | `#D97706` | Rank 3, bronze medal |

### 4.3. Typography

Kế thừa 100% từ 5BIB:
- **Headings:** Be Vietnam Pro (700/600)
- **Body:** Inter (400/500)
- **Data/Numbers:** JetBrains Mono / SF Mono (monospace)

### 4.4. Core Components

| Component | Variants | Ghi chú |
|-----------|----------|---------|
| `EventCard` | `upcoming`, `live`, `completed`, `featured` | Card hiển thị giải chạy, có progress indicator |
| `LeaderboardRow` | `default`, `highlighted` (current user), `podium` (top 3) | Hàng bảng xếp hạng, monospace cho timing data |
| `ProgressRing` | `small` (48px), `medium` (80px), `large` (120px) | Vòng tròn tiến trình % hoàn thành cự ly |
| `ActivityCard` | `synced`, `pending`, `rejected` | Card hoạt động đã đồng bộ từ Strava/Garmin/COROS |
| `AchievementBadge` | `locked`, `unlocked`, `new` | Huy chương/badge gamification |
| `RouteMap` | `overview`, `detailed`, `avatar-view` | Bản đồ route ảo với avatar VĐV |
| `StatBlock` | `distance`, `pace`, `time`, `elevation`, `calories` | Block hiển thị metrics, icon + value + unit |
| `ConnectorCard` | `strava`, `garmin`, `coros`, `manual` | Card kết nối nguồn dữ liệu |
| `CertificateCard` | `preview`, `full` | Preview chứng nhận hoàn thành |
| `TeamCard` | `default`, `ranked` | Card đội với avatar members + tổng km |
| `CountdownTimer` | `days`, `hours`, `live` | Đếm ngược đến ngày bắt đầu/kết thúc |
| `SyncStatus` | `connected`, `syncing`, `error`, `disconnected` | Trạng thái kết nối với nguồn data |

---

## 5. Danh sách màn hình — Specs chi tiết

### 5.1. PUBLIC PAGES (Người chạy — Runner)

---

#### Màn hình 1: Homepage / Event Discovery
**Route:** `/`

**Layout:** Hero banner + danh sách giải chạy

**Sections:**
1. **Hero Section**
   - Banner giải chạy nổi bật (featured event) — full-width image, tên giải, countdown timer, nút "Tham gia ngay"
   - Stats tổng quan platform: "X giải chạy | Y VĐV | Z km đã chạy"

2. **Giải đang diễn ra (Live Events)**
   - Horizontal scroll `EventCard` variant `live`
   - Mỗi card: tên giải, logo BTC, tiến trình (X/Y VĐV hoàn thành), thời gian còn lại, nút "Xem chi tiết"
   - Indicator nhấp nháy "LIVE" badge màu đỏ

3. **Giải sắp diễn ra (Upcoming)**
   - Grid 2-3 cột `EventCard` variant `upcoming`
   - Card: tên giải, khoảng cự ly (5K/10K/21K/42K), thời gian đăng ký, giá vé, countdown, nút "Đăng ký"

4. **Giải đã hoàn thành (Past Events)**
   - Grid `EventCard` variant `completed`
   - Card: tên giải, số VĐV tham gia, top 3 VĐV, nút "Xem kết quả"

5. **Leaderboard tổng hợp (Global)**
   - Top 10 runner toàn platform theo tháng/quý/năm
   - Tabs: "Cá nhân" | "Đội"

6. **Footer:** Links, social, download app

**States:**
- Loading: Skeleton cards
- Empty: "Chưa có giải chạy nào" + CTA cho organizer
- Error: Toast notification

---

#### Màn hình 2: Event Detail
**Route:** `/events/[slug]`

**Layout:** Thông tin chi tiết giải chạy

**Sections:**
1. **Event Header**
   - Cover image/banner giải
   - Logo BTC (organizer)
   - Tên giải (h1), tagline
   - Status badge: "Đang mở đăng ký" / "Đang diễn ra" / "Đã kết thúc"
   - Countdown timer (nếu chưa bắt đầu)

2. **Thông tin cơ bản**
   - Thời gian: ngày bắt đầu — ngày kết thúc
   - Cự ly có sẵn: pills/chips (5K, 10K, 21K, 42K, custom)
   - Hình thức: "Tích lũy" (nhiều ngày) / "Một lần" (chạy 1 session)
   - Quy tắc: tốc độ tối thiểu/tối đa, nguồn data chấp nhận, anti-cheat rules
   - Giải thưởng: mô tả giải thưởng, huy chương, quà tặng

3. **Route ảo (nếu có)**
   - Bản đồ interactive hiển thị route ảo (Mapbox/Leaflet)
   - Landmarks/checkpoints trên đường đi
   - Avatar VĐV đang chạy real-time

4. **Leaderboard Preview**
   - Top 10 cá nhân + top 5 đội
   - Nút "Xem đầy đủ"

5. **Đăng ký / Tham gia**
   - Chọn cự ly
   - Chọn đội (nếu có) hoặc tạo đội mới
   - Thông tin cá nhân (tự fill nếu đã login)
   - Kết nối nguồn data (Strava/Garmin/COROS/Manual) — **bắt buộc chọn ít nhất 1**
   - Thanh toán (nếu có phí)
   - Nút "Xác nhận tham gia"

6. **Sponsors Section**
   - Logo sponsors (kế thừa component từ 5BIB)

**States:**
- Chưa login → hiện đăng ký form + prompt login
- Đã đăng ký → hiện progress cá nhân + nút "Xem thành tích"
- Giải kết thúc → hiện kết quả + certificate

---

#### Màn hình 3: Runner Dashboard (My Races)
**Route:** `/dashboard`

**Layout:** Dashboard cá nhân người chạy — trung tâm điều khiển

**Sections:**
1. **Profile Header**
   - Avatar, tên, tổng km đã chạy trên 5Run
   - Streak: "X ngày chạy liên tiếp"
   - Level/XP bar (gamification)
   - Nút "Kết nối thiết bị" → quản lý Strava/Garmin/COROS

2. **Giải đang tham gia (Active Races)**
   - Cards with progress:
     - Tên giải, cự ly đã hoàn thành / tổng cự ly
     - `ProgressRing` component
     - Ranking hiện tại: "#X / Y VĐV"
     - Thời gian còn lại
     - Nút "Xem chi tiết"

3. **Hoạt động gần đây (Recent Activities)**
   - Feed `ActivityCard`:
     - Nguồn (Strava icon / Garmin icon / COROS icon / Manual)
     - Ngày giờ, cự ly, thời gian, pace trung bình
     - Status: "Đã tính" ✅ / "Đang xác minh" ⏳ / "Không hợp lệ" ❌
     - Giải liên quan (activity này tính cho giải nào)

4. **Thống kê tổng hợp**
   - `StatBlock` grid: tổng km (tuần/tháng/năm), pace trung bình, elevation gain, tổng thời gian chạy
   - Mini chart: km theo tuần (bar chart, 4 tuần gần nhất)

5. **Huy chương & Chứng nhận**
   - Grid `AchievementBadge`
   - Locked badges mờ đi với hint "Hoàn thành X để mở khóa"

6. **Lịch sử giải đã tham gia**
   - List past events với kết quả tóm tắt

---

#### Màn hình 4: Event Leaderboard
**Route:** `/events/[slug]/leaderboard`

**Layout:** Bảng xếp hạng chi tiết giải chạy

**Sections:**
1. **Event Header** (compact — tên giải, trạng thái, countdown)

2. **Filter Bar**
   - Tabs cự ly: "Tất cả" | "5K" | "10K" | "21K" | "42K"
   - Toggle: "Cá nhân" | "Đội"
   - Filter: Giới tính (Nam/Nữ/Tất cả), Nhóm tuổi
   - Search: tìm theo tên/BIB

3. **Podium Section** (top 3)
   - Card lớn cho top 3 với avatar, tên, thành tích, medal icon (gold/silver/bronze)
   - Animation subtle khi load

4. **Leaderboard Table**
   - Columns: Rank | VĐV (avatar + tên) | Cự ly đã chạy | Pace TB | Tổng thời gian | Số activities | Ngày hoàn thành
   - Current user row highlighted với background accent
   - Pagination hoặc infinite scroll
   - Sticky header khi scroll

5. **Team Leaderboard** (tab Đội)
   - Columns: Rank | Tên đội | Số thành viên | Tổng km | TB km/người

**Real-time update:** WebSocket hoặc polling 30s để cập nhật leaderboard

---

#### Màn hình 5: Activity Detail
**Route:** `/dashboard/activities/[id]`

**Layout:** Chi tiết 1 hoạt động đã đồng bộ

**Sections:**
1. **Activity Header**
   - Nguồn sync (icon + label: "Synced from Strava")
   - Ngày giờ
   - Status badge

2. **Route Map**
   - Bản đồ GPS route thực tế (nếu có GPS data)
   - Start/end markers
   - Heatmap color theo pace

3. **Metrics Grid**
   - `StatBlock` grid: Distance, Duration, Avg Pace, Max Pace, Elevation Gain, Calories, Avg Heart Rate (nếu có)

4. **Splits Table**
   - Km splits: Km | Pace | Elevation | Heart Rate
   - Highlight fastest/slowest km

5. **Giải liên quan**
   - Activity này được tính cho giải nào
   - Contribution: "+5.2km vào giải XYZ (đã chạy 15.2/21km)"

---

#### Màn hình 6: Connect Devices / Data Sources
**Route:** `/dashboard/connections`

**Layout:** Quản lý kết nối nguồn dữ liệu

**Sections:**
1. **Connected Sources** (hiển thị theo priority)
   - `ConnectorCard` variant `garmin` — **"Garmin Connect"**
     - Logo Garmin + status `SyncStatus`
     - "Auto-sync: Bật" — real-time webhook push
     - Last sync time, nút "Sync ngay", nút "Ngắt kết nối"
   - `ConnectorCard` variant `coros` — **"COROS"**
     - Tương tự Garmin
   - `ConnectorCard` variant `strava` — **"Strava (qua file export)"**
     - ⚠️ Phase 1: KHÔNG dùng OAuth, hiển thị hướng dẫn export GPX từ Strava
     - Label: "Xuất file GPX từ Strava rồi upload bên dưới"
     - Link: "Xem hướng dẫn export" → mở tutorial
     - Phase 2: Nếu Strava partnership approved → đổi sang OAuth flow

2. **Available Sources**
   - `ConnectorCard` cho nguồn chưa kết nối:
     - Logo + tên + mô tả ngắn
     - Nút "Kết nối" → OAuth flow (Garmin/COROS)

3. **Manual Upload (GPX/FIT)**
   - Upload GPX/FIT file — drag & drop zone
   - Hỗ trợ: Strava export, Garmin export, COROS export, Suunto, Polar
   - Lịch sử file đã upload
   - Auto-parse: distance, duration, GPS track, heart rate (nếu có trong file)

4. **Manual Entry (Treadmill)**
   - Form: distance (km), duration (hh:mm:ss), date
   - Không có GPS data → có thể bị flag bởi validation nếu BTC yêu cầu GPS

5. **Sync Settings**
   - Auto-sync: Bật/tắt tự động đồng bộ (Garmin/COROS)
   - Notifications: nhận thông báo khi có activity mới
   - Data preferences: ưu tiên nguồn nào khi trùng activity
   - Conflict resolution: "Nếu cùng 1 buổi chạy sync từ 2 nguồn → ưu tiên nguồn nào?"

---

#### Màn hình 7: Finisher Certificate & Medal
**Route:** `/events/[slug]/certificate`

**Layout:** Chứng nhận hoàn thành + huy chương điện tử

**Sections:**
1. **Certificate Preview**
   - Canvas-based certificate (kế thừa pattern từ 5BIB Result Image)
   - Thông tin: tên VĐV, giải, cự ly, thành tích, ngày hoàn thành
   - Logo BTC + logo 5Run
   - Background: BTC có thể customize (upload background image)

2. **E-Medal Preview**
   - Huy chương 3D xoay (CSS animation)
   - Tên giải, cự ly, rank

3. **Actions**
   - Download PNG/PDF
   - Share lên social (Facebook/Instagram/Zalo)
   - Nút "Tạo ảnh kết quả" → redirect sang 5BIB Result Image Editor (nếu giải có kết nối 5BIB)

---

#### Màn hình 8: Runner Profile (Public)
**Route:** `/runners/[id]`

**Layout:** Profile công khai của runner

**Sections:**
1. **Profile Header**
   - Avatar, tên, bio
   - Stats tổng: tổng km, số giải tham gia, streak, level

2. **Achievements Showcase**
   - Grid huy chương đã nhận (giới hạn 6, "Xem tất cả")

3. **Race History**
   - Timeline các giải đã tham gia (cả virtual trên 5Run + thực tế trên 5BIB)
   - Mỗi entry: tên giải, cự ly, thành tích, rank

4. **Activity Stats**
   - Chart km theo tháng (12 tháng gần nhất)
   - Pace progression chart

---

### 5.2. ORGANIZER PAGES (Ban tổ chức)

---

#### Màn hình 9: Organizer Dashboard
**Route:** `/organizer` hoặc `/admin/5run`

**Layout:** Tổng quan quản lý giải chạy cho BTC

**Sections:**
1. **Stats Overview**
   - Tổng giải đã tạo, tổng VĐV, tổng doanh thu, giải đang live

2. **Active Events**
   - Cards: tên giải, số VĐV đăng ký, % hoàn thành, doanh thu, nút "Quản lý"

3. **Quick Actions**
   - "Tạo giải mới" (CTA prominent)
   - "Xem báo cáo"

---

#### Màn hình 10: Create/Edit Event
**Route:** `/organizer/events/create` hoặc `/organizer/events/[id]/edit`

**Layout:** Form tạo/chỉnh sửa giải chạy — multi-step wizard

**Steps:**
1. **Thông tin cơ bản**
   - Tên giải, slug, mô tả (rich text)
   - Cover image upload
   - Loại: "Tích lũy" / "Một lần"
   - Thời gian: ngày bắt đầu, ngày kết thúc, timezone

2. **Cự ly & Hạng mục**
   - Thêm nhiều cự ly (5K, 10K, 21K, custom)
   - Mỗi cự ly: tên, khoảng cách, giá vé, số lượng tối đa
   - Team mode: cho phép đội? Số người/đội min-max?

3. **Quy tắc & Validation**
   - Pace tối thiểu (vd: không dưới 3:00/km — chống cheat)
   - Pace tối đa (vd: không quá 12:00/km)
   - Nguồn data chấp nhận: checkboxes (Garmin / COROS / GPX-FIT Upload / Manual)
   - Cho phép treadmill? (không có GPS)
   - Số activities tối đa/ngày

4. **Route ảo (Optional)**
   - Upload route (GPX file) hoặc vẽ trên bản đồ
   - Đặt checkpoints/landmarks
   - Chọn route từ thư viện (routes nổi tiếng)

5. **Giải thưởng & Gamification**
   - Huy chương: upload design hoặc dùng template
   - Chứng nhận: upload background + customize fields
   - Badges cho milestones (50%, hoàn thành, top 10, etc.)

6. **Thanh toán & Phí**
   - Giá vé theo cự ly
   - Early bird pricing
   - Mã giảm giá
   - Tích hợp payment gateway (kế thừa từ 5Ticket)

7. **Review & Publish**
   - Preview toàn bộ event
   - Nút "Lưu nháp" / "Xuất bản"

---

#### Màn hình 11: Event Management (Organizer)
**Route:** `/organizer/events/[id]`

**Layout:** Quản lý chi tiết giải đang diễn ra

**Tabs:**
1. **Overview:** Real-time stats — VĐV đã đăng ký, đã hoàn thành, doanh thu, activities hôm nay
2. **Participants:** Danh sách VĐV, filter/search, export CSV, trạng thái (registered/in-progress/completed/DNF)
3. **Activities:** Feed tất cả activities đã sync, validation status, manual approve/reject
4. **Leaderboard:** Preview leaderboard, pin/unpin VĐV
5. **Results:** Kết quả chính thức, export, gửi certificate hàng loạt
6. **Settings:** Edit event info, extend deadline, thay đổi rules

---

#### Màn hình 12: Organizer Analytics
**Route:** `/organizer/events/[id]/analytics`

**Layout:** Báo cáo phân tích cho BTC

**Charts:**
- Đăng ký theo ngày (line chart)
- Distribution cự ly (pie chart)
- Activities theo ngày (bar chart)
- Demographic: giới tính, nhóm tuổi, tỉnh/thành
- Conversion funnel: view → register → connect device → first activity → complete

---

### 5.3. MOBILE CONSIDERATIONS

5Run ưu tiên **mobile-first** vì runner chủ yếu dùng điện thoại:

1. **Bottom Navigation Bar (5 tabs):**
   - Khám phá (Home) | Thử thách (My Challenges) | Hoạt động (Activities) | Thành tích (Achievements) | Tài khoản (Profile)

2. **Pull-to-refresh** trên tất cả các feed

3. **Offline support:** Cache activities đã sync, xem offline

4. **Push notifications:**
   - Activity mới được sync
   - Ranking thay đổi
   - Sắp hết hạn giải
   - Đội có thành viên mới hoàn thành

5. **Quick action FAB (Floating Action Button):**
   - "Ghi nhận hoạt động" (manual entry)
   - "Upload GPX"

---

## 6. UX Flow quan trọng

### Flow 1: Đăng ký + Kết nối thiết bị → Tham gia thử thách
```
Homepage → Chọn thử thách → Challenge Detail → Chọn cự ly → Login/Register
→ Kết nối Garmin/COROS (OAuth popup) HOẶC chọn "Upload GPX" → Xác nhận → Thanh toán (nếu có)
→ Redirect Dashboard → Hiện thử thách vừa tham gia với progress 0%
```

### Flow 1b: Strava User Onboarding (Phase 1 — GPX Export)
```
Runner chọn "Tôi dùng Strava" → Hiện hướng dẫn:
  Step 1: Mở Strava → Activity → "..." → Export GPX
  Step 2: Upload file GPX vào 5Run
  (Kèm screenshots/video hướng dẫn, nút "Tôi đã hiểu")
→ Sau mỗi buổi chạy, runner upload GPX manually
```

### Flow 2: Activity Sync → Tính thành tích
```
Runner chạy bộ → Record trên Garmin/COROS
→ Webhook/Push notification → 5Run nhận activity data
HOẶC: Runner upload GPX/FIT file manually
→ Validation: kiểm tra pace, GPS, trùng lặp, thời gian hợp lệ
→ Nếu PASS → Cộng km vào giải → Cập nhật leaderboard
→ Nếu FAIL → Đánh dấu "rejected" + lý do → Thông báo runner
→ Runner xem dashboard: activity mới + progress cập nhật
```

### Flow 3: Hoàn thành giải → Certificate
```
Runner đạt đủ km → Popup celebration (confetti animation)
→ Badge "FINISHER" unlock → E-certificate tự động generate
→ Thông báo: "Chúc mừng! Bạn đã hoàn thành [tên giải]"
→ Share options: download image, post Facebook, share Zalo
→ Physical medal delivery (nếu có) → tracking link
```

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, bottom nav, cards stack vertical |
| Tablet | 640-1024px | 2-column grid, sidebar collapse |
| Desktop | > 1024px | 3-column grid, full sidebar, expanded charts |

---

## 8. Animation & Micro-interactions

| Element | Animation | Trigger |
|---------|-----------|---------|
| Progress ring | Animate fill from 0 → current% | On viewport enter |
| Leaderboard row | Slide up + fade in, stagger 50ms | On load |
| Achievement badge unlock | Scale bounce + sparkle particles | On unlock event |
| Activity sync | Pulse glow on source icon | During sync |
| Rank change | Number counter animation + arrow (↑↓) | On rank update |
| Confetti | Full-screen confetti burst | On challenge completion |
| Route map avatar | Smooth move along route path | On progress update |

---

## 9. Lưu ý kỹ thuật cho Designer

1. **Strava — PHASE 1 KHÔNG CÓ OAuth:** Trong Phase 1, Strava chỉ xuất hiện như hướng dẫn export GPX. Không có nút "Connect Strava", không có Strava logo trong ConnectorCard OAuth flow. Thay vào đó, design 1 section riêng "Import từ Strava" với tutorial steps + screenshots. Phase 2 mới có OAuth nếu partnership approved.
2. **Garmin branding:** Tuân thủ Garmin brand guidelines khi hiển thị logo. Garmin là primary connector — đặt đầu tiên trong danh sách.
3. **COROS branding:** Tương tự Garmin, tuân thủ brand guidelines.
4. **GPX/FIT Upload UX:** Đây là flow QUAN TRỌNG cho Strava users. Design phải thật dễ: drag & drop rõ ràng, accept multiple files, hiển thị preview sau parse (distance, duration, route map), confirm button. Nên có trạng thái "parsing..." với skeleton.
5. **Map component:** Dùng Mapbox GL JS hoặc Leaflet — cần design cho cả dark mode
6. **Certificate canvas:** Reuse pattern từ 5BIB `@napi-rs/canvas` — 1080×1350px output
7. **Real-time indicators:** Thiết kế cho cả "live updating" state (Garmin/COROS webhook) và "manual refresh" state (GPX upload)
8. **Data density:** Leaderboard và activity feed cần xử lý 1000+ rows — phải có virtualization
9. **Dark mode:** Chuẩn bị token set cho dark mode (runner hay chạy sáng sớm/tối, cần dark UI)
10. **Terminology compliance:** Tham khảo bảng thuật ngữ ở đầu tài liệu. TUYỆT ĐỐI KHÔNG dùng từ "race", "virtual race" trong bất kỳ UI text/button label/page title nào. Dùng "challenge", "thử thách" thay thế.
