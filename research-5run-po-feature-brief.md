# 5Run — Virtual Race Platform: PO Feature Brief

> **Mục đích:** Tài liệu này dành cho **Agent PO (5BIB Mastermind PO)** để phân tích, viết PRD, và lên danh sách tính năng chi tiết cho nền tảng 5Run.

> **Ngày:** 25/04/2026

---

## 1. Product Vision

**5Run** là nền tảng tổ chức giải chạy trực tuyến (virtual run) cho phép người chạy tham gia từ bất kỳ đâu, kết nối dữ liệu tập luyện từ Strava/Garmin/COROS, tự động tính thành tích và xếp hạng real-time.

**Problem Statement:** Thị trường virtual run Việt Nam (~200K runner active trên VRun + vRace + iRace) đang bị phục vụ bởi các nền tảng có UX kém (vRace 2.86/5 stars), sync không ổn định, không anti-cheat, và không có hệ sinh thái liên kết. Không có nền tảng nào kết nối virtual race data ↔ physical race data ↔ race photos trong 1 profile VĐV thống nhất.

**Target Users:**
| Persona | Mô tả | Nhu cầu chính |
|---------|--------|---------------|
| **Runner** | VĐV phong trào, 18-45 tuổi, dùng đồng hồ GPS, active trên Strava | Tham gia giải online, xem thành tích, share kết quả, cạnh tranh bảng xếp hạng |
| **Organizer (BTC)** | Công ty tổ chức sự kiện, doanh nghiệp, hội chạy bộ | Tạo giải nhanh, quản lý VĐV, nhận thanh toán, xem analytics, whitelabel |
| **Corporate** | Doanh nghiệp tổ chức team building/CSR | Giải nội bộ, dashboard riêng, branding, báo cáo cho lãnh đạo |
| **Admin (5Solution)** | Team quản trị 5Run | Quản lý platform, duyệt giải, xử lý dispute, monitor hệ thống |

---

## 2. Thị trường & Đối thủ — Tổng hợp Research

### 2.1. Đối thủ Việt Nam

#### VRun.vn (Ominext JSC)
**Thế mạnh:** Platform web-based lớn nhất VN cho virtual run. Đối tác doanh nghiệp lớn (Vietcombank, VietinBank, Techcombank Marathon). Tích hợp Strava, leaderboard real-time, hỗ trợ team challenge, đa môn (chạy/đạp xe/kayak/SUP).

**Điểm yếu:**
1. Không có mobile app native → trải nghiệm mobile kém
2. Giao diện design cũ (2020-2021 era)
3. Không có anti-cheat/activity validation
4. Không tích hợp Garmin/COROS trực tiếp
5. Không có gamification (badge/streak/level)
6. Không có route ảo trên bản đồ
7. Không kết nối với race results (physical) hoặc race photos

**Monetization:** Phí tổ chức giải theo package cho doanh nghiệp. B2B model.

**Tech assumptions:** Web-based (likely PHP/Laravel hoặc Node.js), server-rendered pages, cơ sở dữ liệu quan hệ (MySQL/PostgreSQL), basic Strava OAuth integration.

#### vRace.com.vn (FPT Online)
**Thế mạnh:** Có mobile app (iOS + Android), backed by FPT ecosystem, tích hợp Strava + Garmin, e-certificate + e-medal, tính năng cộng đồng nhóm.

**Điểm yếu:**
1. **App rating 2.86/5** — sync lỗi liên tục là complaint #1
2. Sync Strava/Garmin không ổn định
3. UX mobile không trực quan, hiệu suất chậm
4. Không có organizer self-service dashboard
5. Không anti-cheat
6. Design không hấp dẫn

**Monetization:** Sponsorship + phí đăng ký giải. Partnership với NAB Vietnam, các giải marathon lớn.

**Tech assumptions:** FPT stack (likely Java Spring Boot backend, React Native mobile app), monolith architecture, batch sync thay vì real-time webhook.

#### iRace.vn
**Thế mạnh:** ~200K members, BMI/BMR tracking, runner comparison, kết hợp virtual + offline events, huy chương vật lý.

**Điểm yếu:**
1. Web-first, mobile experience kém
2. Tính năng phân tán, không coherent
3. Không có organizer dashboard mạnh
4. Virtual race chỉ là 1 phần nhỏ của platform

**Monetization:** Phí đăng ký giải + physical medal/merchandise sales.

### 2.2. Đối thủ quốc tế

