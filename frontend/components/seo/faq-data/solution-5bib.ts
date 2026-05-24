/**
 * FAQ data — solution.5bib.com
 * SOURCE: research-mkt-brief.md § 2.C Q1..Q10 — verbatim quote per BR-10b.
 * Phase 1: vi-VN only.
 *
 * FEATURE-060
 */

import type { FAQItem } from '../faq-jsonld';

export const solutionFaqs: FAQItem[] = [
  {
    q: 'Phí dùng 5BIB Solution là bao nhiêu?',
    a: 'Mô hình transaction fee — không phí setup, không subscription. 5BIB thu phí trên mỗi BIB bán (3–6% tuỳ scale + cổng thanh toán). Giải free entry hoặc nội bộ doanh nghiệp có gói whitelabel flat-fee, liên hệ sales.',
  },
  {
    q: 'Bao lâu thì launch được cổng đăng ký?',
    a: '72 giờ cho race standard (1 course, 1 ngôn ngữ, VNPay/MoMo). Race phức tạp (multi-course, multi-language, custom branding, sponsor tier) thường 5–7 ngày.',
  },
  {
    q: 'Tích hợp được cổng thanh toán nào?',
    a: 'Native VNPay, MoMo, ZaloPay, OnePay, bank QR. Có thể bật Stripe/PayPal cho giải có VĐV nước ngoài. Tất cả qua 1 dashboard reconciliation, đối soát T+1.',
  },
  {
    q: '5BIB Solution đã chạy bao nhiêu giải?',
    a: '195 giải chạy được host trên platform (5/2026), reach 120K+ runner unique, phục vụ 58 merchant tenant (BTC + agency).',
  },
  {
    q: 'Có hỗ trợ wave start không?',
    a: 'Có. Tạo unlimited wave với capacity cap, time slot, criteria (PB, age group, ngẫu nhiên). VĐV chọn wave khi đăng ký hoặc admin assign tự động. Hỗ trợ in BIB theo wave color-code.',
  },
  {
    q: 'Email marketing có giới hạn không?',
    a: 'Không giới hạn email theo gói whitelabel. Transaction tier có 3 chiến dịch broadcast/tháng miễn phí, đính kèm Mailchimp connector cho gói nâng cao. Open-rate trung bình của race email trên 5BIB là 42%.',
  },
  {
    q: 'Check-in race pack pickup hoạt động như thế nào?',
    a: 'VĐV nhận email/SMS có QR code sau khi pay. Tại pickup booth, crew scan QR (mobile PWA app, không cần cài app), tự động in BIB từ máy in nhiệt và đánh dấu đã nhận. Throughput 60–80 VĐV/phút/booth.',
  },
  {
    q: 'Có dashboard analytics cho BTC không?',
    a: 'Có. Dashboard real-time: doanh thu theo giờ, breakdown theo course/wave/payment method, conversion funnel landing → checkout, geo heatmap VĐV, top discount code. Export CSV/Excel mọi báo cáo.',
  },
  {
    q: 'Có dùng subdomain riêng được không?',
    a: 'Có. Whitelabel tier hỗ trợ custom domain (`dangky.giai-cua-ban.vn`) với SSL Let\'s Encrypt tự động, custom logo, palette màu, font. Transaction tier dùng `{race-slug}.5bib.com`.',
  },
  {
    q: 'Bao nhiêu ngôn ngữ được hỗ trợ?',
    a: 'Native VN + EN. Có thể thêm JP, KR, CN, TH cho giải international. Translation pack được provide bởi 5BIB hoặc BTC custom override từng key.',
  },
];
