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
- [ ] [HIGH] Telegram thông báo khi admin xử lý khiếu nại (thông báo vào một group id), chỉ sử dụng telegraf (không start bot) để dùng cho nhiều dự án
- [x] [HIGH] Tìm kiếm BIB/tên trên homepage xuyên suốt tất cả các giải
- [ ] [HIGH] So sánh thành tích 2+ VDV cùng cự ly
- [ ] [NORMAL] Admin claim detail page — xem chi tiết khiếu nại, preview tracklog
- [ ] [NORMAL] Hiển thị bản đồ GPX trên trang course detail (Mapbox/Leaflet)
- [ ] [NORMAL] Auto-refresh ranking khi race đang live (poll 30s)
- [ ] [NORMAL] Share result dạng hình ảnh cho social media
- [ ] [NORMAL] PWA support — xem kết quả offline
- [ ] [NORMAL] Tự động fill Khiếu nại kết quả họ tên của người chạy
- [ ] [NORMAL] Giải đang diễn ra và đã kết thúc sẽ hiển thị thêm nationality theo cờ, ví dụ trong response có     "Nationality": "France", thì convert thành cờ ở races/{slug} hoặc 
- [ ] [LOW] Dark mode toggle
- [ ] [LOW] Export kết quả CSV/Excel từ admin
- [ ] [LOW] Tích hợp gallery ảnh với 5Pix

## Done
- [x] [HIGH] Phần khiếu nại của user — form trên trang athlete detail, upload tracklog (GPX/KML/FIT), require SĐT, backend schema updated (phone + attachments), admin hiển thị SĐT + tệp đính kèm
- [x] [HIGH] Per-race sponsors — backend raceId field, GET /sponsors/race/:raceId, admin tab quản lý NTT per race, frontend ranking page hiển thị to theo level (diamond/gold/silver)
- [x] [NORMAL] Pre-race event page — upcoming races show course details (start time, COT, elevation, start location) instead of results table, organizer + description info block
- [x] [NORMAL] Live race timer — reusable LiveTimer component shows elapsed time since race start, displayed on race detail hero and ranking page status bar
- [x] [HIGH] Tìm kiếm BIB/tên trên homepage xuyên suốt tất cả các giải — backend globalSearch endpoint + frontend /search page with grouped results by race

