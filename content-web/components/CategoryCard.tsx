import Link from "next/link";
import type { ArticleCategory } from "@/lib/types";

export function CategoryCard({ category }: { category: ArticleCategory }) {
  return (
    <Link
      href={`/danh-muc/${category.slug}`}
      className="card-hover relative flex items-start gap-4 overflow-hidden rounded-xl border border-[var(--5s-border)] bg-[var(--5s-bg)] p-5"
    >
      <div
        className="absolute -right-5 -top-5 size-24 rounded-full opacity-10"
        style={{ background: category.tint }}
        aria-hidden
      />
      <div
        className="grid size-11 shrink-0 place-items-center rounded-xl text-xl text-white"
        style={{ background: category.tint }}
      >
        {category.icon}
      </div>
      <div className="relative flex-1">
        <h3 className="mb-1 font-[var(--font-display)] text-base font-extrabold tracking-tight">
          {category.name}
        </h3>
        {category.description && (
          <p className="mb-2 text-[13px] leading-snug text-[var(--5s-text-muted)]">
            {category.description}
          </p>
        )}
        <div
          className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider"
          style={{ color: category.tint }}
        >
          {category.articleCount} bài viết →
        </div>
      </div>
    </Link>
  );
}
