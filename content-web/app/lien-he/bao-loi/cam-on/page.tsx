import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Cảm ơn bạn",
  description: "Báo lỗi của bạn đã được tiếp nhận.",
  robots: { index: false, follow: false },
};

interface SearchParams {
  searchParams: Promise<{ id?: string }>;
}

export default async function ThankYouPage({ searchParams }: SearchParams) {
  const sp = await searchParams;
  const publicId = sp.id?.trim() ?? "";
  const isValid = /^BUG-\d{8}-\d{4}$/.test(publicId);

  return (
    <section className="mx-auto max-w-[720px] px-8 py-20">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-10 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-100">
          <CheckCircle2 className="size-9 text-emerald-700" />
        </div>
        <h1 className="font-[var(--font-display)] text-3xl font-black uppercase tracking-tight">
          Đã nhận báo cáo
        </h1>
        <p className="mt-3 text-[15px] text-[var(--5s-text-muted)]">
          Cảm ơn bạn đã giúp 5BIB tốt hơn. Đội support đã được thông báo và sẽ
          phản hồi trong khung SLA tương ứng.
        </p>

        {isValid ? (
          <div className="mx-auto mt-6 inline-block rounded-xl border border-[var(--5s-border)] bg-white px-5 py-4">
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--5s-text-muted)]">
              Mã báo cáo
            </div>
            <div className="font-mono text-2xl font-extrabold tracking-tight text-[var(--5s-blue)]">
              {publicId}
            </div>
            <div className="mt-1 text-[11px] text-[var(--5s-text-muted)]">
              Lưu lại mã này để follow up qua Zalo / email
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-6 inline-block rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-[12px] text-amber-900">
            Mã báo cáo không hợp lệ — vui lòng kiểm tra email confirmation.
          </div>
        )}

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/lien-he/bao-loi"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--5s-border)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--5s-text)] hover:border-[var(--5s-blue)]"
          >
            Báo cáo lỗi khác
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--5s-blue)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--5s-blue-600)]"
          >
            Về trung tâm trợ giúp <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
