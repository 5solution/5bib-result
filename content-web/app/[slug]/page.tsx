import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Share2, Heart } from "lucide-react";
import { fetchArticleBySlug, fetchCategories } from "@/lib/api";
import { ArticleCard } from "@/components/ArticleCard";
import { TOC } from "@/components/TOC";
import { HelpfulVote } from "@/components/HelpfulVote";
import { formatDate, siteUrl } from "@/lib/utils";
import { categoryName } from "@/lib/category-resolver";

export const revalidate = 600;

interface PageParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);
  if (!article) return { title: "Không tìm thấy bài viết" };

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;
  const url = `${siteUrl()}/${article.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      images: article.coverImageUrl
        ? [{ url: article.coverImageUrl, width: 1200, height: 630, alt: title }]
        : [],
      publishedTime: article.publishedAt ?? undefined,
      authors: article.authorName ? [article.authorName] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: article.coverImageUrl ? [article.coverImageUrl] : [],
    },
  };
}

export default async function ArticleDetailPage({ params }: PageParams) {
  const { slug } = await params;
  const [article, categories] = await Promise.all([
    fetchArticleBySlug(slug),
    fetchCategories(),
  ]);
  if (!article) notFound();

  const categoryMap = new Map(categories.map((c) => [c.slug, c]));
  const displayCategory = categoryName(categoryMap, article.category);

  const helpfulTotal = article.helpfulYes + article.helpfulNo;
  const helpfulPct =
    helpfulTotal > 0 ? Math.round((article.helpfulYes / helpfulTotal) * 100) : 0;

  return (
    <article className="bg-[var(--5s-bg)]">
      {/* Breadcrumb */}
      <div className="border-b border-[var(--5s-border)] bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center gap-2 px-8 py-3.5 text-sm text-[var(--5s-text-muted)]">
          <Link href="/" className="font-semibold text-[var(--5s-blue)]">
            Trung tâm trợ giúp
          </Link>
          <ChevronRight className="size-3" />
          {displayCategory && (
            <>
              <Link
                href={`/danh-muc/${article.category}`}
                className="font-semibold hover:underline"
              >
                {displayCategory}
              </Link>
              <ChevronRight className="size-3" />
            </>
          )}
          <span className="truncate font-semibold text-[var(--5s-text)]">
            {article.title}
          </span>
        </div>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-[920px] px-8 pb-8 pt-12 md:pt-16">
        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white ${
              article.type === "news" ? "bg-[var(--5s-energy)]" : "bg-[var(--5s-blue)]"
            }`}
          >
            {article.type === "news" ? "📰 Tin tức" : "📖 Hướng dẫn"}
          </span>
          {displayCategory && (
            <span className="rounded-full bg-[var(--5s-surface)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--5s-text-muted)]">
              {displayCategory}
            </span>
          )}
          {article.products.map((p) => (
            <span
              key={p}
              className="rounded-full bg-[var(--5s-surface-2)] px-3 py-1 font-mono text-[11px] font-extrabold uppercase tracking-wider"
            >
              {p}
            </span>
          ))}
        </div>

        <h1
          className="mb-5 font-[var(--font-display)] font-black tracking-tight"
          style={{
            fontSize: "clamp(32px, 4.6vw, 52px)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          {article.title}
        </h1>

        {article.excerpt && (
          <p
            className="mb-7 max-w-[760px] text-lg leading-relaxed text-[var(--5s-text-muted)]"
            style={{ textWrap: "pretty" }}
          >
            {article.excerpt}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3.5 border-b border-[var(--5s-border)] pb-7">
          {article.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.authorAvatar}
              alt=""
              className="size-11 rounded-full border-2 border-[var(--5s-border)]"
            />
          ) : (
            <div className="grid size-11 place-items-center rounded-full bg-[var(--5s-surface)] text-sm font-bold">
              {(article.authorName?.[0] ?? "?").toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="text-sm font-extrabold">
              {article.authorName || "5BIB Team"}
            </div>
            <div className="flex gap-2 text-xs text-[var(--5s-text-muted)]">
              <span>Đăng {formatDate(article.publishedAt)}</span>
              <span className="opacity-50">·</span>
              <span>{article.readTimeMinutes} phút đọc</span>
              {article.viewCount > 0 && (
                <>
                  <span className="opacity-50">·</span>
                  <span>{article.viewCount.toLocaleString("vi-VN")} lượt xem</span>
                </>
              )}
            </div>
          </div>
          <ShareButtons title={article.title} url={`${siteUrl()}/${article.slug}`} />
        </div>
      </section>

      {/* Cover image */}
      {article.coverImageUrl && (
        <section className="mx-auto max-w-[1100px] px-8">
          <div
            className="aspect-[16/8] overflow-hidden rounded-[18px] border border-[var(--5s-border)] bg-cover bg-center shadow-[0_20px_60px_-20px_rgba(28,25,23,0.18)]"
            style={{ backgroundImage: `url(${article.coverImageUrl})` }}
            role="img"
            aria-label={article.title}
          />
        </section>
      )}

      {/* Body + TOC */}
      <section className="mx-auto max-w-[1100px] px-8 pt-12">
        <div className="grid gap-14 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
            <TOC items={article.tableOfContents} />
            {helpfulTotal > 5 && (
              <div className="mt-6 rounded-xl bg-[var(--5s-blue-50)] p-3.5 text-xs leading-snug text-[var(--5s-blue)]">
                💡 Bài viết hữu ích?
                <br />
                <b>{article.helpfulYes} người</b> ({helpfulPct}%) đánh giá có ích.
              </div>
            )}
          </aside>

          <div>
            {/* Mobile TOC fallback */}
            {article.tableOfContents.length > 0 && (
              <details className="mb-6 rounded-xl border border-[var(--5s-border)] bg-white p-4 lg:hidden">
                <summary className="cursor-pointer text-sm font-extrabold">
                  📑 Mục lục bài viết
                </summary>
                <div className="mt-3">
                  <TOC items={article.tableOfContents} />
                </div>
              </details>
            )}

            <div
              className="prose-article"
              // Sanitized server-side by sanitize-html in backend articles.service.
              // Safe to inject as innerHTML.
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            <HelpfulVote
              slug={article.slug}
              initialYes={article.helpfulYes}
              initialNo={article.helpfulNo}
            />
          </div>
        </div>
      </section>

      {/* Related */}
      {article.related.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-8 pt-20">
          <h2 className="mb-6 font-[var(--font-display)] text-3xl font-black uppercase tracking-tight">
            Bài viết liên quan
          </h2>
          <div className="stagger grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {article.related.map((a) => (
              <ArticleCard key={a.slug} article={a} categoryMap={categoryMap} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function ShareButtons({ title, url }: { title: string; url: string }) {
  // Server-rendered Facebook + Twitter intent links — no JS needed.
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  return (
    <div className="flex gap-2">
      <a
        href={fb}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--5s-border)] bg-white px-3.5 py-2 text-[13px] font-bold transition-colors hover:border-[var(--5s-blue)]"
        aria-label="Chia sẻ Facebook"
      >
        <Share2 className="size-3.5" />
        Chia sẻ
      </a>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--5s-border)] bg-white px-3.5 py-2 text-[13px] font-bold transition-colors hover:border-[var(--5s-blue)]"
        // No state — Phase 2 bookmark feature
      >
        <Heart className="size-3.5" />
        Lưu
      </button>
      <a
        href={tw}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden"
        aria-hidden
      />
    </div>
  );
}
