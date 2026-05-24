/**
 * FAQ data — timing.5bib.com
 * SOURCE: research-mkt-brief.md § 1.C Q1..Q10 — verbatim quote per BR-07.
 * Phase 1: vi-VN only. EN version Phase 2.
 *
 * FEATURE-060
 */

import type { FAQItem } from '../faq-jsonld';

export const timingFaqs: FAQItem[] = [
  {
    q: 'Chi phí thuê dịch vụ chip timing cho 1 giải chạy 1000 VĐV khoảng bao nhiêu?',
    a: 'Dao động 35–90 triệu VND tuỳ số điểm timing mat, format giải (road/trail), live tracking on/off, và loại chip (disposable/reusable). 5BIB cam kết phản hồi báo giá chi tiết trong 24h sau khi nhận brief.',
  },
  {
    q: '5BIB dùng thiết bị timing của hãng nào?',
    a: '5BIB là đối tác chính thức của RaceResult (Đức) — hãng timing được dùng tại Berlin Marathon, UTMB, Ironman. Hệ thống đo bằng RFID UHF, chip dán BIB, độ chính xác ±0.1 giây end-to-end (theo World Athletics TR19.2 standard cho passive UHF chip timing), với decoder timestamp resolution 1ms.',
  },
  {
    q: 'Chip time và gun time khác nhau như thế nào?',
    a: 'Gun time tính từ tiếng súng xuất phát; chip time tính từ lúc VĐV băng qua start mat. VĐV xuất phát từ wave sau có thể có chip time nhanh hơn nhưng gun time chậm hơn. World Athletics ranking dùng gun time, podium age-group thường dùng chip time.',
  },
  {
    q: '5BIB đã làm timing cho bao nhiêu giải?',
    a: 'Tính đến tháng 5/2026, 5BIB đã triển khai timing cho 195 giải chạy, hỗ trợ 94,000+ VĐV finisher, trải dài từ giải nội bộ doanh nghiệp đến marathon quốc gia 5000+ slot.',
  },
  {
    q: 'Dịch vụ có bao gồm in BIB và phát BIB không?',
    a: 'Có. Gói timing standard của 5BIB bao gồm thiết kế BIB, in offset/laser, dán chip RFID, đóng gói bib-bag, và phương án phát BIB tại race-pack pickup hoặc race day.',
  },
  {
    q: 'Có live tracking website cho khán giả không?',
    a: 'Có. Mọi giải timing bởi 5BIB đều có trang result live trên domain `result.5bib.com/{slug-giai}` — cập nhật theo SSE real-time, hỗ trợ search BIB/tên, leaderboard theo course, share certificate ảnh.',
  },
  {
    q: 'Sai số timing của 5BIB là bao nhiêu?',
    a: 'Độ chính xác ±0.1 giây end-to-end (theo World Athletics TR19.2 standard cho passive UHF chip timing), với decoder timestamp resolution 1ms — đáp ứng chuẩn World Athletics / AIMS cho chứng nhận PB. Sai số end-to-end đã bao gồm sync clock giữa các mat.',
  },
  {
    q: '5BIB có timing được giải trail / ultra trail nhiều CP không?',
    a: 'Có. Đã triển khai tại các giải ultra trail 70K+ với 6–10 checkpoint, dùng mat di động + repeater 4G/Starlink ở vùng không sóng. Hỗ trợ cut-off automation và DNF detection.',
  },
  {
    q: 'Cần đặt dịch vụ timing trước race day bao lâu?',
    a: 'Tối thiểu 30 ngày để đảm bảo logistics (vận chuyển thiết bị, sản xuất BIB, training crew). Race quy mô lớn (3000+ VĐV) hoặc trail địa hình phức tạp nên book trước 60 ngày.',
  },
  {
    q: 'Có thể dùng timing 5BIB cho pickleball / cầu lông không?',
    a: 'Có hệ riêng tại `solution.5sport.vn` cho racquet sports — không dùng chip RFID mà dùng match-scoring console + bracket software. Liên hệ team 5Sport.',
  },
];