| Platform | Quốc gia | Thế mạnh chính | Điểm yếu | Scale |
|----------|---------|-----------------|-----------|-------|
| **Challenge Hound** | US | Auto-sync 5 nguồn, route ảo, team challenges, free tier | UI basic, no app | Medium |
| **Racery** | US | Route map với landmarks + avatar, P2P fundraising, sponsor tools | $9-13/racer, no real-time sync | Medium |
| **viRACE** | Europe | 200K VĐV, 162 nước, live audio feedback, 8+ integrations | App-heavy, UI cũ | Large |
| **DistantRace** | Europe | Whitelabel, API-first, full automation | Strava sync hạn chế | Medium |
| **Medal Dash** | US | #1 ranked, 250K+ users, physical medals 48h delivery | Focus physical reward > digital | Large |
| **42Race** | Singapore | SEA focus, multi-sport, reward/point system | Feature basic | Medium |
| **RunSignup** | US | GPX/FIT upload, SMS result, auto-scoring, organizer tools | Complex UI, US-focused | Very Large |

### 2.3. Gap Analysis — Cơ hội cho 5Run

| Khả năng | Đối thủ VN | Đối thủ quốc tế | 5Run Target |
|----------|-----------|------------------|-------------|
| Multi-source sync (Strava+Garmin+COROS) | ❌ chỉ Strava hoặc buggy | ⚠️ viRACE tốt nhất | ✅ All 3 + GPX upload |
| Anti-cheat validation | ❌ không ai có | ❌ hầu như không | ✅ GPS + pace + duplicate check |
| Virtual route map | ❌ | ⚠️ Challenge Hound, Racery | ✅ Mapbox + real-time avatar |
| Gamification (badge/streak/level) | ❌ | ⚠️ basic ở 42Race | ✅ Full system |
| Physical + Virtual race unified profile | ❌ | ❌ | ✅ ⭐ Unique — via 5BIB |
| Race photo on runner profile | ❌ | ❌ | ✅ ⭐ Unique — via 5Pix |
| Organizer self-service | ⚠️ VRun basic | ✅ RunSignup, DistantRace | ✅ Full dashboard |
| Whitelabel for organizer | ❌ | ✅ DistantRace | ✅ Phase 2 |
| Corporate/Team building | ✅ VRun | ✅ Challenge Hound | ✅ Better UX |
| E-certificate (BTC-branded) | ⚠️ vRace basic | ✅ viRACE | ✅ Canvas-based (reuse 5BIB) |

---

## 3. ⚠️ CRITICAL: Strava API Legal Risk

**Phát hiện quan trọng từ research:** Strava API Agreement (updated November 2024) có điều khoản:

> "Strava reserves the right to revoke your API Token if you violate the API Agreement, including but not limited to, **uses that enable virtual races or competitions**."

**Ý nghĩa:** Strava CÓ THỂ chặn 5Run nếu sử dụng Strava API để tổ chức virtual race. Tuy nhiên, NYRR (New York Road Runners) vẫn đang chạy "Virtual Racing Powered by Strava" → có nghĩa Strava có **partnership program** riêng.

### Chiến lược xử lý (ĐỀ XUẤT)

**Approach 1: Strava Official Partnership (Recommended)**
- Liên hệ Strava Developer Relations xin partnership như NYRR
- Ưu: Hợp pháp, rate limit cao hơn, branding "Powered by Strava"
- Nhược: Phụ thuộc approval từ Strava, có thể mất thời gian

**Approach 2: Terra API Middleware**
- Dùng Terra API (tryterra.co) — aggregator cho 500+ nguồn bao gồm Strava, Garmin, COROS
- Terra xử lý OAuth + normalization, 5Run nhận data chuẩn hóa
- Ưu: 1 integration cho tất cả, không bị rate limit từ Terra, Terra chịu trách nhiệm compliance
- Nhược: Thêm dependency, chi phí Terra, latency thêm 1 layer

**Approach 3: Garmin/COROS Direct + Strava via File Upload**
- Tích hợp trực tiếp Garmin Health API + COROS API (không bị restrict virtual race)
- Strava: cho phép user export file GPX/FIT từ Strava rồi upload lên 5Run
- Ưu: Không vi phạm Strava policy, Garmin/COROS không có restriction tương tự
- Nhược: UX friction cho Strava users (phải export manual)

**Approach 4: Hybrid (RECOMMENDED)**
- Phase 1: Garmin Direct + COROS Direct + GPX/FIT Upload (an toàn, không dependency)
- Phase 1.5: Nộp đơn Strava Partnership
- Phase 2: Nếu Strava approve → tích hợp webhook. Nếu không → Terra API fallback
- Phase 3: Xem xét own GPS tracking trong app 5Run

**Danny cần quyết định approach trước khi Engineering bắt đầu.**

