/**
 * FEATURE-046 — Programmatic SEO Race Recap page `/giai-chay/[raceSlug]/recap`.
 *
 * Server Component SSR (Next.js 16 App Router). 6 blocks render order per
 * BR-46-06: Hero → Podium → Pace → NegSplit → AG → 5BIB Insight.
 *
 * Per Manager Plan Adjustment #2: backend pre-renders markdown → insightHtml.
 * Frontend renders via dangerouslySetInnerHTML (backend sanitized).
 *
 * Per F-036/F-037 pattern: dual-source `getRaceBySlug()` MongoDB-first, fall
 * back to on-sale (though on-sale won't have recap — caught by service 404).
 *
 * Components inline rather than 6 separate files (Phase 1 simplification —
 * documented in IMPLEMENTATION_NOTES Section 1 Deviations).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getRaceBySlug } from '@/lib/seo-api';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

// ─── Backend DTO shape (mirrors race-recap-response.dto.ts) ──────────────

interface RecapPodiumCell {
  name: string;
  bib: string;
  chipTime: string;
  category?: string;
  medal: 'gold' | 'silver' | 'bronze';
  avatarUrl?: string; // F-046 Phase 1.5 — public-shareable
}

interface RecapPodium {
  courseId: string;
  courseName: string;
  distance?: string;
  male: RecapPodiumCell[];
  female: RecapPodiumCell[];
}

interface RecapPaceStats {
  courseId: string;
  courseName: string;
  medianPace: string;
  p10Pace: string;
  p90Pace: string;
  distribution: number[];
  finisherCount: number;
}

interface RecapNegativeSplit {
  courseId: string;
  courseName: string;
  negativeSplitPercent: number;
  interpretation: string;
}

interface RecapAGBucket {
  category: string;
  finisherCount: number;
  top5: RecapPodiumCell[];
}

interface RecapAGBreakdown {
  courseId: string;
  courseName: string;
  buckets: RecapAGBucket[];
}

interface RaceRecap {
  raceId: string;
  raceTitle: string;
  raceSlug: string;
  endDate?: string;
  hero: {
    totalFinishers: number;
    dnsCount: number;
    dnfCount: number;
    dsqCount: number;
    headline: string;
  };
  podiums: RecapPodium[];
  paceStats: RecapPaceStats[];
  negativeSplits: RecapNegativeSplit[];
  agBreakdowns: RecapAGBreakdown[];
  computedAt: string;
}

interface RecapInsight {
  insightMarkdown: string | null;
  insightHtml: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  authorName: string | null;
}

// ─── Data fetchers (Server-side) ─────────────────────────────────────────

async function getRaceRecap(raceId: string): Promise<RaceRecap | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/race-results/recap/${encodeURIComponent(raceId)}`,
      {
        next: {
          revalidate: 3600,
          tags: [`recap:race:${raceId}`, 'giai-chay:recap'],
        },
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`[recap] backend returned ${res.status}`);
      return null;
    }
    return (await res.json()) as RaceRecap;
  } catch (err) {
    console.error('[recap] fetch failed:', err);
    return null;
  }
}

async function getRecapInsight(raceId: string): Promise<RecapInsight | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/race-results/recap/${encodeURIComponent(raceId)}/insight`,
      {
        next: {
          revalidate: 600,
          tags: [`recap:insight:${raceId}`],
        },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as RecapInsight;
  } catch {
    return null;
  }
}

// ─── generateMetadata (BR-46-23/24) ──────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ raceSlug: string }>;
}): Promise<Metadata> {
  const { raceSlug } = await params;
  const race = await getRaceBySlug(raceSlug);
  if (!race) {
    return { title: 'Recap không tồn tại | 5BIB' };
  }

  const recap = await getRaceRecap(race.id);
  if (!recap) {
    return {
      title: `Recap ${race.title} | 5BIB`,
      robots: { index: false, follow: false },
    };
  }

  const year = recap.endDate ? new Date(recap.endDate).getFullYear() : '';
  const finishersFormatted = recap.hero.totalFinishers.toLocaleString('vi-VN');
  const title = `Recap ${recap.raceTitle} ${year} — ${finishersFormatted} VĐV về đích | 5BIB`;

  const medianPaces = recap.paceStats
    .map((p) => p.medianPace)
    .filter((p) => p !== '—');
  const medianText =
    medianPaces.length > 0 ? `pace median ${medianPaces[0]}` : 'số liệu pace';
  const negPct =
    recap.negativeSplits.length > 0
      ? `negative split ${recap.negativeSplits[0].negativeSplitPercent}%`
      : '';
  const description =
    `Phân tích chi tiết kết quả ${recap.raceTitle} ${year}: ${medianText}` +
    (negPct ? `, ${negPct}` : '') +
    `, top podium theo AG. Số liệu từ 5BIB.`;

  return {
    title,
    description: description.slice(0, 160),
    openGraph: {
      title,
      description,
      type: 'article',
    },
  };
}

// ─── JSON-LD Article schema (BR-46-27) ───────────────────────────────────

function buildJsonLd(
  recap: RaceRecap,
  insight: RecapInsight | null,
  raceSlug: string,
): string {
  const datePublished =
    insight?.publishedAt ?? recap.endDate ?? new Date().toISOString();
  const dateModified =
    insight?.updatedAt ?? recap.endDate ?? recap.computedAt;
  const articleBody = insight?.insightMarkdown
    ? insight.insightMarkdown.slice(0, 1500)
    : `${recap.hero.headline}. ${recap.negativeSplits[0]?.interpretation ?? ''}`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Recap ${recap.raceTitle}`,
    datePublished,
    dateModified,
    author: {
      '@type': 'Organization',
      name: '5BIB',
      url: 'https://5bib.com',
    },
    publisher: {
      '@type': 'Organization',
      name: '5BIB',
      logo: {
        '@type': 'ImageObject',
        url: 'https://5bib.com/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://5bib.com/giai-chay/${raceSlug}/recap`,
    },
    articleBody,
  };

  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

// ─── Page component (Server) ─────────────────────────────────────────────

export default async function RaceRecapPage({
  params,
}: {
  params: Promise<{ raceSlug: string }>;
}) {
  const { raceSlug } = await params;
  const race = await getRaceBySlug(raceSlug);
  if (!race) notFound();

  const recap = await getRaceRecap(race.id);
  if (!recap) notFound();

  const insight = await getRecapInsight(race.id);
  const jsonLd = buildJsonLd(recap, insight, raceSlug);

  const bannerUrl = race.bannerUrl ?? race.imageUrl ?? race.logoUrl ?? null;

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      {/* F-046 Phase 1.5 — Hero banner (race.bannerUrl) full-width above fold */}
      {bannerUrl && (
        <div
          className="relative h-48 w-full bg-stone-200 md:h-64 lg:h-80"
          style={{
            backgroundImage: `url(${bannerUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          aria-hidden="true"
        >
          {/* Gradient overlay for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/60" />
          <div className="absolute bottom-0 left-0 right-0 px-4 py-6 md:px-8 md:py-10">
            <div className="mx-auto max-w-5xl">
              <span className="inline-block rounded-full bg-blue-700/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                Phân tích race
              </span>
              <h1 className="mt-2 text-2xl font-bold text-white drop-shadow-lg md:text-4xl">
                Recap {recap.raceTitle}
              </h1>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-stone-600" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-blue-700">
            Trang chủ
          </Link>{' '}
          <span className="mx-2">›</span>
          <Link href="/giai-chay" className="hover:text-blue-700">
            Giải chạy
          </Link>{' '}
          <span className="mx-2">›</span>
          <Link
            href={`/giai-chay/${raceSlug}`}
            className="hover:text-blue-700"
          >
            {recap.raceTitle}
          </Link>{' '}
          <span className="mx-2">›</span>
          <span className="text-stone-900">Recap</span>
        </nav>

        {/* Fallback H1 if no banner */}
        {!bannerUrl && (
          <h1 className="mb-8 text-3xl font-bold text-stone-900 md:text-4xl">
            Recap {recap.raceTitle}
          </h1>
        )}

      {/* ─── Block 1: Hero stats ─── */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-stone-900">
          {recap.hero.headline}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Về đích"
            value={recap.hero.totalFinishers.toLocaleString('vi-VN')}
            color="text-blue-700"
          />
          <StatCard
            label="DNS"
            value={recap.hero.dnsCount.toLocaleString('vi-VN')}
            color="text-stone-600"
          />
          <StatCard
            label="DNF"
            value={recap.hero.dnfCount.toLocaleString('vi-VN')}
            color="text-orange-600"
          />
          <StatCard
            label="DSQ"
            value={recap.hero.dsqCount.toLocaleString('vi-VN')}
            color="text-red-600"
          />
        </div>
      </section>

      {/* ─── Block 2: Podium ─── */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-stone-900">Podium</h2>
        <div className="space-y-8">
          {recap.podiums.map((podium) => (
            <PodiumCard key={podium.courseId} podium={podium} />
          ))}
        </div>
      </section>

      {/* ─── Block 3: Pace Analysis ─── */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-stone-900">
          Phân tích pace
        </h2>
        <div className="space-y-6">
          {recap.paceStats.map((pace) => (
            <PaceCard key={pace.courseId} pace={pace} />
          ))}
        </div>
      </section>

      {/* ─── Block 4: Negative Split ─── */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-stone-900">
          Tỷ lệ Negative Split
        </h2>
        <div className="space-y-4">
          {recap.negativeSplits.map((ns) => (
            <NegSplitCard key={ns.courseId} ns={ns} />
          ))}
        </div>
      </section>

      {/* ─── Block 5: AG Breakdown ─── */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-stone-900">
          Top theo nhóm tuổi
        </h2>
        <div className="space-y-8">
          {recap.agBreakdowns.map((ag) => (
            <AGSection key={ag.courseId} ag={ag} />
          ))}
        </div>
      </section>

      {/* ─── Block 6: 5BIB Insight (editorial 70/30) ─── */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-stone-900">
          5BIB Insight
        </h2>
        {insight?.insightHtml ? (
          <article
            className="prose prose-stone max-w-none rounded-lg border border-stone-200 bg-white p-6"
            dangerouslySetInnerHTML={{ __html: insight.insightHtml }}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
            <p className="text-stone-700">
              Bài phân tích chi tiết đang được biên tập. Quay lại sau nhé!
            </p>
          </div>
        )}
        {insight?.authorName && (
          <p className="mt-2 text-sm text-stone-500">
            — {insight.authorName}
            {insight.publishedAt && (
              <span>
                {' '}
                · {new Date(insight.publishedAt).toLocaleDateString('vi-VN')}
              </span>
            )}
          </p>
        )}
      </section>

      {/* Footer actions */}
      <footer className="flex flex-wrap gap-3 border-t border-stone-200 pt-8">
        <Link
          href={`/giai-chay/${raceSlug}/ket-qua`}
          className="rounded-lg bg-stone-900 px-5 py-3 text-sm font-medium text-white hover:opacity-90"
        >
          Xem kết quả đầy đủ →
        </Link>
        <Link
          href={`/giai-chay/${raceSlug}`}
          className="rounded-lg border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 hover:border-stone-900"
        >
          Trang giải
        </Link>
        <p className="ml-auto self-center text-xs text-stone-500">
          Cập nhật:{' '}
          {new Date(
            insight?.updatedAt ?? recap.endDate ?? recap.computedAt,
          ).toLocaleDateString('vi-VN')}
        </p>
      </footer>
      </div>
    </div>
  );
}

// ─── Inline block components ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-sm text-stone-600">{label}</div>
    </div>
  );
}

function PodiumCard({ podium }: { podium: RecapPodium }) {
  if (podium.male.length === 0 && podium.female.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h3 className="text-lg font-semibold">
          {podium.courseName}
          {podium.distance && (
            <span className="ml-2 text-sm font-normal text-stone-500">
              · {podium.distance}
            </span>
          )}
        </h3>
        <p className="mt-2 text-sm text-stone-500">Chưa có dữ liệu podium</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold">
        {podium.courseName}
        {podium.distance && (
          <span className="ml-2 text-sm font-normal text-stone-500">
            · {podium.distance}
          </span>
        )}
      </h3>
      <div className="grid gap-6 md:grid-cols-2">
        {podium.male.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium text-blue-700">Nam</div>
            <PodiumList cells={podium.male} />
          </div>
        )}
        {podium.female.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium text-pink-700">Nữ</div>
            <PodiumList cells={podium.female} />
          </div>
        )}
      </div>
    </div>
  );
}

function PodiumList({ cells }: { cells: RecapPodiumCell[] }) {
  return (
    <ol className="space-y-2">
      {cells.map((cell) => (
        <li
          key={cell.bib}
          className="flex items-center justify-between rounded border border-stone-100 bg-stone-50 px-3 py-2"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">
              {cell.medal === 'gold' ? '🥇' : cell.medal === 'silver' ? '🥈' : '🥉'}
            </span>
            {/* F-046 Phase 1.5 — athlete avatar (public-shareable, fallback initials) */}
            <AthleteAvatar
              avatarUrl={cell.avatarUrl}
              name={cell.name}
              medal={cell.medal}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-stone-900">
                {cell.name}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <span>#{cell.bib}</span>
                {cell.category && (
                  <span className="rounded bg-stone-200 px-1.5 py-0.5">
                    {cell.category}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="ml-2 shrink-0 font-mono text-sm font-semibold text-stone-700">
            {cell.chipTime}
          </span>
        </li>
      ))}
    </ol>
  );
}

function AthleteAvatar({
  avatarUrl,
  name,
  medal,
}: {
  avatarUrl?: string;
  name: string;
  medal: 'gold' | 'silver' | 'bronze';
}) {
  const ringColor =
    medal === 'gold'
      ? 'ring-yellow-400'
      : medal === 'silver'
        ? 'ring-stone-400'
        : 'ring-orange-600';

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(-2)
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`h-9 w-9 shrink-0 rounded-full object-cover ring-2 ${ringColor}`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-300 text-xs font-semibold text-stone-700 ring-2 ${ringColor}`}
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  );
}

function PaceCard({ pace }: { pace: RecapPaceStats }) {
  if (pace.finisherCount === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h3 className="text-lg font-semibold">{pace.courseName}</h3>
        <p className="mt-2 text-sm text-stone-500">Chưa có dữ liệu pace</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold">{pace.courseName}</h3>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Median" value={pace.medianPace} color="text-blue-700" />
        <StatCard
          label="Top 10%"
          value={pace.p10Pace}
          color="text-green-700"
        />
        <StatCard
          label="Bottom 10%"
          value={pace.p90Pace}
          color="text-orange-600"
        />
      </div>
      <div className="mt-4">
        <PaceDistribution distribution={pace.distribution} />
      </div>
      <p className="mt-2 text-xs text-stone-500">
        {pace.finisherCount.toLocaleString('vi-VN')} VĐV có data pace
      </p>
    </div>
  );
}

function PaceDistribution({ distribution }: { distribution: number[] }) {
  const max = Math.max(...distribution, 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {distribution.map((count, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-blue-500"
          style={{ height: `${(count / max) * 100}%` }}
          title={`Bucket ${i + 1}: ${count} VĐV`}
        />
      ))}
    </div>
  );
}

function NegSplitCard({ ns }: { ns: RecapNegativeSplit }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6">
      <h3 className="text-lg font-semibold">{ns.courseName}</h3>
      <div className="mt-3 text-5xl font-bold text-blue-700">
        {ns.negativeSplitPercent}%
      </div>
      <p className="mt-3 text-sm text-stone-700">{ns.interpretation}</p>
    </div>
  );
}

function AGSection({ ag }: { ag: RecapAGBreakdown }) {
  if (ag.buckets.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h3 className="text-lg font-semibold">{ag.courseName}</h3>
        <p className="mt-2 text-sm text-stone-500">
          Chưa có dữ liệu nhóm tuổi
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold">{ag.courseName}</h3>
      <div className="space-y-3">
        {ag.buckets.map((bucket) => (
          <details
            key={bucket.category}
            className="rounded border border-stone-200"
          >
            <summary className="cursor-pointer px-4 py-2 font-medium hover:bg-stone-50">
              {bucket.category}
              <span className="ml-2 text-xs text-stone-500">
                ({bucket.finisherCount} VĐV)
              </span>
            </summary>
            <div className="border-t border-stone-200 p-3">
              <PodiumList cells={bucket.top5} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

// ISR 1 hour — race ended ≈ immutable
export const revalidate = 3600;
