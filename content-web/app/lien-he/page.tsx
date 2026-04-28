import type { Metadata } from "next";
import { siteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Liên hệ 5BIB",
  description:
    "Kênh liên hệ chính thức 5BIB: Hotline, Email, Zalo OA, báo lỗi. Phản hồi trong 5 phút trên Zalo, 30 phút qua email.",
  alternates: { canonical: `${siteUrl()}/lien-he` },
};

const CHANNELS = [
  {
    icon: "💚",
    title: "Zalo OA 5BIB",
    primary: "Zalo Official 5BIB",
    sub: "Phản hồi < 5 phút giờ hành chính",
    href: "https://zalo.me/1496901851017205971",
    cta: "Mở Zalo",
    disabled: false,
  },
  {
    icon: "✉",
    title: "Email Support",
    primary: "info@5bib.com",
    sub: "Phản hồi trong 30 phút (giờ hành chính)",
    href: "mailto:info@5bib.com",
    cta: "Gửi email",
    disabled: false,
  },
  {
    icon: "☎",
    title: "Hotline",
    primary: "0373 398 986",
    sub: "7h–22h hằng ngày",
    href: "tel:0373398986",
    cta: "Gọi ngay",
    disabled: false,
  },
  {
    icon: "🐞",
    title: "Báo lỗi sản phẩm",
    primary: "Form báo lỗi",
    sub: "Mô tả chi tiết để dev fix nhanh — phản hồi trong SLA tương ứng",
    href: "/lien-he/bao-loi",
    cta: "Mở form",
    disabled: false,
  },
];

const SLAS = [
  {
    label: "Mức độ khẩn cấp",
    items: [
      { label: "🔴 Khẩn cấp", desc: "Mất data / không nhận được BIB / không vào được giải", target: "≤ 30 phút" },
      { label: "🟡 Bình thường", desc: "Lỗi UI, câu hỏi sử dụng, đổi thông tin", target: "≤ 4 giờ" },
      { label: "🟢 Góp ý", desc: "Đề xuất tính năng, phản hồi UX", target: "≤ 1 ngày" },
    ],
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-[var(--5s-border)] bg-white py-14">
        <div className="mx-auto max-w-[1200px] px-8 text-center">
          <span className="inline-block rounded-full bg-[var(--5s-blue-50)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--5s-blue)]">
            ✉️ Đội Support 5BIB
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl font-[var(--font-display)] text-4xl font-black uppercase tracking-tight md:text-5xl">
            Cần hỗ trợ?<br />Chúng tôi ở đây.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-[var(--5s-text-muted)]">
            Phản hồi trong 5 phút trên Zalo, 30 phút qua email. 24/7 không nghỉ
            các ngày giải chạy lớn.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((c) => (
            <a
              key={c.title}
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="card-hover relative flex flex-col rounded-xl border border-[var(--5s-border)] bg-white p-6"
            >
              {c.disabled && (
                <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                  Sắp ra mắt
                </span>
              )}
              <div className="mb-4 grid size-14 place-items-center rounded-xl border border-[var(--5s-border)] bg-[var(--5s-bg)] text-3xl">
                {c.icon}
              </div>
              <div className="mb-1 text-xs font-extrabold uppercase tracking-wider text-[var(--5s-text-muted)]">
                {c.title}
              </div>
              <div className="mb-1.5 text-base font-extrabold text-[var(--5s-text)]">
                {c.primary}
              </div>
              <div className="mb-4 text-xs leading-snug text-[var(--5s-text-muted)]">
                {c.sub}
              </div>
              <div className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-[var(--5s-blue)]">
                {c.cta} →
              </div>
            </a>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {SLAS.map((sla) => (
            <div
              key={sla.label}
              className="rounded-xl border border-[var(--5s-border)] bg-white p-6 lg:col-span-2"
            >
              <h2 className="mb-4 font-[var(--font-display)] text-xl font-extrabold tracking-tight">
                {sla.label}
              </h2>
              <div className="space-y-3">
                {sla.items.map((it) => (
                  <div key={it.label} className="flex items-start gap-4 border-t border-[var(--5s-border)] pt-3 first:border-t-0 first:pt-0">
                    <div className="w-32 shrink-0 text-sm font-extrabold">
                      {it.label}
                    </div>
                    <div className="flex-1 text-sm text-[var(--5s-text-muted)]">
                      {it.desc}
                    </div>
                    <div className="shrink-0 font-mono text-sm font-bold text-[var(--5s-blue)]">
                      {it.target}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-900">
              ⚠ Trước khi liên hệ
            </div>
            <p className="text-sm leading-snug text-amber-900">
              Hãy kiểm tra <a href="/" className="underline">Trung tâm trợ giúp</a> trước —
              hơn 90% câu hỏi đã có sẵn câu trả lời + hướng dẫn chi tiết.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
