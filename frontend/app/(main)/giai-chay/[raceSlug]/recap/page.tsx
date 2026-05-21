/**
 * FEATURE-056 — Race Recap page `/giai-chay/[raceSlug]/recap`.
 *
 * Variation A "Editorial Magazine" — full rewrite per Manager Plan APPROVED.
 * Server Component SSR preserves F-051 JSON-LD Article schema + F-046 data layer.
 *
 * Single client island: `<StickyRecapNav>` (IntersectionObserver scroll-spy).
 *
 * DATA INTEGRITY (Danny "k nó kiện đấy" mandate):
 *  - Chip times rendered AS-IS from vendor.
 *  - Athlete names AS-IS (no canonicalize).
 *  - City chip hidden when backend returns null (no guessing — defamation safety).
 *  - Auto-gen spotlight uses backend neutral factual template.
 *
 * BR coverage: BR-56-01..25 + F-046 BR-46-06/23/24/27 preserved.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getRaceBySlug } from '@/lib/seo-api';
import { classifyRaceType, classificationLabel } from '@/lib/race-classifier';
import { PodiumCard } from '@/components/recap/PodiumCard';
import { PaceDistributionChart } from '@/components/recap/PaceDistributionChart';
import { NegSplitDonut } from '@/components/recap/NegSplitDonut';
import {
  AGBreakdownAccordion,
  type AGBucket,
} from '@/components/recap/AGBreakdownAccordion';
import {
  InsightEditorial,
  SpotlightCards,
} from '@/components/recap/InsightEditorial';
import { StickyRecapNav } from '@/components/recap/StickyRecapNav';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

// ─── Backend DTO shape (mirrors race-recap-response.dto.ts) ──────────────

interface RecapPodiumCell {
  name: string;
  bib: string;
  chipTime: string;
  category?: string;
  medal: 'gold' | 'silver' | 'bronze';
  avatarUrl?: string;
  city?: string;
}

interface RecapPodium {
  courseId: string;
  courseName: string;
  distance?: string;
  male: RecapPodiumCell[];
  female: RecapPodiumCell[];
  maleFinisherCount?: number;
  femaleFinisherCount?: number;
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
  avgFirstHalf?: string;
  avgSecondHalf?: string;
  deltaSeconds?: number;
  finishersAnalyzed?: number;
  benchmark?: number;
}

interface RecapAGBucketShape {
  category: string;
  finisherCount: number;
  top5: RecapPodiumCell[];
}

interface RecapAGBreakdown {
  courseId: string;
  courseName: string;
  buckets: RecapAGBucketShape[];
}

interface RecapSpotlightStory {
  courseId: string;
  gender: 'M' | 'F';
  winnerBib: string;
  winnerName: string;
  markdown: string;
  html: string;
  source: 'admin' | 'auto';
}

interface RecapSpotlightPerCourse {
  courseId: string;
  courseName: string;
  stories: RecapSpotlightStory[];
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
    registered?: number;
  };
  podiums: RecapPodium[];
  paceStats: RecapPaceStats[];
  negativeSplits: RecapNegativeSplit[];
  agBreakdowns: RecapAGBreakdown[];
  spotlightStoriesByCourse?: RecapSpotlightPerCourse[];
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
    if (!res.ok) return null;
    return (await res.json()) as RaceRecap;
  } catch {
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

// ─── generateMetadata (F-046 BR-46-23/24 preserved) ──────────────────────

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
    openGraph: { title, description, type: 'article' },
  };
}

// ─── JSON-LD Article schema (F-051 + BR-46-27 preserved) ─────────────────

function buildJsonLd(
  recap: RaceRecap,
  insight: RecapInsight | null,
  raceSlug: string,
): string {
  const datePublished =
    insight?.publishedAt ?? recap.endDate ?? new Date().toISOString();
  const dateModified = insight?.updatedAt ?? recap.endDate ?? recap.computedAt;
  const articleBody = insight?.insightMarkdown
    ? insight.insightMarkdown.slice(0, 1500)
    : `${recap.hero.headline}. ${recap.negativeSplits[0]?.interpretation ?? ''}`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Recap ${recap.raceTitle}`,
    datePublished,
    dateModified,
    author: { '@type': 'Organization', name: '5BIB', url: 'https://5bib.com' },
    publisher: {
      '@type': 'Organization',
      name: '5BIB',
      logo: { '@type': 'ImageObject', url: 'https://5bib.com/logo.png' },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://5bib.com/giai-chay/${raceSlug}/recap`,
    },
    articleBody,
  };

  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

// ─── Display helpers ─────────────────────────────────────────────────────

function formatVN(d: string | undefined | null): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${date.getFullYear()}`;
}

/**
 * Editorial title rendering per design Variation A — RAW raceTitle as-is
 * from system (Danny mandate 2026-05-21: "hệ thống thế nào hiện vậy đừng
 * override"). NO trim, NO strip prefix, NO split at "-".
 *
 * Apply italic+orange accent overlay ONLY when an editorial keyword is
 * present (MARATHON / ULTRA / TRAIL / RUN / CHẠY). This wraps the matching
 * word in a styled <span> without modifying the source text.
 *
 * If no keyword match → return raw title unchanged.
 */
