import { fetchCategories } from "./api";
import type { ArticleCategory } from "./types";

/**
 * In-memory cache of categories within a single request lifecycle.
 * Each Server Component invocation calls fetchCategories() (Next.js dedupes
 * the underlying fetch via its built-in fetch cache + ISR tags), but we still
 * memoize the map building to avoid redundant work.
 */
export type CategoryMap = Map<string, ArticleCategory>;

/**
 * Build a slug→category map from the full categories list.
 * Returns empty map on error (graceful fallback — slugs render as raw text).
 */
export async function getCategoryMap(): Promise<CategoryMap> {
  try {
    const cats = await fetchCategories();
    return new Map(cats.map((c) => [c.slug, c]));
  } catch {
    return new Map();
  }
}

/** Get display name for a category slug, fallback to prettified slug. */
export function categoryName(map: CategoryMap, slug: string | undefined): string {
  if (!slug) return "";
  const cat = map.get(slug);
  if (cat?.name) return cat.name;
  // Fallback: prettify slug "khieu-nai" → "Khiếu nại" can't be done generically.
  // Just title-case the slug-with-spaces — better than uppercase raw slug.
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/** Get tint hex for category slug, fallback to brand blue. */
export function categoryTint(map: CategoryMap, slug: string | undefined): string {
  if (!slug) return "var(--5s-blue)";
  return map.get(slug)?.tint ?? "var(--5s-blue)";
}

/** Get icon for category slug, fallback to folder emoji. */
export function categoryIcon(map: CategoryMap, slug: string | undefined): string {
  if (!slug) return "📁";
  return map.get(slug)?.icon ?? "📁";
}
