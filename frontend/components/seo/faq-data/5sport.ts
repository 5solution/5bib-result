/**
 * FAQ data — solution.5sport.vn
 * SOURCE: research-mkt-brief.md § 4.C Q1..Q10 — verbatim quote per BR-14b.
 * Phase 1: vi-VN only.
 *
 * FEATURE-060
 */

import type { FAQItem } from '../faq-jsonld';

export const sportFaqs: FAQItem[] = [
  {
    q: '5Sport hỗ trợ những format giải nào?',
    a: 'Single elimination, double elimination, round robin, pool play + knockout, ladder ranking, team league. Auto-generate bracket lên tới 256 đội, hỗ trợ seeding theo DUPR-style rating nội bộ.',
  },
  {
    q: 'Phí dùng 5Sport là bao nhiêu?',
    a: 'Transaction fee 5–8% trên mỗi entry fee bán qua platform. Giải free entry hoặc CLB nội bộ có gói flat 500K–2M VND/giải tuỳ quy mô. Không phí setup, không subscription.',
  },
  {
    q: 'Có app cho VĐV không?',
    a: 'Có PWA mobile (không cần cài app) cho VĐV: xem bracket live, lịch trận của mình, push notification "5 phút nữa vào sân", live score, check-in QR. iOS/Android native trên roadmap Q3/2026.',
  },
  {
    q: 'Tính rating VĐV theo hệ nào?',
    a: 'Internal rating dùng Elo-based algorithm khởi tạo + adjust theo kết quả từng trận, hiển thị 4 chữ số (vd 4.250). Tương đồng concept DUPR/UTPR. VĐV có thể link tài khoản DUPR để import baseline.',
  },
  {
    q: 'Tổ chức được giải bao nhiêu VĐV tối đa?',
    a: 'Đã test thực tế 256 đội (512 VĐV cho đôi) với 8 sân song song. Theo lý thuyết platform handle 1024 đội với bracket sharding. Live scoring throughput 80 trận đồng thời.',
  },
  {
    q: 'Live score hiển thị ở đâu?',
    a: 'Public URL `tournament.5sport.vn/{giải-slug}` — viewer xem bracket + score real-time, không cần đăng nhập. Có chế độ "TV mode" cho màn hình lớn ở venue (auto rotate match → bracket → leaderboard).',
  },
  {
    q: 'Có matchmaking ngoài giải đấu không?',
    a: 'Có. Community module cho phép VĐV tự tìm bạn chơi theo rating ± 0.5, theo geo (cùng quận/thành phố), book sân chung. Open beta 5/2026 tại HCM + HN.',
  },
  {
    q: 'CLB cầu lông quản lý hội viên dùng được không?',
    a: 'Có. Club module: roster hội viên, fee quarterly/yearly tracking, lịch tập, internal ladder ranking, group chat. Phí 300K VND/CLB/tháng cho ≤200 hội viên.',
  },
  {
    q: 'Mục tiêu năm 2026 của 5Sport?',
    a: 'Target 50 giải pickleball + cầu lông trên platform, 10K VĐV unique đăng ký, 30 CLB active dùng club module. Đến 5/2026 đang ramp-up post-launch với 8 giải pilot.',
  },
  {
    q: '5Sport có khác gì so với PicklePlay hay tournament software global?',
    a: 'Native Việt Nam (UI VN, thanh toán VNPay/MoMo, support VN giờ hành chính), tích hợp ecosystem 5Solution (cross-sell sponsor + 5Ticket cho event opening), cost thấp hơn 30–50% tournament software US/EU. Bracket UI tối ưu mobile-first.',
  },
];
