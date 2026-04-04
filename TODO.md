# 5BIB Result - TODO

## Loop Instructions

### LOOP ENTRY POINT:

- Đọc CLAUDE.md toàn bộ trước khi làm bất cứ điều gì
- Đọc TODO.md để biết trạng thái hiện tại
- Đọc file tree để hiểu codebase structure

### TASK SELECTION LOGIC:

- Ưu tiên tasks có label [CRITICAL] trước
- Sau đó tasks [HIGH], rồi [NORMAL]
- Nếu task quá lớn (ước tính >2h), tự break nhỏ và thêm subtasks vào TODO.md trước khi làm

### IMPLEMENTATION GATE (làm xong mỗi task phải pass):

- [ ] Code chạy được, không có syntax error
- [ ] Đã viết/update test liên quan
- [ ] Đã update TODO.md — move task từ [ ] sang [x]
- [ ] Commit message đúng convention

### PAUSE CONDITIONS:

- Cần thay đổi database schema
- Cần thêm dependency mới vào package.json
- Task liên quan đến payment, auth, hay security
- (Nếu không cần Pause thì chỉ cần tự động commit và không hỏi thêm gì)

### LOOP CONTINUATION:

- Nếu còn task trong TODO.md → tự pick task tiếp theo
- Nếu hết task → tạo PROGRESS_REPORT.md và brainstorm cho các improvement rồi update vào TODO.md để tiếp tục cho lần sau
- Nếu Context quá 90% tự động chạy /compact
- Nếu Usage quá 90% tự skip, đợi vòng sau

---

## In Progress

## Todo

- [x] [HIGH] Tùy chỉnh ảnh kết quả — ResultImageEditor modal: 5 preset gradient backgrounds + upload ảnh nền tùy chỉnh, preview real-time, tải PNG
- [x] [NORMAL] Hiển thị nationality ở course card trên races/[slug] — backend trả nationalityCount trong getCourseStats, frontend hiện "🌍 N quốc gia" trên stats banner
- [x] [NORMAL] Vinh danh Top 3 — hạng 1/2/3 có UI đặc biệt trên ranking page: medal emoji, gradient badge, highlighted row bg, colored left border, bolder name
- [ ] [LOW] Tích hợp gallery ảnh với 5Pix — cần biết API/endpoint của 5Pix (BLOCKED)
- [x] [NORMAL] Thay placeholder PWA icons (192x192, 512x512) bằng logo 5BIB thật — resized từ logo.png
- [x] [NORMAL] Pace chart trên athlete detail — biểu đồ pace qua các checkpoint (đã có horizontal bar chart với fastest/slowest highlighting)
- [ ] [LOW] QR code BIB lookup — scan QR tại event → redirect trang kết quả VĐV
- [ ] [LOW] Email notification kết quả — gửi email cho VĐV sau khi giải kết thúc
- [ ] [LOW] Social proof — hiển thị số lượt xem kết quả, số lần chia sẻ

## Done

- [x] [HIGH] Phần khiếu nại của user — form trên trang athlete detail, upload tracklog (GPX/KML/FIT), require SĐT, backend schema updated (phone + attachments), admin hiển thị SĐT + tệp đính kèm
- [x] [HIGH] Per-race sponsors — backend raceId field, GET /sponsors/race/:raceId, admin tab quản lý NTT per race, frontend ranking page hiển thị to theo level (diamond/gold/silver)
- [x] [HIGH] Tìm kiếm BIB/tên trên homepage xuyên suốt tất cả các giải — backend globalSearch endpoint + frontend /search page with grouped results by race
- [x] [HIGH] So sánh thành tích 2+ VDV cùng cự ly — checkbox selection on ranking page, floating compare bar, compare page with split times & overall summary
- [x] [NORMAL] Pre-race event page — upcoming races show course details (start time, COT, elevation, start location) instead of results table, organizer + description info block
- [x] [NORMAL] Live race timer — reusable LiveTimer component shows elapsed time since race start, displayed on race detail hero and ranking page status bar
- [x] [NORMAL] Admin claim detail page — xem chi tiết khiếu nại, preview ảnh inline, clickable rows
- [x] [NORMAL] Auto-refresh ranking khi race đang live (poll 30s)
- [x] [NORMAL] Tự động fill Khiếu nại kết quả họ tên của người chạy
- [x] [NORMAL] Hiển thị nationality theo cờ quốc gia — countryToFlag utility, ranking/athlete/search pages
- [x] [LOW] Export kết quả CSV/Excel từ admin — download button per course trên admin race detail
- [x] [HIGH] Telegram thông báo khi admin xử lý khiếu nại — TelegramService (telegraf, không start bot), NotificationModule, tự động gửi vào group khi resolve/reject claim
- [x] [NORMAL] Hiển thị bản đồ GPX trên trang course detail — GpxMap component (Leaflet), dynamic import, parse GPX XML, start/finish markers
- [x] [NORMAL] Share result dạng hình ảnh cho social media — html2canvas-pro, hidden share card, native Web Share API + download fallback
- [x] [NORMAL] PWA support — @serwist/next service worker, web app manifest, offline caching