---

## 4. Integration Technical Specs

### 4.1. Strava API (nếu được partnership approve)
- **Auth:** OAuth 2.0 (Authorization Code Grant)
- **Webhook:** Subscribe tới activity create/update/delete events
- **Data:** Activity detail (distance, moving_time, elapsed_time, start_date, map.polyline, average_speed, max_speed, average_heartrate, splits_metric)
- **Rate Limit:** 200 req/15min, 2000/day (default) — partnership có thể cao hơn
- **Token refresh:** Access token expires mỗi 6h, refresh token rotate
- **Branding:** Bắt buộc hiển thị "Powered by Strava" + dùng đúng logo

### 4.2. Garmin Connect Developer Program
- **Auth:** OAuth 2.0
- **APIs:** Health API + Activity API (push notification architecture)
- **Data:** Activity summaries, GPS tracks, heart rate, steps, VO2max, training load
- **Push:** Real-time notification khi user sync device → webhook tới 5Run
- **Cost:** Free (enterprise program, no licensing fees)
- **Restriction:** Business use only, cần apply qua developer portal
- **Advantage:** KHÔNG có restriction "virtual races" như Strava

### 4.3. COROS API
- **Auth:** OAuth 2.0 (private API docs — cần apply)
- **Data:** Activities, GPS tracks, heart rate, sleep, training metrics
- **Alternative:** Dùng Terra API hoặc Spike API middleware
- **Apply:** https://support.coros.com → API Application form

### 4.4. Terra API (Middleware option)
- **Coverage:** 500+ nguồn bao gồm Strava, Garmin, COROS, Apple Health, Samsung Health, Fitbit, Polar, Suunto, Wahoo
- **Data normalization:** Standardized schema cho activities, sleep, heart rate, body metrics
- **No rate limits:** Terra không giới hạn request
- **Auth:** Terra handles OAuth per provider
- **SDKs:** REST API + JavaScript SDK + Python SDK
- **Cost:** Theo volume (xem tryterra.co/pricing)

### 4.5. GPX/FIT File Upload (Fallback — always available)
- **GPX:** XML format, GPS tracks + waypoints + routes
- **FIT:** Binary format (Garmin/Wahoo/COROS native), richer data (HR, cadence, power)
- **Libraries:** `gpxparser` (Node.js), `fit-parser` (FIT decode)
- **Validation:** Parse file → extract distance, duration, GPS points → validate against anti-cheat rules
- **UX:** Drag & drop on web, file picker on mobile

---

## 5. Danh sách tính năng — Phân loại theo Module

### Module 1: Authentication & User Management

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| AUTH-01 | Đăng ký/Đăng nhập | Email + password, Social login (Google, Facebook, Apple) | P1 |
| AUTH-02 | Profile VĐV | Tên, avatar, giới tính, ngày sinh, quốc tịch, bio, target pace | P1 |
| AUTH-03 | OAuth Device Connection | Kết nối Strava/Garmin/COROS qua OAuth 2.0 | P1 |
| AUTH-04 | Session Management | JWT access + refresh token, multi-device support | P1 |
| AUTH-05 | Unified 5Solution Profile | Chia sẻ profile giữa 5BIB/5Ticket/5Run — single sign-on | P2 |

### Module 2: Data Integration (Activity Sync)

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| SYNC-01 | Garmin Webhook Receiver | Nhận push notification khi user sync Garmin, fetch activity detail | P1 |
| SYNC-02 | COROS Activity Sync | Tích hợp COROS API (hoặc qua Terra) | P1 |
| SYNC-03 | Strava Integration | Webhook subscription (nếu partnership) hoặc GPX export hướng dẫn | P1 |
| SYNC-04 | GPX/FIT File Upload | Parse GPX/FIT file, extract metrics, store GPS track | P1 |
| SYNC-05 | Manual Activity Entry | Form nhập manual: distance, duration, date (cho treadmill/no-GPS) | P1 |
| SYNC-06 | Activity Deduplication | Detect trùng activity từ multiple sources (Strava + Garmin cùng 1 run) | P1 |
| SYNC-07 | Terra API Integration | Middleware cho tất cả nguồn (fallback/alternative) | P2 |
| SYNC-08 | Apple Health / Samsung Health | Sync từ phone sensors (không cần watch) | P3 |

