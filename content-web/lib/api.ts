import type {
  ArticleCardDto,
  ArticleCategory,
  ArticleDetailDto,
  PaginatedArticles,
} from "./types";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8081";
const API_KEY = process.env.ARTICLES_API_KEY ?? "";

if (!API_KEY && process.env.NODE_ENV !== "test") {
  // Don't throw — let pages render skeleton + log warning. Allows local dev
  // without key to at least see UI shell. Prod must have the key set.
  console.warn(
    "[content-web] ARTICLES_API_KEY env not set — widget endpoints will 401",
  );
}

interface FetchOpts {
  /** ISR revalidation in seconds. Pass 0 to opt out (use sparingly). */
  revalidate?: number;
  /** Tags for on-demand revalidation via revalidateTag(). */
  tags?: string[];
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Server-side fetch wrapper. Injects X-API-Key from env (NEVER from client).
 * Use this from Server Components and Route Handlers only.
 */
async function api<T>(
  path: string,
  opts: FetchOpts = {},
  withKey = true,
): Promise<T> {
  const url = `${BACKEND_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (withKey && API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }

  const res = await fetch(url, {
    headers,
    next: {
      revalidate: opts.revalidate ?? 300,
      ...(opts.tags ? { tags: opts.tags } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, `${res.status} ${path} — ${text.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

// ─── Public widget endpoints (require X-API-Key) ────────────────────

export async function fetchLatestArticles(
  query: { type?: "news" | "help"; product?: string; limit?: number } = {},
): Promise<ArticleCardDto[]> {
  const qs = new URLSearchParams();
  if (query.type) qs.set("type", query.type);
  if (query.product) qs.set("product", query.product);
  if (query.limit) qs.set("limit", String(query.limit));
  const path = `/api/articles/latest${qs.toString() ? `?${qs}` : ""}`;
  try {
    return await api<ArticleCardDto[]>(path, { revalidate: 300, tags: ["articles-list"] });
  } catch {
    return [];
  }
}

export async function fetchArticleList(
  query: {
    type?: "news" | "help";
    product?: string;
    category?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<PaginatedArticles> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const path = `/api/articles${qs.toString() ? `?${qs}` : ""}`;
  try {
    return await api<PaginatedArticles>(path, { revalidate: 120, tags: ["articles-list"] });
  } catch {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }
}

export async function fetchCategories(
  type?: "news" | "help",
): Promise<ArticleCategory[]> {
  const path = `/api/article-categories${type ? `?type=${type}` : ""}`;
  try {
    return await api<ArticleCategory[]>(path, { revalidate: 300, tags: ["categories"] });
  } catch {
    return [];
  }
}

// ─── Public open endpoints (no key) ──────────────────────────────────

/**
 * Article detail — open endpoint (no API key). Returns null on 404 so pages
 * can render Next.js notFound() cleanly.
 */
export async function fetchArticleBySlug(slug: string): Promise<ArticleDetailDto | null> {
  try {
    return await api<ArticleDetailDto>(
      `/api/articles/${encodeURIComponent(slug)}`,
      { revalidate: 600, tags: [`article:${slug}`] },
      false, // no API key needed for SEO bots
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export { ApiError };
