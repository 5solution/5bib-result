import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { siteUrl } from "@/lib/utils";
import { BugReportForm } from "./_components/BugReportForm";

export const metadata: Metadata = {
  title: "Báo lỗi sản phẩm",
  description:
    "Báo lỗi sản phẩm 5BIB — gửi mô tả chi tiết để dev fix nhanh. Phản hồi trong 30 phút – 4 giờ tùy mức độ khẩn cấp.",
  alternates: { canonical: `${siteUrl()}/lien-he/bao-loi` },
};

const SLA_ROWS = [
  { sev: "🔴 Khẩn cấp", desc: "Mất data / không vào được hệ thống", target: "≤ 30 phút" },
  { sev: "🟠 Cao", desc: "Chức năng chính hỏng (đăng ký, kết quả)", target: "≤ 4 giờ" },
  { sev: "🟡 Trung bình", desc: "Lỗi UI, hiển thị sai", target: "≤ 1 ngày" },
  { sev: "🟢 Thấp", desc: "Góp ý, đề xuất tính năng", target: "≤ 7 ngày" },
];

export default function BugReportPage() {
  return (
    <>
      <section className="border-b border-[var(--5s-border)] bg-white py-10">
        <div className="mx-auto max-w-[1100px] px-8">
          <nav className="mb-3 flex items-center gap-1.5 text-[12px] text-[var(--5s-text-muted)]">
            <Link href="/" className="hover:text-[var(--5s-blue)]">
              Trang chủ
            </Link>
            <ChevronRight className="size-3.5" />
            <Link href="/lien-he" className="hover:text-[var(--5s-blue)]">
              Liên hệ
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-semibold text-[var(--5s-text)]">Báo lỗi</span>
          </nav>
          <span className="inline-block rounded-full bg-[var(--5s-blue-50)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--5s-blue)]">
            🐞 Báo lỗi sản phẩm
          </span>
          <h1 className="mt-3 font-[var(--font-display)] text-3xl font-black uppercase tracking-tight md:text-4xl">
            Giúp 5BIB tốt hơn
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-[var(--5s-text-muted)]">
            Mô tả lỗi bạn gặp càng chi tiết càng tốt — dev sẽ fix nhanh hơn.
            5BIB cam kết phản hồi mọi báo cáo trong vòng SLA tương ứng.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-8 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-[var(--5s-border)] bg-white p-7">
            <BugReportForm />
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-[var(--5s-border)] bg-white p-5">
              <h2 className="mb-3 font-[var(--font-display)] text-base font-extrabold tracking-tight">
                ⏱ Thời gian phản hồi
              </h2>
              <div className="space-y-2.5">
                {SLA_ROWS.map((r) => (
                  <div key={r.sev} className="border-t border-[var(--5s-border)] pt-2.5 first:border-t-0 first:pt-0">
                    <div className="text-[13px] font-extrabold">{r.sev}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--5s-text-muted)]">
                      {r.desc}
                    </div>
                    <div className="mt-1 font-mono text-[12px] font-bold text-[var(--5s-blue)]">
                      {r.target}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-900">
                ⚠ Trước khi báo lỗi
              </div>
              <p className="text-[13px] leading-snug text-amber-900">
                Hãy kiểm tra{" "}
                <Link href="/" className="underline">
                  Trung tâm trợ giúp
                </Link>{" "}
                — hơn 90% câu hỏi đã có sẵn câu trả lời.
              </p>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-5 text-white">
              <div className="mb-1 text-xs font-extrabold uppercase tracking-wider opacity-70">
                Cần giúp gấp?
              </div>
              <div className="mb-3 font-[var(--font-display)] text-lg font-extrabold">
                Mở Zalo OA
              </div>
              <p className="mb-3 text-[12px] leading-snug opacity-80">
                Đính kèm ảnh chụp + chat trực tiếp với support — phản hồi {"<"} 5 phút giờ hành chính.
              </p>
              <a
                href="https://zalo.me/1496901851017205971"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--5s-magenta)] px-3.5 py-2 text-xs font-bold transition-colors hover:bg-[var(--5s-magenta-dim)]"
              >
                Mở Zalo OA →
              </a>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
