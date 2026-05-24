/**
 * FAQ data — 5solution.vn
 * SOURCE: research-mkt-brief.md § 3.C Q1..Q10 — verbatim quote per BR-12b.
 * Phase 1: vi-VN only.
 *
 * FEATURE-060
 */

import type { FAQItem } from '../faq-jsonld';

export const fiveSolutionFaqs: FAQItem[] = [
  {
    q: '5Solution là gì?',
    a: '5Solution là holding công nghệ sự kiện thể thao Việt Nam, sở hữu 5 sản phẩm: 5BIB (race timing + registration), 5Ticket (sàn vé sự kiện), 5Pix (ảnh giải chạy AI), 5Sport (pickleball + cầu lông community), 5Tech (AI face search + computer vision). Tính đến 5/2026: 195 giải, 42K orders.',
  },
  {
    q: '5BIB và 5Ticket khác nhau như thế nào?',
    a: '5BIB chuyên sâu giải chạy (race-specific: BIB, wave, chip timing, course, certificate). 5Ticket là sàn vé tổng quát (concert, hội thảo, sự kiện thể thao non-race như giải đấu, gala). Cùng một merchant có thể dùng cả 2.',
  },
  {
    q: '5Solution có hợp tác với liên đoàn thể thao chính thức không?',
    a: 'Có. 5Solution là đối tác công nghệ của nhiều giải thuộc hệ thống Liên đoàn điền kinh và Sở VHTT các tỉnh. RaceResult Đức partnership chính thức tại VN.',
  },
  {
    q: 'Quy mô 5Solution tính đến nay?',
    a: '195 giải tổ chức (timing hoặc registration), 42,000+ order tickets/BIB, 120K+ runner unique reach, 100+ giải chip timing, 58 merchant tenant active, footprint toàn quốc 63 tỉnh.',
  },
  {
    q: 'Doanh nghiệp muốn tổ chức event nội bộ thì dùng sản phẩm nào?',
    a: 'Tuỳ format. Fun run nội bộ → 5BIB Solution (gói whitelabel). Gala / hội nghị / launch event → 5Ticket. Pickleball tournament công ty → 5Sport. Có thể bundle.',
  },
  {
    q: '5Solution có gọi vốn chưa?',
    a: '5Solution hiện ở giai đoạn bootstrap / early-revenue, đang mở vòng strategic round 2026 cho nhà đầu tư quan tâm sports tech Đông Nam Á. Liên hệ qua trang invest@5solution.vn.',
  },
  {
    q: 'Làm sao trở thành sponsor giải chạy thuộc 5BIB?',
    a: 'Liên hệ sponsorship@5solution.vn với brand brief + objective (awareness/lead-gen/sampling). 5BIB ecosystem reach 120K+ runner active; có gói diamond/gold/silver theo từng race hoặc annual package multi-race.',
  },
  {
    q: '5Solution có làm whitelabel cho công ty khác không?',
    a: 'Có. Whitelabel race tech / ticketing / photo cho enterprise client (logo riêng, domain riêng, palette riêng) — phí flat hoặc revenue share tuỳ scope. Đã triển khai cho 5+ enterprise brand.',
  },
  {
    q: '5Tech là gì trong hệ sinh thái?',
    a: '5Tech là R&D arm cung cấp AI face recognition cho 5Pix (tìm ảnh theo gương mặt), computer vision counting cho 5BIB (athlete tracking), và OCR cho 5Ticket (scan giấy tờ). Tech stack: Python + ONNX + AWS Rekognition fallback.',
  },
  {
    q: 'Roadmap 2026 của 5Solution?',
    a: 'Q2/26: launch 5Sport pickleball+cầu lông platform. Q3/26: 5Pix AI face search GA toàn quốc. Q4/26: 5Tech compute platform mở SDK cho 3rd-party giải chạy. Target end-2026: 300 giải, 200K runner.',
  },
];
