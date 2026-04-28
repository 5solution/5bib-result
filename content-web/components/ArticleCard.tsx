import Link from "next/link";
import type { ArticleCardDto } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { categoryName, type CategoryMap } from "@/lib/category-resolver";

interface Props {
  article: ArticleCardDto;
  variant?: "grid" | "compact";
  /** Optional slug→category lookup; falls back to prettified slug if absent. */
  categoryMap?: CategoryMap;
}

export function ArticleCard({ article, variant = "grid", categoryMap }: Props) {
  const displayCategory = categoryMap
    ? categoryName(categoryMap, article.category)
    : article.category;
  // B-27: deterministic gradient fallback when coverImageUrl missing/broken.
  // Hash slug → pick from a small palette for visual variety without random.
  const gradientFallback = pickGradient(article.slug);

  if (variant === "compact") {
    return (
      <Link
        href={`/${article.slug}`}
        className="card-hover flex gap-3.5 rounded-xl border border-[var(--5s-border)] bg-white p-3.5"
      >
        <div
          className="size-[100px] shrink-0 rounded-lg bg-cover bg-center"
          style={{
            background: article.coverImageUrl
              ? undefined
              : gradientFallback,
            backgroundImage: article.coverImageUrl
              ? `url(${article.coverImageUrl})`
              : undefined,
          }}
        />
        <div className="flex flex-1 flex-col">
          <TypePill type={article.type} small />
          <h4 className="mt-1.5 line-clamp-2 font-[var(--font-display)] text-[15px] font-extrabold leading-tight">
            {article.title}
          </h4>
          <div className="mt-auto flex items-center gap-2 text-xs text-[var(--5s-text-muted)]">
            <span>{formatDate(article.publishedAt)}</span>
            <span className="opacity-50">·</span>
            <span>{article.readTimeMinutes} phút</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/${article.slug}`}
      className="card-hover flex flex-col overflow-hidden rounded-xl border border-[var(--5s-border)] bg-white"
    >
      <div
        className="relative aspect-[16/10] bg-cover bg-center"
        style={{
          background: article.coverImageUrl ? undefined : gradientFallback,
          backgroundImage: article.coverImageUrl
            ? `url(${article.coverImageUrl})`
            : undefined,
        }}
      >
        <div className="absolute left-2.5 top-2.5">
          <TypePill type={article.type} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {displayCategory && (
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--5s-blue)]">
            {displayCategory}
          </div>
        )}
        <h3 className="mb-2 line-clamp-2 min-h-[44px] font-[var(--font-display)] text-[17px] font-extrabold leading-tight">
          {article.title}
        </h3>
        <p className="mb-3 line-clamp-2 text-[13px] leading-snug text-[var(--5s-text-muted)]">
          {article.excerpt}
        </p>
        <div className="mt-auto flex items-center gap-2.5 border-t border-[var(--5s-border)] pt-3 text-xs text-[var(--5s-text-muted)]">
          {article.authorAvatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.authorAvatar}
              alt=""
              className="size-6 rounded-full"
            />
          )}
          {article.authorName && (
            <span className="font-semibold text-[var(--5s-text)]">
              {article.authorName}
            </span>
          )}
          <span className="opacity-50">·</span>
          <span>{formatDate(article.publishedAt)}</span>
          <span className="ml-auto font-mono font-bold">
            {article.readTimeMinutes}m
          </span>
        </div>
      </div>
    </Link>
  );
}

// Stable hash → pick a brand-aligned gradient when no cover image exists.
const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #1D49FF 0%, #0026B3 100%)",
  "linear-gradient(135deg, #FF0E65 0%, #B30040 100%)",
  "linear-gradient(135deg, #EA580C 0%, #92400E 100%)",
  "linear-gradient(135deg, #16A34A 0%, #166534 100%)",
  "linear-gradient(135deg, #1B2238 0%, #0F172A 100%)",
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length];
}

function TypePill({ type, small }: { type: "news" | "help"; small?: boolean }) {
  const colors =
    type === "news"
      ? "bg-[var(--5s-energy)] text-white"
      : "bg-[var(--5s-blue)] text-white";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 font-extrabold uppercase tracking-wider ${colors} ${
        small ? "py-0.5 text-[10px]" : "py-1 text-[11px]"
      }`}
    >
      {type === "news" ? "📰 Tin tức" : "📖 Hướng dẫn"}
    </span>
  );
}
