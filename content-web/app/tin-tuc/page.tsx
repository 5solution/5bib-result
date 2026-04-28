import type { Metadata } from "next";
import Link from "next/link";
import { fetchArticleList, fetchCategories } from "@/lib/api";
import { ArticleCard } from "@/components/ArticleCard";
import { siteUrl } from "@/lib/utils";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Tin tức 5BIB",
  description:
    "Tin tức mới nhất về các giải chạy, sản phẩm 5BIB, 5Sport, 5Ticket và cộng đồng running Việt Nam.",
  alternates: { canonical: `${siteUrl()}/tin-tuc` },
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; type?: string }>;
}

export default async function NewsArchivePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  // B-20: default to "all" instead of "news" — most users browsing /tin-tuc
  // expect to see ALL content; news-only often returns empty when site is
  // primarily help-doc focused.
  const type: "news" | "help" | undefined =
    sp.type === "help" ? "help" : sp.type === "news" ? "news" : undefined;

  const [list, categories] = await Promise.all([
    fetchArticleList({ type, page, limit: 12 }),
    fetchCategories(),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.slug, c]));

  // B-21: H1 reflects active filter so user knows what they're browsing.
  const h1Text = sp.q
    ? `Kết quả: "${sp.q}"`
    : type === "news"
      ? "Tin tức"
      : type === "help"
        ? "Hướng dẫn"
        : "Tất cả bài viết";

  return (
    <>
      <section className="border-b border-[var(--5s-border)] bg-white py-12">
        <div className="mx-auto max-w-[1200px] px-8">
          <h1 className="font-[var(--font-display)] text-4xl font-black uppercase tracking-tight md:text-5xl">
            {h1Text}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-[var(--5s-text-muted)]">
            {sp.q
              ? "Tìm kiếm full-text sẽ ra mắt Phase 2 — hiện tại hiển thị toàn bộ bài viết."
              : "Cập nhật từ các giải chạy, sản phẩm 5BIB và cộng đồng running Việt Nam."}
          </p>

          {/* Type filter tabs */}
          <div className="mt-6 flex gap-2">
            {[
              { key: "all", label: "Tất cả" },
              { key: "help", label: "📖 Hướng dẫn" },
              { key: "news", label: "📰 Tin tức" },
            ].map((t) => {
              const active = (t.key === "all" && !type) || type === t.key;
              return (
                <Link
                  key={t.key}
                  href={`/tin-tuc?type=${t.key}`}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                    active
                      ? "border-[var(--5s-text)] bg-[var(--5s-text)] text-white"
                      : "border-[var(--5s-border)] bg-white text-[var(--5s-text)] hover:border-[var(--5s-blue)]"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-8 py-12">
        {list.items.length === 0 ? (
          <div className="rounded-xl border border-[var(--5s-border)] bg-white p-16 text-center text-[var(--5s-text-muted)]">
            <div className="text-4xl opacity-30">📰</div>
            <div className="mt-2 text-base font-medium">Chưa có bài viết nào</div>
          </div>
        ) : (
          <>
            <div className="stagger grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {list.items.map((a) => (
                <ArticleCard key={a.slug} article={a} categoryMap={categoryMap} />
              ))}
            </div>
            {list.totalPages > 1 && (
              <div className="mt-10 flex justify-center gap-1.5">
                {Array.from({ length: list.totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={`/tin-tuc?type=${type ?? "all"}${p === 1 ? "" : `&page=${p}`}`}
                    className={`min-w-9 rounded-md border px-3 py-2 text-center text-sm font-bold transition-colors ${
                      p === page
                        ? "border-[var(--5s-blue)] bg-[var(--5s-blue)] text-white"
                        : "border-[var(--5s-border)] bg-white hover:border-[var(--5s-blue)]"
                    }`}
                  >
                    {p}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
