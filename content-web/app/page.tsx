import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchArticleList, fetchCategories, fetchLatestArticles } from "@/lib/api";
import { ArticleCard } from "@/components/ArticleCard";
import { CategoryCard } from "@/components/CategoryCard";
import { HeroSearch } from "@/components/HeroSearch";
import { categoryName } from "@/lib/category-resolver";

export const revalidate = 300;

export default async function HomePage() {
  // Parallel fetches
  const [latest, categories, allList] = await Promise.all([
    fetchLatestArticles({ limit: 12 }),
    fetchCategories(),
    fetchArticleList({ limit: 9, page: 1 }),
  ]);

  // B-15: build slug→category map; pass to children for human-readable names.
  const categoryMap = new Map(categories.map((c) => [c.slug, c]));

  const featured = latest.find((a) => a.featured) ?? latest[0];
  const otherLatest = latest.filter((a) => a.slug !== featured?.slug).slice(0, 4);
  const featuredCategoryDisplay = featured ? categoryName(categoryMap, featured.category) : "";

  return (
    <>
      {/* ── Hero with search ── */}
      <section className="topo relative overflow-hidden bg-gradient-to-br from-[#0B36E6] via-[#1D49FF] to-[#0026B3] py-16 text-white md:py-24">
        <div
          className="absolute -right-32 -top-24 size-[480px] rounded-full opacity-20"
          style={{ background: "var(--5s-magenta)", filter: "blur(110px)" }}
          aria-hidden
        />
        <div
          className="absolute -bottom-40 -left-24 size-[420px] rounded-full opacity-30"
          style={{ background: "var(--5s-blue)", filter: "blur(90px)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-[920px] px-8 text-center">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-wider backdrop-blur">
            ★ HELP CENTER · hotro.5bib.com
          </span>
          <h1
            className="mt-5 font-[var(--font-display)] font-black uppercase tracking-tight"
            style={{
              fontSize: "clamp(38px, 5.4vw, 64px)",
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              textShadow: "0 2px 20px rgba(0,0,0,0.2)",
            }}
          >
            Bạn cần giúp đỡ
            <br />
            về điều gì hôm nay?
          </h1>
          <p className="mx-auto mt-4 max-w-[580px] text-[17px] leading-relaxed opacity-85">
            Hướng dẫn, mẹo và câu trả lời cho mọi runner — từ lần đầu chạy 5K
            đến hoàn thành Ultra Trail.
          </p>
          <div className="mt-8">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* ── Categories grid (overlap card) ── */}
      {categories.length > 0 && (
        <section className="relative mx-auto -mt-11 max-w-[1200px] px-8">
          <div className="rounded-[20px] border border-[var(--5s-border)] bg-white p-8 shadow-[0_20px_60px_-20px_rgba(28,25,23,0.18)]">
            <div className="mb-6 flex items-baseline justify-between">
              <div>
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--5s-magenta)]">
                  — Duyệt theo chủ đề
                </div>
                <h2 className="font-[var(--font-display)] text-[32px] font-black uppercase tracking-tight">
                  Danh mục trợ giúp
                </h2>
              </div>
              <span className="font-mono text-sm text-[var(--5s-text-muted)]">
                {categories.length} chủ đề · {categories.reduce((s, c) => s + c.articleCount, 0)} bài viết
              </span>
            </div>
            <div className="stagger grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <CategoryCard key={c.id} category={c} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Featured + latest ── */}
      {featured && (
        <section className="mx-auto max-w-[1200px] px-8 pt-20">
          <div className="mb-6 flex items-baseline justify-between">
            <div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--5s-magenta)]">
                — Mới cập nhật
              </div>
              <h2 className="font-[var(--font-display)] text-4xl font-black uppercase tracking-tight">
                Hướng dẫn nổi bật
              </h2>
            </div>
            <Link
              href="/tin-tuc"
              className="inline-flex items-center gap-1 text-sm font-bold text-[var(--5s-blue)]"
            >
              Xem tất cả <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="stagger grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* Featured card (big) */}
            <Link
              href={`/${featured.slug}`}
              className="card-hover relative flex min-h-[480px] flex-col justify-end overflow-hidden rounded-[18px] text-white"
              style={{
                // B-27: branded gradient fallback when cover image missing/broken.
                background: featured.coverImageUrl
                  ? "#000"
                  : "linear-gradient(135deg, #0B36E6 0%, #1D49FF 50%, #0026B3 100%)",
              }}
            >
              {featured.coverImageUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${featured.coverImageUrl})` }}
                />
              )}
              {/* Stronger gradient — covers cases where the cover image
                  itself contains light text/typography that competes with
                  the overlaid title. Bottom half is near-solid black so
                  white text reads regardless of underlying image. */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/20" />
              <div className="absolute left-5 top-5 flex gap-2">
                <span className="rounded-full bg-[var(--5s-magenta)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
                  ★ Featured
                </span>
                {featuredCategoryDisplay && (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur">
                    📖 {featuredCategoryDisplay}
                  </span>
                )}
              </div>
              <div className="relative p-8">
                <h3
                  className="mb-3.5 font-[var(--font-display)] font-black tracking-tight"
                  style={{
                    fontSize: "clamp(26px, 2.6vw, 36px)",
                    lineHeight: 1.05,
                    letterSpacing: "-0.025em",
                    // Layered shadow: tight + spread + diffuse — guarantees
                    // contrast even when bg image directly behind title is
                    // similar luminance to the text.
                    textShadow:
                      "0 1px 2px rgba(0,0,0,0.85), 0 2px 14px rgba(0,0,0,0.7), 0 0 28px rgba(0,0,0,0.5)",
                  }}
                >
                  {featured.title}
                </h3>
                <p
                  className="mb-5 max-w-[540px] text-[15px] leading-snug opacity-95"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
                >
                  {featured.excerpt}
                </p>
                <div className="flex items-center gap-3 text-xs font-semibold opacity-90">
                  {featured.authorAvatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featured.authorAvatar}
                      alt=""
                      className="size-7 rounded-full border-2 border-white/60"
                    />
                  )}
                  {featured.authorName && <span>{featured.authorName}</span>}
                  <span className="opacity-50">·</span>
                  <span>{featured.readTimeMinutes} phút đọc</span>
                </div>
              </div>
            </Link>

            {/* Other latest */}
            <div className="flex flex-col gap-3.5">
              {otherLatest.map((a) => (
                <ArticleCard key={a.slug} article={a} variant="compact" categoryMap={categoryMap} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── All latest grid ── */}
      {allList.items.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-8 pt-20">
          <h2 className="mb-6 font-[var(--font-display)] text-3xl font-black uppercase tracking-tight">
            Mới nhất
          </h2>
          <div className="stagger grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {allList.items.map((a) => (
              <ArticleCard key={a.slug} article={a} categoryMap={categoryMap} />
            ))}
          </div>
        </section>
      )}

      {/* ── Contact CTA ── */}
      <section className="mx-auto max-w-[1200px] px-8 pt-24">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-8 text-white">
            <div
              className="absolute -right-10 -top-10 size-48 rounded-full opacity-25"
              style={{ background: "var(--5s-blue)", filter: "blur(50px)" }}
              aria-hidden
            />
            <div className="relative">
              <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold tracking-wider">
                💬 LIVE CHAT 24/7
              </span>
              <h3 className="mt-3 font-[var(--font-display)] text-3xl font-black uppercase leading-tight tracking-tight">
                Vẫn không tìm thấy
                <br />
                câu trả lời?
              </h3>
              <p className="mb-5 mt-2 max-w-[380px] text-sm leading-relaxed opacity-80">
                Đội ngũ support của 5BIB có mặt 24/7 — phản hồi trong vòng 5
                phút trên Zalo OA và 30 phút qua email.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/lien-he"
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--5s-magenta)] px-4 py-2.5 text-sm font-bold transition-colors hover:bg-[var(--5s-magenta-dim)]"
                >
                  Chat ngay <ArrowRight className="size-3.5" />
                </Link>
                <a
                  href="mailto:info@5bib.com"
                  className="inline-flex items-center rounded-lg border border-white/30 bg-transparent px-4 py-2.5 text-sm font-bold text-white"
                >
                  info@5bib.com
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 rounded-[18px] border border-[var(--5s-border)] bg-white p-8">
            {[
              { icon: "☎", t: "Hotline", s: "0373 398 986 · 7h–22h hằng ngày" },
              { icon: "✉", t: "Email", s: "info@5bib.com" },
              { icon: "💚", t: "Zalo OA 5BIB", s: "Phản hồi < 5 phút" },
              { icon: "🐞", t: "Báo lỗi", s: "Sắp ra mắt" },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-xl border border-[var(--5s-border)] bg-[var(--5s-bg)] p-5"
              >
                <div className="mb-3 grid size-10 place-items-center rounded-lg border border-[var(--5s-border)] bg-white text-xl">
                  {c.icon}
                </div>
                <div className="mb-0.5 text-sm font-extrabold">{c.t}</div>
                <div className="text-xs text-[var(--5s-text-muted)]">{c.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
