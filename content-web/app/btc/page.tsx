import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchArticleList, fetchCategories } from "@/lib/api";
import { ArticleCard } from "@/components/ArticleCard";
import { siteUrl } from "@/lib/utils";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Dành cho BTC giải chạy",
  description:
    "Tài nguyên dành cho Ban tổ chức giải chạy: tích hợp 5BIB Result, quản lý đăng ký, đối soát, in BIB, certificate.",
  alternates: { canonical: `${siteUrl()}/btc` },
};

export default async function BtcPage() {
  // Pull help articles tagged for race organizers — Phase 1: load all help, will
  // filter by category="dành cho btc" once admin tags content.
  const [list, categories] = await Promise.all([
    fetchArticleList({ type: "help", limit: 12 }),
    fetchCategories(),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.slug, c]));

  return (
    <>
      <section
        className="relative overflow-hidden py-16 text-white"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1B2238 100%)" }}
      >
        <div
          className="absolute -right-24 top-0 size-96 rounded-full opacity-20"
          style={{ background: "var(--5s-blue)", filter: "blur(80px)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1100px] px-8">
          <span className="inline-block rounded-full bg-[var(--5s-blue)]/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
            🏁 Dành cho Race Organizer
          </span>
          <h1 className="mt-4 max-w-3xl font-[var(--font-display)] text-4xl font-black uppercase tracking-tight md:text-5xl">
            Tài nguyên cho BTC giải chạy
          </h1>
          <p className="mt-3 max-w-2xl text-base opacity-85">
            Tích hợp 5BIB Result vào giải của bạn. Quản lý đăng ký, đối soát,
            kết quả live, certificate — tất cả trên một nền tảng.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="https://5sport.vn"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--5s-blue)] px-5 py-2.5 text-sm font-bold transition-colors hover:bg-[var(--5s-blue-600)]"
            >
              Đăng ký dùng 5Sport <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/lien-he"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-2.5 text-sm font-bold"
            >
              Liên hệ team Sales
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-8 py-12">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Đăng ký giải dễ dàng",
              desc: "Form đăng ký đa cự ly, thanh toán qua thẻ/chuyển khoản, xuất danh sách Excel.",
              icon: "📋",
            },
            {
              title: "Kết quả live",
              desc: "Đồng bộ data từ chip timing, hiển thị leaderboard real-time, certificate auto.",
              icon: "🏆",
            },
            {
              title: "Đối soát minh bạch",
              desc: "Reconciliation tự động, export DOCX/XLSX, audit trail đầy đủ.",
              icon: "📊",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-[var(--5s-border)] bg-white p-5"
            >
              <div className="mb-3 grid size-12 place-items-center rounded-lg bg-[var(--5s-blue-50)] text-2xl">
                {card.icon}
              </div>
              <div className="mb-1 text-base font-extrabold">{card.title}</div>
              <div className="text-sm leading-snug text-[var(--5s-text-muted)]">
                {card.desc}
              </div>
            </div>
          ))}
        </div>

        {list.items.length > 0 && (
          <>
            <h2 className="mb-5 mt-12 font-[var(--font-display)] text-2xl font-black uppercase tracking-tight">
              Tài liệu hướng dẫn
            </h2>
            <div className="stagger grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {list.items.map((a) => (
                <ArticleCard key={a.slug} article={a} categoryMap={categoryMap} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