### Module 3: Activity Validation & Anti-Cheat

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| VALID-01 | Pace Range Check | Reject activity nếu pace ngoài khoảng cho phép (vd: <2:30/km hoặc >15:00/km) | P1 |
| VALID-02 | GPS Continuity Check | Phát hiện GPS spoofing: kiểm tra GPS points liên tục, không teleport | P1 |
| VALID-03 | Distance Verification | So sánh distance từ GPS track vs declared distance, tolerance ±5% | P1 |
| VALID-04 | Duplicate Detection | Detect cùng 1 activity submit từ multiple sources hoặc submit 2 lần | P1 |
| VALID-05 | Time Window Check | Activity phải nằm trong thời gian diễn ra giải | P1 |
| VALID-06 | Treadmill Policy | Cho phép/từ chối activity không có GPS (tùy BTC cấu hình) | P1 |
| VALID-07 | Heart Rate Anomaly | Phát hiện HR bất thường (quá thấp so với pace = possible cheat) | P2 |
| VALID-08 | Speed Spike Detection | Phát hiện đoạn chạy nhanh bất thường (xe máy/ô tô chèn vào) | P2 |
| VALID-09 | Elevation Consistency | Cross-check elevation data vs map terrain data | P3 |
| VALID-10 | Community Flagging | Cho phép VĐV khác report activity khả nghi | P2 |

### Module 4: Event Management (Organizer)

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| EVENT-01 | Create Event | Wizard tạo giải: info, distances, rules, pricing, schedule | P1 |
| EVENT-02 | Event Lifecycle | Draft → Published → Registration Open → Live → Ended → Archived | P1 |
| EVENT-03 | Distance Configuration | Nhiều cự ly/giải, mỗi cự ly có giá, quota, rules riêng | P1 |
| EVENT-04 | Accumulation Mode | Giải tích lũy km qua nhiều ngày (vd: chạy 42km trong 30 ngày) | P1 |
| EVENT-05 | Single-Run Mode | Giải chạy 1 lần duy nhất (vd: chạy 10km 1 session) | P1 |
| EVENT-06 | Team Challenge | Tạo đội, team leaderboard, tổng km đội, min/max thành viên | P1 |
| EVENT-07 | Virtual Route Map | Upload GPX route, set checkpoints/landmarks, display progress on map | P2 |
| EVENT-08 | Event Cloning | Clone giải cũ → chỉnh sửa → publish nhanh | P2 |
| EVENT-09 | Custom Validation Rules | BTC set pace limits, GPS requirement, allowed sources per event | P1 |
| EVENT-10 | Participant Management | List/search/export VĐV, manual add/remove, assign bib | P1 |
| EVENT-11 | Activity Review | BTC duyệt/reject activity thủ công, bulk actions | P1 |
| EVENT-12 | Event Notifications | Email/push cho VĐV: nhắc nhở, cập nhật, kết quả | P2 |
| EVENT-13 | Whitelabel Event Page | BTC customize logo, colors, domain riêng | P3 |

### Module 5: Leaderboard & Results

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| LEAD-01 | Real-time Leaderboard | Xếp hạng cập nhật khi có activity mới, WebSocket/polling | P1 |
| LEAD-02 | Individual Ranking | Rank theo: tổng km, pace TB, thời gian hoàn thành | P1 |
| LEAD-03 | Team Ranking | Rank đội theo tổng km, TB km/người | P1 |
| LEAD-04 | Filter & Search | Filter theo cự ly, giới tính, nhóm tuổi; search theo tên/BIB | P1 |
| LEAD-05 | Runner Progress | Timeline progress cá nhân: km tích lũy, activities, pace trend | P1 |
| LEAD-06 | Final Results | Kết quả chính thức sau khi giải kết thúc, lock leaderboard | P1 |
| LEAD-07 | Global Leaderboard | Bảng xếp hạng toàn platform (tháng/quý/năm), không theo giải cụ thể | P2 |
| LEAD-08 | Comparison View | So sánh 2 runner side-by-side (reuse concept từ iRace) | P3 |

### Module 6: Registration & Payment

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| REG-01 | Event Registration | Chọn cự ly → điền thông tin → kết nối device → thanh toán | P1 |
| REG-02 | Free Events | Giải miễn phí, bỏ qua step thanh toán | P1 |
| REG-03 | Paid Events | Tích hợp payment: VNPay, MoMo, bank transfer (reuse 5Ticket) | P1 |
| REG-04 | Early Bird Pricing | Giá sớm → giá thường → giá muộn theo timeline | P2 |
| REG-05 | Promo Codes | Mã giảm giá, free entry codes | P2 |
| REG-06 | Group Registration | Đăng ký nhóm/doanh nghiệp, bulk import | P2 |
| REG-07 | Team Join/Create | Tạo đội mới hoặc join đội có sẵn bằng invite code | P1 |
| REG-08 | 5Ticket Integration | Đăng ký 5Run event qua 5Ticket (reuse checkout flow) | P2 |