function renderEditorialTitle(rawTitle: string): React.ReactNode {
  const accentRegex = /\b(MARATHON|ULTRA TRAIL|ULTRA|TRAIL|RUN|CHẠY)\b/i;
  const match = rawTitle.match(accentRegex);
  if (!match || match.index === undefined) {
    return <span>{rawTitle}</span>;
  }
  const idx = match.index;
  const before = rawTitle.slice(0, idx);
  const accent = rawTitle.slice(idx, idx + match[0].length);
  const after = rawTitle.slice(idx + match[0].length);
  return (
    <>
      <span>{before}</span>
      <span
        style={{
          color: '#FB923C',
          fontStyle: 'italic',
          fontWeight: 800,
        }}
      >
        {accent}
      </span>
      <span>{after}</span>
    </>
  );
}

function paceSpread(p10: string, p90: string): string {
  const parse = (s: string): number => {
    const m = s.replace('/km', '').split(':');
    if (m.length !== 2) return 0;
    const a = parseInt(m[0], 10);
    const b = parseInt(m[1], 10);
    if (isNaN(a) || isNaN(b)) return 0;
    return a * 60 + b;
  };
  const diff = parse(p90) - parse(p10);
  if (diff <= 0) return '—';
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}:${s.toString().padStart(2, '0')} min`;
}

// ─── Page component (Server) ────────────────────────────────────────────

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
  const firstCourse = race.courses?.[0];
  const classification = classifyRaceType({
    raceType:
      race.courses && race.courses.length > 0
        ? (race.courses[0] as { raceType?: string }).raceType ?? null
        : null,
    distanceKm: firstCourse?.distanceKm ?? null,
    distance: firstCourse?.distance ?? recap.podiums[0]?.distance ?? null,
  });

  // Hero stats
  const firstPace = recap.paceStats[0];
  const medianPace = firstPace?.medianPace ?? '—';
  const winningTime = recap.podiums[0]?.male[0]?.chipTime ?? recap.podiums[0]?.female[0]?.chipTime ?? '—';
  const finishersFormatted = recap.hero.totalFinishers.toLocaleString('vi-VN');
  const registered = recap.hero.registered ?? recap.hero.totalFinishers + recap.hero.dnfCount + recap.hero.dnsCount + recap.hero.dsqCount;

  const sections = [
    { id: 'podium', label: 'Podium' },
    { id: 'pace', label: 'Pace' },
    { id: 'negsplit', label: 'Negative Split' },
    { id: 'ag', label: 'Age Group' },
    { id: 'insight', label: 'Insight' },
  ];
  // Course pills: prefer `name` (e.g. "21KM" with unit) over `distance` (raw
  // numeric "21" — would lose unit). BR-56-07 v1 read-only visual.
  const courseLabels = race.courses
    ?.map((c) => c.name ?? c.distance)
    .filter((s): s is string => !!s) ?? [];

  return (
    <div className="bg-stone-50 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      {/* ═══ HERO ═══ */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          // BUG FIX 2026-05-21: increase min height + auto-grow for long VN titles
          minHeight: 'clamp(520px, 65vh, 720px)',
          background: bannerUrl
            ? undefined
            : 'linear-gradient(135deg, #1B2238, #2A3354)',
        }}
      >
        {bannerUrl && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${bannerUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'saturate(0.85) brightness(0.6)',
            }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(11,27,59,0.4) 0%, rgba(11,27,59,0.75) 60%, rgba(11,27,59,0.95) 100%)',
          }}
        />
        {/* Topo SVG overlay (desktop only — perf on mobile) */}
        <svg
          aria-hidden
          className="absolute inset-0 hidden md:block"
          preserveAspectRatio="none"
          viewBox="0 0 1440 640"
          style={{ width: '100%', height: '100%' }}
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <path
              key={i}
              d={`M -50 ${80 + i * 38} Q ${300 + i * 12} ${30 + i * 40} ${720} ${100 + i * 36} T ${1500} ${80 + i * 40}`}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="absolute top-5 left-6 md:left-12 font-mono font-semibold text-[11px] tracking-[0.08em]"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          5BIB · GIẢI CHẠY · {(race.location ?? '').toUpperCase()} ·{' '}
          <span style={{ color: '#fff' }}>RECAP</span>
        </nav>

        {/* Content — BUG FIX 2026-05-21: pt-24 to clear fixed header (h-14)
            + breadcrumb (top-5). Use relative grid with constrained title col
            to prevent VN long-title overflow into stats column. */}
        <div className="relative z-10 flex min-h-full flex-col justify-end px-6 pt-24 pb-10 md:px-14 md:pt-28 md:pb-14">
          <div className="grid gap-8 md:gap-12 items-end md:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold uppercase text-[10.5px] tracking-[0.18em]"
                  style={{ background: '#fff', color: '#1B2238' }}
                >
                  {race.status === 'ended' ? 'RACE RECAP' : race.status === 'live' ? 'ĐANG DIỄN RA' : 'SẮP DIỄN RA'}
                </span>
                {classification ? (
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold uppercase text-[10.5px] tracking-[0.18em] border"
                    style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.9)' }}
                  >
                    {classificationLabel(classification)}
                  </span>
                ) : null}
                <span
                  className="font-mono font-semibold text-[11px] md:text-[12px] tracking-[0.08em]"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  {formatVN(recap.endDate)} · {race.location ?? '—'}
                </span>
              </div>
              <h1
                className="font-heading font-black uppercase m-0"
                style={{
                  // Match design Variation A: 88px desktop hero scale.
                  // Adaptive clamp keeps long VN titles (60+ chars) readable.
                  fontSize: 'clamp(40px, 6vw, 88px)',
                  lineHeight: 0.92,
                  letterSpacing: '-0.035em',
                  overflowWrap: 'break-word',
                }}
                title={recap.raceTitle}
              >
                {renderEditorialTitle(recap.raceTitle)}
              </h1>
              <div
                className="mt-5 font-body italic"
                style={{
                  maxWidth: 540,
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.78)',
                }}
              >
                Tổng kết hành trình đường chạy, podium, phân bố pace và câu chuyện
                phía sau những con số.
              </div>
            </div>
            <div className="grid gap-3 min-w-0">
              <HeroStat label="FINISHERS" value={finishersFormatted} color="#fff" />
              <HeroStat label="MEDIAN PACE /km" value={medianPace.replace('/km', '')} color="#FB923C" />
              <HeroStat label="WINNING TIME" value={winningTime} color="#22D3EE" />
            </div>
          </div>
        </div>

        {/* Accent strip */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: 6,
            background:
              'linear-gradient(90deg, var(--5bib-energy, #ea580c), #1d4ed8 60%, #FB923C)',
          }}
        />
      </section>

      {/* ═══ STICKY NAV (client island) ═══ */}
      <StickyRecapNav sections={sections} courses={courseLabels} />

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="max-w-7xl mx-auto px-6 md:px-8 py-12 md:py-16">
        {/* ── PODIUM ── */}
        <section id="podium" className="mb-16 md:mb-20 scroll-mt-32">
          <SectionHeading
            number="01"
            eyebrow="Bảng vinh danh"
            title={
              recap.podiums.length === 1
                ? `PODIUM ${recap.podiums[0].distance ?? recap.podiums[0].courseName}`
                : 'PODIUM TỪNG CỰ LY'
            }
            action={
              <span
                className="font-mono text-[13px] text-stone-500"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                Tổng <b className="text-stone-900">{finishersFormatted}</b> /{' '}
                {registered.toLocaleString('vi-VN')} VĐV · DNF{' '}
                {recap.hero.dnfCount.toLocaleString('vi-VN')}
              </span>
            }
          />
          {recap.podiums.length === 0 ? (
            <p className="text-stone-500 italic">Chưa có dữ liệu podium.</p>
          ) : (
            recap.podiums.map((p) => (
              <div key={p.courseId} className="mb-10 last:mb-0">
                {recap.podiums.length > 1 ? (
                  <h3 className="font-heading font-bold uppercase text-[18px] tracking-tight text-stone-700 mb-4">
                    {p.distance ?? p.courseName}
                  </h3>
                ) : null}
                <div className="grid gap-6 md:gap-8 md:grid-cols-2">
                  <PodiumGroup
                    label="OVERALL · NAM"
                    accent="#1d4ed8"
                    finisherCount={p.maleFinisherCount}
                    cells={p.male}
                  />
                  <PodiumGroup
                    label="OVERALL · NỮ"
                    accent="#ea580c"
                    finisherCount={p.femaleFinisherCount}
                    cells={p.female}
                  />
                </div>
              </div>
            ))
          )}
        </section>

        {/* ── PACE ── */}
        <section id="pace" className="mb-16 md:mb-20 scroll-mt-32">
          <SectionHeading number="02" eyebrow="Phân bố pace" title="DÒNG CHẢY TỐC ĐỘ" />
          {firstPace ? (
            <div className="grid gap-6 md:gap-8 md:grid-cols-[1.5fr_1fr]">
              <div
                className="bg-white border border-stone-200 rounded-2xl p-6 md:p-7"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <PaceDistributionChart distribution={firstPace.distribution} />
                <p
                  className="font-body italic text-[13px] leading-relaxed mt-3 text-stone-500"
                >
                  Phân bố pace nghiêng phải — phần đông VĐV chạy quanh{' '}
                  <span
                    className="font-mono font-bold text-stone-900"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {firstPace.medianPace.replace('/km', '')}/km
                  </span>
                  . Top 10% giữ pace dưới{' '}
                  <span
                    className="font-mono font-bold"
                    style={{ color: '#166534', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {firstPace.p10Pace.replace('/km', '')}
                  </span>
                  .
                </p>
              </div>
              <div className="grid gap-3 content-start">
                <PaceStat label="Median pace" value={firstPace.medianPace.replace('/km', '')} unit="/km" color="#1d4ed8" sub="Toàn cuộc đua" />
                <PaceStat label="Fastest 10%" value={firstPace.p10Pace.replace('/km', '')} unit="/km" color="#166534" sub={`P10 · ${Math.floor(firstPace.finisherCount * 0.1).toLocaleString('vi-VN')} VĐV`} />
                <PaceStat label="Slowest 10%" value={firstPace.p90Pace.replace('/km', '')} unit="/km" color="#DC2626" sub="P90" />
                <PaceStat label="Pace spread" value={paceSpread(firstPace.p10Pace, firstPace.p90Pace)} unit="" color="#78716C" sub="P10 → P90" />
              </div>
            </div>
          ) : (
            <p className="text-stone-500 italic">Chưa có dữ liệu pace.</p>
          )}
        </section>

        {/* ── NEG SPLIT ── */}
        <section id="negsplit" className="mb-16 md:mb-20 scroll-mt-32">
          <SectionHeading number="03" eyebrow="Pacing strategy" title="NEGATIVE SPLIT" />
          {recap.negativeSplits.length > 0 ? (
            <NegSplitDonut
              value={recap.negativeSplits[0].negativeSplitPercent}
              benchmark={recap.negativeSplits[0].benchmark ?? 40}
              interpretation={recap.negativeSplits[0].interpretation}
              avgFirstHalf={recap.negativeSplits[0].avgFirstHalf}
              avgSecondHalf={recap.negativeSplits[0].avgSecondHalf}
              deltaSeconds={recap.negativeSplits[0].deltaSeconds}
              finishersAnalyzed={recap.negativeSplits[0].finishersAnalyzed}
            />
          ) : (
            <p className="text-stone-500 italic">Chưa có dữ liệu split.</p>
          )}
        </section>

        {/* ── AG BREAKDOWN ── */}
        <section id="ag" className="mb-16 md:mb-20 scroll-mt-32">
          <SectionHeading
            number="04"
            eyebrow="Age group"
            title="THEO NHÓM TUỔI"
            action={
              <Link
                href={`/giai-chay/${raceSlug}/ket-qua`}
                className="font-body font-bold text-[13px] text-stone-600 hover:text-stone-900 transition-colors"
              >
                Xem tất cả →
              </Link>
            }
          />
          {recap.agBreakdowns.length === 0 ? (
            <p className="text-stone-500 italic">Chưa có dữ liệu AG.</p>
          ) : (
            recap.agBreakdowns.map((ag) => (
              <div key={ag.courseId} className="mb-8 last:mb-0">
                {recap.agBreakdowns.length > 1 ? (
                  <h3 className="font-heading font-bold uppercase text-[16px] text-stone-700 mb-3">
                    {ag.courseName}
                  </h3>
                ) : null}
                <AGBreakdownAccordion
                  buckets={ag.buckets as AGBucket[]}
                  defaultOpen={Math.min(2, ag.buckets.length)}
                />
              </div>
            ))
          )}
        </section>

        {/* ── INSIGHT ── */}
        <section id="insight" className="mb-12 scroll-mt-32">
          <SectionHeading number="05" eyebrow="5BIB Editorial" title="INSIGHT" />
          <InsightEditorial
            insightHtml={insight?.insightHtml ?? null}
            byline={`5BIB EDITORIAL TEAM${recap.endDate ? ` · ${formatVN(recap.endDate)}` : ''}`}
            fallbackLead={`${recap.raceTitle} kết thúc với ${finishersFormatted} VĐV hoàn thành.`}
            spotlightCards={
              recap.spotlightStoriesByCourse &&
              recap.spotlightStoriesByCourse.length > 0 ? (
                <SpotlightCards groups={recap.spotlightStoriesByCourse} />
              ) : null
            }
            cta={
              <>
                <Link
                  href={`/giai-chay/${raceSlug}/ket-qua`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-body font-bold text-[14px] text-white transition-all hover:brightness-110"
                  style={{ background: 'var(--5bib-blue, #1d4ed8)' }}
                >
                  Xem toàn bộ kết quả
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href={`/giai-chay/${raceSlug}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-body font-bold text-[14px] text-stone-700 border border-stone-300 hover:border-stone-500 hover:text-stone-900 transition-colors"
                >
                  Trang giải
                </Link>
              </>
            }
          />
        </section>
      </main>
    </div>
  );
}

