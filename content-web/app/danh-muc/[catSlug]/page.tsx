import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { fetchArticleList, fetchCategories } from "@/lib/api";
import { ArticleCard } from "@/components/ArticleCard";
import { siteUrl } from "@/lib/utils";

export const revalidate = 300;

interface PageParams {
  params: Promise<{ catSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { catSlug } = await params;
  const cats = await fetchCategories();
  const cat = cats.find((c) => c.slug === catSlug);
  const name = cat?.name ?? catSlug;
  return {
    title: `${name} — Hướng dẫn 5BIB`,
    description: cat?.description || `Bài viết hướng dẫn về ${name}`,
    alternates: { canonical: `${siteUrl()}/danh-muc/${catSlug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageParams) {
  const { catSlug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr ?? 1) || 1);

  const [cats, list] = await Promise.all([
    fetchCategories(),
    fetchArticleList({ category: catSlug, page, limit: 12 }),
  ]);
  const cat = cats.find((c) => c.slug === catSlug);
  if (!cat && list.items.length === 0) notFound();

  const categoryMap = new Map(cats.map((c) => [c.slug, c]));
  const tint = cat?.tint ?? "var(--5s-blue)";

  return (
    <>
      {/* Category hero */}
      <section
        className="relative overflow-hidden py-16 text-white"
        style={{ background: tint }}
      >
        <div
          className="absolute -right-20 -top-20 size-80 rounded-full opacity-25"
          style={{ background: "white", filter: "blur(80px)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[1100px] px-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold opacity-85 hover:opacity-100"
          >
            <ChevronRight className="size-3 rotate-180" />
            Trung tâm trợ giúp
          </Link>
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-white/15 text-3xl backdrop-blur">
              {cat?.icon ?? "📁"}
            </div>
            <div>
              <h1 className="font-[var(--font-display)] text-4xl font-black uppercase tracking-tight md:text-5xl">
                {cat?.name ?? catSlug}
              </h1>
              {cat?.description && (
                <p className="mt-2 text-base opacity-90">{cat.description}</p>
              )}
              <div className="mt-3 text-xs font-extrabold uppercase tracking-wider opacity-75">
                {list.total} bài viết
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Article grid */}
      <section className="mx-auto max-w-[1200px] px-8 py-12">
        {list.items.length === 0 ? (
          <div className="rounded-xl border border-[var(--5s-border)] bg-white p-16 text-center text-[var(--5s-text-muted)]">
            <div className="text-4xl opacity-30">📂</div>
            <div className="mt-2 text-base font-medium">
              Chưa có bài viết nào trong danh mục này
            </div>
          </div>
        ) : (
          <>
            <div className="stagger grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {list.items.map((a) => (
                <ArticleCard key={a.slug} article={a} categoryMap={categoryMap} />
              ))}
            </div>

            {list.totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={list.totalPages}
                catSlug={catSlug}
              />
            )}
          </>
        )}
      </section>
    </>
  );
}

function Pagination({
  page,
  totalPages,
  catSlug,
}: {
  page: number;
  totalPages: number;
  catSlug: string;
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-center gap-1.5"
    >
      {pages.map((p) => (
        <Link
          key={p}
          href={`/danh-muc/${catSlug}${p === 1 ? "" : `?page=${p}`}`}
          className={`min-w-9 rounded-md border px-3 py-2 text-center text-sm font-bold transition-colors ${
            p === page
              ? "border-[var(--5s-blue)] bg-[var(--5s-blue)] text-white"
              : "border-[var(--5s-border)] bg-white hover:border-[var(--5s-blue)]"
          }`}
        >
          {p}
        </Link>
      ))}
    </nav>
  );
}