### Module 7: Gamification & Rewards

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| GAME-01 | Achievement Badges | Huy chương cho milestones: 100km, 500km, 1000km, streak 7/30/100 ngày | P1 |
| GAME-02 | Event Badges | Badge hoàn thành giải: Finisher, Top 10, Top 3, Champion | P1 |
| GAME-03 | XP & Levels | Điểm kinh nghiệm tích lũy → level up → unlock rewards | P2 |
| GAME-04 | Streaks | Đếm ngày chạy liên tiếp, streak protection (1 skip cho phép) | P2 |
| GAME-05 | E-Certificate | Chứng nhận hoàn thành — canvas-based (reuse 5BIB pattern) | P1 |
| GAME-06 | E-Medal | Huy chương điện tử 3D, shareable image | P1 |
| GAME-07 | Physical Rewards | Huy chương vật lý, áo finisher, BIB — fulfillment tracking | P3 |
| GAME-08 | Points & Redemption | Tích điểm → đổi quà/voucher (partner integration) | P3 |

### Module 8: Social & Community

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| SOCIAL-01 | Public Profile | Profile runner công khai: stats, achievements, race history | P1 |
| SOCIAL-02 | Activity Feed | Feed hoạt động gần đây (như Strava feed nhưng cho 5Run) | P2 |
| SOCIAL-03 | Share Results | Share kết quả/certificate lên Facebook/Instagram/Zalo | P1 |
| SOCIAL-04 | Running Clubs | Tạo/join club chạy bộ, club leaderboard | P3 |
| SOCIAL-05 | Comments & Kudos | React/comment trên activity (like Strava kudos) | P3 |
| SOCIAL-06 | Challenge Friends | Thách đấu bạn bè: ai chạy nhiều hơn trong X ngày | P3 |

### Module 9: Organizer Analytics & Reports

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| ANALYTICS-01 | Registration Dashboard | Chart đăng ký theo ngày, conversion rate, doanh thu | P1 |
| ANALYTICS-02 | Activity Dashboard | Activities theo ngày, top runners, completion rate | P1 |
| ANALYTICS-03 | Demographic Insights | Giới tính, tuổi, tỉnh/thành phân bố VĐV | P2 |
| ANALYTICS-04 | Export Data | Export CSV/Excel danh sách VĐV, kết quả, activities | P1 |
| ANALYTICS-05 | Conversion Funnel | View → Register → Connect → First Activity → Complete | P2 |
| ANALYTICS-06 | Revenue Report | Tổng doanh thu, theo cự ly, theo ngày, reconciliation | P1 |

### Module 10: Admin (5Solution Internal)

| ID | Tính năng | Mô tả | Priority |
|----|-----------|-------|----------|
| ADMIN-01 | Event Moderation | Duyệt/reject giải do organizer tạo | P1 |
| ADMIN-02 | User Management | Quản lý user, ban/unban, activity audit | P1 |
| ADMIN-03 | Dispute Resolution | Xử lý khiếu nại VĐV bị reject activity, override validation | P1 |
| ADMIN-04 | Platform Analytics | Tổng users, events, revenue, active users, retention | P2 |
| ADMIN-05 | Integration Monitor | Dashboard theo dõi status Strava/Garmin/COROS sync, error rates | P1 |
| ADMIN-06 | Commission Config | Cấu hình phí platform per event/organizer | P1 |

---

## 6. Kill Strategies — Lợi thế cạnh tranh 5Run

### Kill Strategy #1: Unified Athlete Profile (5Run × 5BIB × 5Pix) — P1

**Mô tả:** Không đối thủ nào trên thế giới có thể kết hợp: Virtual race data + Physical race results + Race photos trong 1 profile VĐV duy nhất. 5Run làm được vì chia sẻ database với 5BIB (94K athletes) và 5Pix.

**Giá trị:**
- Runner đăng ký 5Run → profile tự động liên kết với 5BIB nếu đã có
- Race history hiển thị CẢ giải virtual (5Run) + giải thực tế (5BIB)
- Ảnh giải chạy từ 5Pix hiện trên profile
- Achievement badges tổng hợp: "Đã chạy 10 giải thực tế + 5 giải virtual"

**Tech:** MongoDB shared collections/cross-reference by athleteId, unified auth via JWT. NestJS module `athlete-profile` shared between services.

**Why competitors can't copy:** Phải xây 3 sản phẩm riêng biệt rồi merge — không ai sẵn sàng làm.

---

### Kill Strategy #2: Smart Anti-Cheat Engine — P1