// ─── Inline sub-components (page-local, single-use) ─────────────────────

function HeroStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 pb-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.18)' }}
    >
      <div
        className="font-heading font-black"
        style={{
          // Match design Variation A: 56px hero stats
          fontSize: 'clamp(32px, 4vw, 56px)',
          color,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div
        className="font-body font-extrabold text-[10px]"
        style={{
          letterSpacing: '0.2em',
          color: 'rgba(255,255,255,0.6)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SectionHeading({
  number,
  eyebrow,
  title,
  action,
}: {
  number: string;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    // BUG FIX 2026-05-21: mobile column stack → desktop row. flex-1 min-w-0
    // on title wrapper prevents action button from squeezing title into
    // single-word-per-line vertical stack (Danny screenshot mobile bug).
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-7 md:mb-9">
      <div className="flex-1 min-w-0">
        <div
          className="font-mono font-bold uppercase text-[11px] tracking-[0.2em] text-stone-500 mb-2"
        >
          {number} · {eyebrow}
        </div>
        <h2
          className="font-heading font-black uppercase m-0"
          style={{
            fontSize: 'clamp(22px, 2.8vw, 36px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            overflowWrap: 'break-word',
          }}
        >
          {title}
        </h2>
      </div>
      {action ? <div className="sm:shrink-0">{action}</div> : null}
    </header>
  );
}

function PodiumGroup({
  label,
  accent,
  finisherCount,
  cells,
}: {
  label: string;
  accent: string;
  finisherCount?: number;
  cells: RecapPodiumCell[];
}) {
  if (cells.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 4,
              height: 22,
              background: accent,
              borderRadius: 2,
            }}
          />
          <h3 className="font-heading font-bold uppercase text-[18px] tracking-tight m-0">
            {label}
          </h3>
        </div>
        <p className="text-stone-400 italic text-sm">
          Chưa có finisher cho nhóm này.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 4,
            height: 22,
            background: accent,
            borderRadius: 2,
          }}
        />
        <h3 className="font-heading font-bold uppercase text-[18px] tracking-tight m-0">
          {label}
        </h3>
        {typeof finisherCount === 'number' ? (
          <span
            className="ml-auto font-mono font-bold uppercase text-[11px] tracking-wider text-stone-500"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {finisherCount.toLocaleString('vi-VN')} finisher
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {cells.map((c, i) => (
          <PodiumCard
            key={`${c.bib}-${i}`}
            rank={(i + 1) as 1 | 2 | 3}
            variant={c.medal}
            size={i === 0 ? 'md' : 'sm'}
            name={c.name}
            bib={c.bib}
            chipTime={c.chipTime}
            ag={c.category}
            city={c.city}
          />
        ))}
      </div>
    </div>
  );
}

function PaceStat({
  label,
  value,
  unit,
  color,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  sub: string;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl px-5 py-3.5 flex items-baseline gap-4">
      <div
        className="font-mono font-bold tracking-tight"
        style={{
          fontSize: 26,
          color,
          letterSpacing: '-0.02em',
          minWidth: 90,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {unit ? (
          <span className="text-[13px] text-stone-400 ml-1 font-normal">
            {unit}
          </span>
        ) : null}
      </div>
      <div>
        <div className="font-body font-extrabold uppercase text-[11.5px] tracking-[0.12em] text-stone-900">
          {label}
        </div>
        <div className="font-body text-[11px] text-stone-500">{sub}</div>
      </div>
    </div>
  );
}