**Mô tả:** KHÔNG đối thủ VN hay quốc tế nào có hệ thống anti-cheat nghiêm túc. 5Run build multi-layer validation engine:

**Layer 1 — Instant (sync-time):**
- Pace range check (configurable per event)
- Time window check (activity trong thời gian giải)
- Duplicate detection (same GPS track from different sources)

**Layer 2 — Async (background job):**
- GPS continuity analysis (teleport detection)
- Speed spike detection (xe máy/ô tô segments)
- Distance verification (GPS track distance vs declared ± 5%)

**Layer 3 — Community:**
- Flag/report system
- Admin review queue
- Appeal process

**Tech:** NestJS Bull queue cho async validation, Redis cache kết quả, MongoDB store validation results per activity. Reuse `@napi-rs/canvas` nếu cần render GPS map cho review.

**Why this wins:** VRun/vRace có ZERO validation → runner bất mãn vì leaderboard bị "cheat". 5Run = fair competition.

---

### Kill Strategy #3: 1-Click Sync, Zero-Friction Onboarding — P1

**Mô tả:** vRace bị rate 2.86/5 chủ yếu vì sync lỗi. 5Run phải PERFECT sync experience.

**Implementation:**
- OAuth flow → 1 click authorize → auto-detect tất cả activities trong time window
- Webhook receiver (Garmin/Strava) → instant sync, không cần user action
- GPX/FIT drag & drop upload as fallback
- Real-time `SyncStatus` indicator: "Connected ✅ | Syncing ⏳ | Error ❌"
- Auto-retry failed syncs (3 attempts, exponential backoff)
- Notification push: "Activity mới đã được ghi nhận!"

**Tech:** NestJS webhook controllers, Redis queue cho retry, WebSocket cho real-time status update.

---

### Kill Strategy #4: Organizer Self-Service + Whitelabel — P2

**Mô tả:** VRun yêu cầu liên hệ trực tiếp để tạo giải. vRace không có organizer dashboard. 5Run cung cấp self-service hoàn toàn.

**Features:**
- Wizard tạo giải (7 bước, xem chi tiết Module 4)
- Dashboard real-time: đăng ký, activities, completion, revenue
- Clone event (từ giải trước)
- Custom branding: logo, colors, certificate background
- Phase 2: Whitelabel với domain riêng (organizer.5run.vn → mydomain.com)
- Reuse 5Ticket payment infrastructure

**Tech:** Next.js App Router admin pages, MongoDB `events` collection, S3 cho assets, Redis cache cho dashboard metrics.

---

### Kill Strategy #5: Virtual Route Map with Real-Time Avatars — P2

**Mô tả:** Racery và Challenge Hound có route map nhưng KHÔNG real-time. 5Run build route map với avatar di chuyển real-time khi VĐV sync activities.

**Features:**
- BTC upload GPX route hoặc vẽ trên bản đồ (Mapbox Draw)
- Checkpoints/landmarks với tên + ảnh
- Avatar VĐV di chuyển theo km đã tích lũy
- Hover avatar → xem stats mini
- "Race replay" animation xem tiến trình toàn bộ giải

**Tech:** Mapbox GL JS, WebSocket cho position updates, MongoDB geospatial queries.

---

### Kill Strategy #6: Corporate Virtual Team Building Package — P2

**Mô tả:** VRun đã có doanh nghiệp lớn (VietinBank, Vietcombank). 5Run cần differentiate bằng UX tốt hơn + analytics cho leadership.

**Features:**
- Dedicated corporate dashboard
- Department/team structure (import from Excel)
- Internal leaderboard (không public)
- Executive report: participation rate, total distance, health metrics summary
- CSR integration: "Mỗi km = X VNĐ quyên góp"
- Branded event page with company logo/colors
- API for integration with HR systems

---

## 7. Technical Architecture Overview (cho PO reference)

### Stack (kế thừa 5BIB)

| Layer | Công nghệ | Ghi chú |
|-------|----------|---------|
| Backend | NestJS 10 | Shared codebase structure với 5BIB |
| Database | MongoDB (Mongoose) | Activity data, events, users |
| Cache | Redis | Leaderboard cache, sync queue, rate limiting |
| Storage | AWS S3 | Certificates, medals, route GPX files |
| Platform DB | MySQL 8 (TypeORM) | Shared platform data với 5BIB/5Ticket |
| Frontend (Public) | Next.js 16 App Router | SSR cho SEO, RSC cho performance |
| Frontend (Admin) | Next.js 16 + shadcn/ui | Reuse 5BIB admin patterns |
| API Layer | REST → OpenAPI → SDK | `@hey-api/openapi-ts` + TanStack Query |
| Real-time | WebSocket (Socket.io) | Leaderboard updates, sync status |
| Queue | Bull (Redis-backed) | Async validation, webhook processing |
| Maps | Mapbox GL JS | Route maps, GPS visualization |
| Canvas | @napi-rs/canvas | Certificate/medal generation |

### Key Collections (MongoDB)

```
events              — Giải chạy virtual
event_distances     — Cự ly trong mỗi giải
registrations       — Đăng ký VĐV vào giải
activities          — Hoạt động đã sync (core data)
activity_validations — Kết quả validation per activity
leaderboard_cache   — Cached leaderboard (Redis backup)
teams               — Đội tham gia giải
achievements        — Badge/medal definitions
user_achievements   — Badge đã unlock per user
certificates        — Certificate configs per event
device_connections  — OAuth tokens per user per provider
sync_logs           — Lịch sử sync (debug & audit)
```

### Key Redis Keys

```
leaderboard:{eventId}:{distanceId}    — Sorted set, score = total_km
sync-queue:{provider}                  — Bull queue per provider
sync-status:{userId}:{provider}        — Current sync state
rate-limit:{provider}:{appId}          — API rate limit counter
activity-lock:{externalId}             — Dedup lock (SETNX)
event-stats:{eventId}                  — Cached event statistics
```

---

## 8. Phân pha triển khai — Roadmap đề xuất

### Phase 1: MVP (8-10 tuần)
**Goal:** Launch với core virtual race experience — đủ để tổ chức 1 giải thử nghiệm

| Module | Features | Tuần |
|--------|----------|------|
| Auth | AUTH-01, AUTH-02, AUTH-03, AUTH-04 | 1-2 |
| Sync | SYNC-01 (Garmin), SYNC-04 (GPX/FIT), SYNC-05 (Manual), SYNC-06 (Dedup) | 2-4 |
| Validation | VALID-01 → VALID-06 | 3-4 |
| Events | EVENT-01 → EVENT-06, EVENT-09 → EVENT-11 | 3-6 |
| Leaderboard | LEAD-01 → LEAD-06 | 5-6 |
| Registration | REG-01, REG-02, REG-03, REG-07 | 5-6 |
| Gamification | GAME-01, GAME-02, GAME-05, GAME-06 | 7-8 |
| Social | SOCIAL-01, SOCIAL-03 | 7-8 |
| Analytics | ANALYTICS-01, ANALYTICS-02, ANALYTICS-04, ANALYTICS-06 | 8-9 |
| Admin | ADMIN-01 → ADMIN-03, ADMIN-05, ADMIN-06 | 8-10 |

**Deliverable:** 5Run v1.0 — web-based, Garmin sync + GPX upload, basic gamification, organizer dashboard

### Phase 2: Growth (8-12 tuần sau Phase 1)
**Goal:** Multi-platform sync, gamification đầy đủ, corporate features

| Features | Tuần |
|----------|------|
| SYNC-02 (COROS), SYNC-03 (Strava — tùy partnership result) | 1-3 |
| EVENT-07 (Virtual route map), EVENT-08, EVENT-12, EVENT-13 | 2-5 |
| VALID-07 → VALID-10 | 3-4 |
| REG-04 → REG-06, REG-08 (5Ticket integration) | 4-6 |
| GAME-03, GAME-04 | 5-6 |
| SOCIAL-02 (Activity feed) | 6-7 |
| ANALYTICS-03, ANALYTICS-05 | 7-8 |
| AUTH-05 (Unified 5Solution profile) | 8-10 |
| Kill Strategy #4 (Organizer whitelabel) | 8-12 |
| Kill Strategy #5 (Virtual route map with avatars) | 6-10 |
| Kill Strategy #6 (Corporate package) | 8-12 |

### Phase 3: Scale (6+ tháng sau Phase 2)
**Goal:** Mobile app, advanced features, market leadership

| Features |
|----------|
| Native mobile app (React Native hoặc Flutter) |
| SYNC-07 (Terra API), SYNC-08 (Apple Health/Samsung Health) |
| GAME-07 (Physical rewards/fulfillment), GAME-08 (Points/redemption) |
| SOCIAL-04 → SOCIAL-06 (Clubs, comments, challenges) |
| LEAD-07, LEAD-08 |
| ADMIN-04 |
| AI pace prediction / training recommendations |
| Live audio feedback (viRACE-inspired) |

---

## 9. Competitive Score — 5Run vs Market

| Dimension | VRun | vRace | iRace | Challenge Hound | Best International | 5Run MVP | 5Run Phase 2 |
|-----------|------|-------|-------|----------------|-------------------|-----------|-------------|
| Multi-source sync | 4/10 | 3/10 | 4/10 | 7/10 | 8/10 (viRACE) | 6/10 | 9/10 |
| Anti-cheat | 1/10 | 1/10 | 1/10 | 1/10 | 2/10 | 7/10 | 9/10 |
| Leaderboard UX | 6/10 | 5/10 | 5/10 | 6/10 | 7/10 | 8/10 | 9/10 |
| Organizer tools | 5/10 | 2/10 | 3/10 | 6/10 | 8/10 (RunSignup) | 7/10 | 9/10 |
| Gamification | 2/10 | 3/10 | 2/10 | 2/10 | 4/10 (42Race) | 6/10 | 8/10 |
| Mobile experience | 3/10 | 4/10 | 3/10 | 2/10 | 6/10 (viRACE) | 7/10 | 8/10 |
| Ecosystem integration | 1/10 | 1/10 | 1/10 | 1/10 | 1/10 | 8/10 | 10/10 |
| Virtual route map | 1/10 | 1/10 | 1/10 | 7/10 | 8/10 (Racery) | 2/10 | 8/10 |
| Corporate features | 6/10 | 3/10 | 2/10 | 7/10 | 5/10 | 5/10 | 8/10 |
| **TỔNG** | **29/90** | **23/90** | **22/90** | **39/90** | **50/90** | **56/90** | **78/90** |

**5Run MVP (Phase 1) đã vượt tất cả đối thủ VN và ngang Challenge Hound. Phase 2 dẫn đầu thị trường toàn cầu nhờ ecosystem integration + anti-cheat.**

---

## 10. PAUSE Items — Cần Danny quyết định trước khi PO viết PRD

| # | Câu hỏi | Ảnh hưởng |
|---|---------|-----------|
| 1 | **Strava integration approach?** (Direct partnership / Terra API / GPX-only / Hybrid) | Quyết định toàn bộ architecture SYNC module |
| 2 | **Tên miền 5Run?** (5run.vn? run.5bib.com? app.5run.vn?) | Route structure, CORS config, SSL |
| 3 | **Repo riêng hay monorepo với 5BIB?** | CI/CD, shared code strategy |
| 4 | **Mobile app Phase 1 hay Phase 3?** | Scope MVP, team allocation |
| 5 | **Payment gateway:** Reuse 5Ticket (VNPay/MoMo) hay cần thêm? | REG-03 implementation |
| 6 | **Physical rewards (medal vật lý)?** Phase mấy? Partner fulfillment nào? | GAME-07 scope |
| 7 | **Terra API budget?** Nếu dùng, cần estimate cost per user | SYNC-07 feasibility |
| 8 | **Target giải chạy pilot đầu tiên?** (Tên, thời gian, scale) | MVP deadline |
| 9 | **Garmin Developer Program:** Đã apply chưa? Cần Danny submit application | SYNC-01 blocker |
| 10 | **COROS API:** Đã apply chưa? | SYNC-02 blocker |

---

## 11. Sources

### Đối thủ Việt Nam
- [VRun.vn](https://vrun.vn/)
- [vRace.com.vn](https://vrace.com.vn/)
- [iRace.vn](https://irace.vn/)
- [vRace on Google Play](https://play.google.com/store/apps/details?id=fpt.vne.vrace) — Rating 2.86/5

### Đối thủ quốc tế
- [Challenge Hound](https://www.challengehound.com/)
- [Racery](https://racery.com/) — [$9-13/racer pricing](https://racery.com/blog/platform-features-and-fees/)
- [viRACE](https://virace.app/en)
- [DistantRace](https://distantrace.com/en/)
- [Medal Dash](https://www.medaldash.com/)
- [42Race](https://42race.com/)
- [RunSignup Virtual](https://runsignup.com/Race/GoVirtual/Page/VirtualRaceDay)
- [NYRR Virtual Racing Powered by Strava](https://www.nyrr.org/run/virtual-racing)

### API & Technical
- [Strava API Documentation](https://developers.strava.com/docs/)
- [Strava Webhook Events API](https://developers.strava.com/docs/webhooks/)
- [Strava API Agreement](https://www.strava.com/legal/api) — ⚠️ Virtual race restriction
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)
- [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/)
- [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api/)
- [Garmin Activity API](https://developer.garmin.com/gc-developer-program/activity-api/)
- [COROS API Application](https://support.coros.com/hc/en-us/articles/17085887816340-Submitting-an-API-Application)
- [Terra API](https://tryterra.co) — Fitness data aggregator
- [Terra API Docs](https://docs.tryterra.co)
