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
import {
  InsightEditorial,
  SpotlightCards,
} from '@/components/recap/InsightEditorial';
import { StickyRecapNav } from '@/components/recap/StickyRecapNav';
// F-056 scope expansion 2026-05-21 — Variation A enrich + Variation B body dashboard.
// SpotlightWinCard used via SpotlightSwitcher internally (no direct import here).
import SpotlightSwitcher, {
  type SpotlightSwitcherCourse,
} from '@/components/recap/SpotlightSwitcher';
import HeroStatTilesRow from '@/components/recap/HeroStatTilesRow';
import HeroPhotoLayer from '@/components/recap/HeroPhotoLayer';
import FinisherDistributionBars from '@/components/recap/FinisherDistributionBars';
import OverallChampionsCard from '@/components/recap/OverallChampionsCard';
import NegSplitDonutLarge from '@/components/recap/NegSplitDonutLarge';
import AGBreakdownTable from '@/components/recap/AGBreakdownTable';
import EditorialBlock from '@/components/recap/EditorialBlock';
import RecapActionBar from '@/components/recap/RecapActionBar';
import PaceCurveNarrativeBlock from '@/components/recap/PaceCurveNarrativeBlock';
import RecapStoryCard from '@/components/recap/RecapStoryCard';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

// ─── Pace helpers (F-056 bugfix 2026-05-21) ──────────────────────────────
// Winner pace tính từ chipTime / distanceKm — không dùng course medianPace
// (course median = pace average của tất cả finisher, KHÔNG đại diện hiệu năng
// winner). User Danny 2026-05-21 report: race 10KM Thái Nguyên 2026, LINH TOM
// 41:00 + LÊ THỊ LAN 52:02 cả 2 đều show 7:09/km (= median 10KM toàn race).

/** Parse "MM:SS" or "HH:MM:SS" or "H:MM:SS" string → total seconds. */
function parseChipTimeToSeconds(t: string | undefined | null): number {
  if (!t) return 0;
  const parts = t.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Parse "10Km" / "21KM" / "42.2km" / "5K" → kilometers (float). */
function parseDistanceKm(d: string | undefined | null): number {
  if (!d) return 0;
  const m = /(\d+(?:[.,]\d+)?)/.exec(d);
  if (!m) return 0;
  return parseFloat(m[1].replace(',', '.'));
}

/** Format seconds-per-km as "M:SS/km". Returns undefined if invalid. */
function formatPacePerKm(secsPerKm: number): string | undefined {
  if (!Number.isFinite(secsPerKm) || secsPerKm <= 0) return undefined;
  const m = Math.floor(secsPerKm / 60);
  const s = Math.floor(secsPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}/km`;
}

/** Compute winner's individual pace from chipTime + distance string. */
function computeWinnerPace(
  chipTime: string | undefined | null,
  distance: string | undefined | null,
): string | undefined {
  const totalSec = parseChipTimeToSeconds(chipTime);
  const km = parseDistanceKm(distance);
  if (!totalSec || !km) return undefined;
  return formatPacePerKm(totalSec / km);
}

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

interface RecapCourseDistribution {
  courseId: string;
  courseName: string;
  distance?: string;
  finisherCount: number;
  medianPace?: string;
  bestChipTime?: string;
}

interface RecapArticleMeta {
  slug: string;
  title: string;
  summary: string;
  category:
    | 'race-narrative'
    | 'winner-profile'
    | 'pacing'
    | 'course-difficulty'
    | 'age-group'
    | 'pace-distribution';
  readMinutes: number;
  source: 'auto' | 'admin';
  html: string;
  publishedAt: string;
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
    // F-056 scope expansion 2026-05-21
    winningTimeMale?: string;
    winningNameMale?: string;
    winningTimeFemale?: string;
    winningNameFemale?: string;
    elevationGain?: number;
    elevationSegments?: number;
  };
  podiums: RecapPodium[];
  paceStats: RecapPaceStats[];
  negativeSplits: RecapNegativeSplit[];
  agBreakdowns: RecapAGBreakdown[];
  spotlightStoriesByCourse?: RecapSpotlightPerCourse[];
  finisherDistribution?: RecapCourseDistribution[];
  recapArticles?: RecapArticleMeta[];
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
  const descTrimmed = description.slice(0, 160);

  // F-056 BUG-UX-1 fix 2026-05-21 (per BA pre-golive audit) — add social
  // share meta tags + canonical URL. JSON-LD Article schema (F-051) covers
  // Google indexing; this adds Facebook/Twitter card + canonical for SEO.
  const canonicalUrl = `https://5bib.com/giai-chay/${raceSlug}/recap`;
  const ogImage =
    race.bannerUrl ?? race.imageUrl ?? race.logoUrl ?? undefined;

  return {
    title,
    description: descTrimmed,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description: descTrimmed,
      type: 'article',
      url: canonicalUrl,
      siteName: '5BIB',
      locale: 'vi_VN',
      ...(ogImage && {
        images: [
          {
            url: ogImage,
            alt: recap.raceTitle,
          },
        ],
      }),
      ...(recap.endDate && { publishedTime: recap.endDate }),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description: descTrimmed,
      ...(ogImage && { images: [ogImage] }),
    },
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
  const finishersFormatted = recap.hero.totalFinishers.toLocaleString('vi-VN');
  const registered = recap.hero.registered ?? recap.hero.totalFinishers + recap.hero.dnfCount + recap.hero.dnsCount + recap.hero.dsqCount;

  // F-056 scope expansion 2026-05-21 — pick longest-distance course for
  // Variation A Spotlight + Variation B Overall Champions cards.
  const longestCourseDist = (() => {
    const dist = recap.finisherDistribution ?? [];
    if (dist.length === 0) return undefined;
    return [...dist].sort((a, b) => {
      const da = parseFloat((a.distance ?? '0').replace(',', '.'));
      const db = parseFloat((b.distance ?? '0').replace(',', '.'));
      return db - da;
    })[0];
  })();
  const longestPodium = longestCourseDist
    ? recap.podiums.find((p) => p.courseId === longestCourseDist.courseId)
    : recap.podiums[0];

  // F-056 scope expansion 2026-05-21 — Danny mandate "công bằng + đổi cự ly":
  // Build per-course Top1 NAM + Top1 NỮ data for SpotlightSwitcher tabs.
  // Order: longest distance first (most prestigious as default visible).
  // F-056 bugfix 2026-05-21: pace per-winner (chipTime / distance), KHÔNG dùng
  // course medianPace (đã làm cả NAM + NỮ show identical 7:09/km cho 10KM).
  const spotlightCourses: SpotlightSwitcherCourse[] = [...recap.podiums]
    .sort((a, b) => {
      const da = parseFloat((a.distance ?? '0').replace(',', '.'));
      const db = parseFloat((b.distance ?? '0').replace(',', '.'));
      return db - da;
    })
    .map((p) => {
      const distanceForPace = p.distance ?? p.courseName;
      return {
        courseId: p.courseId,
        label: p.courseName ?? p.distance ?? p.courseId,
        male: p.male[0]
          ? {
              name: p.male[0].name,
              bib: p.male[0].bib,
              chipTime: p.male[0].chipTime,
              category: p.male[0].category,
              city: p.male[0].city,
              pace: computeWinnerPace(p.male[0].chipTime, distanceForPace),
            }
          : undefined,
        female: p.female[0]
          ? {
              name: p.female[0].name,
              bib: p.female[0].bib,
              chipTime: p.female[0].chipTime,
              category: p.female[0].category,
              city: p.female[0].city,
              pace: computeWinnerPace(p.female[0].chipTime, distanceForPace),
            }
          : undefined,
      };
    });
  const watermarkText =
    longestCourseDist?.distance != null
      ? `${longestCourseDist.distance.replace(',', '.')}K`
      : longestPodium?.distance ?? '';

  const sections = [
    { id: 'spotlight', label: 'Spotlight' },
    { id: 'podium', label: 'Podium' },
    { id: 'distribution', label: 'Distribution' },
    { id: 'pace', label: 'Pace' },
    { id: 'negsplit', label: 'Negative Split' },
    { id: 'ag', label: 'Age Group' },
    ...(recap.recapArticles && recap.recapArticles.length > 0
      ? [{ id: 'stories', label: 'Stories' }]
      : []),
    { id: 'insight', label: 'Insight' },
  ];
  // Course pills: prefer `name` (e.g. "21KM" with unit) over `distance` (raw
  // numeric "21" — would lose unit). 2026-05-21+: clickable, scrolls to
  // per-course podium anchor (id="course-${courseId}"). Mirrors recap.podiums
  // courseId so we get one pill per course block in podium section.
  const navCourses = (recap.podiums ?? [])
    .map((p) => {
      // Prefer courseName ("21KM" with unit) over distance ("21" numeric).
      const label = p.courseName ?? p.distance;
      return label
        ? { label, anchorId: `course-${p.courseId}` }
        : null;
    })
    .filter((x): x is { label: string; anchorId: string } => !!x);

  // F-056 scope expansion 2026-05-21 — Hero stat tiles (4-tile ngang).
  // Hide tile if data null (esp. elevationGain — most races don't have).
  const heroTiles: Array<{
    label: string;
    value: string;
    meta?: string;
    accent?: 'blue' | 'magenta' | 'orange' | 'green';
  }> = [];
  if (recap.hero.winningTimeMale) {
    heroTiles.push({
      label: 'WINNING TIME · NAM',
      value: recap.hero.winningTimeMale,
      meta: recap.hero.winningNameMale,
      accent: 'blue',
    });
  }
  if (recap.hero.winningTimeFemale) {
    heroTiles.push({
      label: 'WINNING TIME · NỮ',
      value: recap.hero.winningTimeFemale,
      meta: recap.hero.winningNameFemale,
      accent: 'magenta',
    });
  }
  heroTiles.push({
    label: 'MEDIAN PACE /km',
    value: medianPace.replace('/km', ''),
    meta: 'Toàn cuộc đua',
    accent: 'orange',
  });
  if (recap.hero.elevationGain != null && recap.hero.elevationGain > 0) {
    heroTiles.push({
      label: 'ELEV GAIN',
      value: `${recap.hero.elevationGain.toLocaleString('vi-VN')}m`,
      meta:
        recap.hero.elevationSegments != null
          ? `${recap.hero.elevationSegments} đoạn dốc 800m+`
          : undefined,
      accent: 'green',
    });
  }

  return (
    <div className="bg-stone-50 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      {/* ═══ HERO (Variation A — Editorial Magazine cover) ═══ */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          minHeight: 'clamp(560px, 70vh, 760px)',
        }}
      >
        {/* Background photo + watermark (PAUSE-56-11 A: reuse race banner). */}
        <HeroPhotoLayer
          bannerUrl={bannerUrl}
          watermarkText={watermarkText}
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
          className="absolute top-5 left-6 md:left-12 font-mono font-semibold text-[11px] tracking-[0.08em] z-20"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          5BIB · GIẢI CHẠY · {(race.location ?? '').toUpperCase()} ·{' '}
          <span style={{ color: '#fff' }}>RECAP</span>
        </nav>

        {/* Eyebrow tag top-left below breadcrumb — Hình 1 "5BIB RECAP · JUST DROPPED" */}
        <div
          aria-hidden
          className="absolute top-16 left-6 md:left-12 z-20 inline-flex items-center px-3 py-1 rounded-sm font-mono font-extrabold uppercase text-[10px] tracking-[0.2em]"
          style={{ background: '#FF0E65', color: '#fff' }}
        >
          5BIB RECAP · JUST DROPPED
        </div>

        {/* Content — magazine cover layout */}
        <div className="relative z-10 flex min-h-full flex-col justify-end px-6 pt-32 pb-10 md:px-14 md:pt-36 md:pb-14">
          <div className="max-w-[1200px]">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4">
              {classification ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold uppercase text-[10.5px] tracking-[0.18em] border"
                  style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.95)' }}
                >
                  <span aria-hidden style={{ color: '#FB923C' }}>♀</span>
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
                // Variation A: 88px desktop hero magazine cover scale.
                fontSize: 'clamp(40px, 6vw, 96px)',
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
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              &ldquo;Tổng kết hành trình đường chạy, podium, phân bố pace và câu
              chuyện phía sau những con số.&rdquo;
            </div>

            {/* Action bar (Variation B) — Kết quả đầy đủ / CSV / Share */}
            <div className="mt-6">
              <RecapActionBar
                fullResultsHref={`/giai-chay/${raceSlug}/ket-qua`}
                csvHref={undefined}
                shareHref={undefined}
              />
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

      {/* ═══ HERO STAT TILES (4 tile ngang — Variation B header stats) ═══
          Lifted with -mt-12 to overlap hero accent strip subtly. */}
      {heroTiles.length > 0 ? (
        <div className="relative z-20 max-w-7xl mx-auto px-6 md:px-8 -mt-12 md:-mt-14">
          <HeroStatTilesRow tiles={heroTiles} />
        </div>
      ) : null}

      {/* ═══ STICKY NAV (client island) ═══ */}
      <StickyRecapNav sections={sections} courses={navCourses} />

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="max-w-7xl mx-auto px-6 md:px-8 pt-16 md:pt-20 pb-12 md:pb-16">
        {/* ── SPOTLIGHT THE WIN (Variation A signature, gender-balanced) ──
            Danny mandate 2026-05-21 "cân bằng + nút đổi cự ly": tab switcher
            per course, 2 big cards (NAM + NỮ) cùng size — không bias gender. */}
        {spotlightCourses.length > 0 ? (
          <section id="spotlight" className="mb-16 md:mb-20 scroll-mt-32">
            <SectionHeading
              number="00"
              eyebrow="Spotlight"
              title="THE WIN"
              action={
                <span
                  className="font-mono text-[12px] text-stone-500"
                  style={{ letterSpacing: '0.08em' }}
                >
                  TOP 1 NAM &middot; TOP 1 NỮ MỖI CỰ LY
                </span>
              }
            />
            <SpotlightSwitcher courses={spotlightCourses} defaultIndex={0} />
          </section>
        ) : null}

        {/* ── PODIUM (per course M|F) ── */}
        <section id="podium" className="mb-16 md:mb-20 scroll-mt-32">
          <SectionHeading
            number="01"
            eyebrow="Bảng vinh danh per course"
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
              <div
                key={p.courseId}
                id={`course-${p.courseId}`}
                className="mb-10 last:mb-0 scroll-mt-32"
              >
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

        {/* ── DISTRIBUTION (Variation B bar chart + Champions card) ── */}
        {recap.finisherDistribution && recap.finisherDistribution.length > 0 ? (
          <section id="distribution" className="mb-16 md:mb-20 scroll-mt-32">
            <SectionHeading number="02" eyebrow="Theo course" title="FINISHER DISTRIBUTION" />
            <div className="grid gap-6 md:gap-8 md:grid-cols-[1.5fr_1fr]">
              <FinisherDistributionBars
                rows={recap.finisherDistribution}
                total={recap.hero.totalFinishers}
              />
              {longestPodium ? (
                <OverallChampionsCard
                  courseLabel={longestPodium.distance ?? longestPodium.courseName}
                  male={
                    longestPodium.male[0]
                      ? {
                          name: longestPodium.male[0].name,
                          bib: longestPodium.male[0].bib,
                          chipTime: longestPodium.male[0].chipTime,
                          city: longestPodium.male[0].city,
                        }
                      : undefined
                  }
                  female={
                    longestPodium.female[0]
                      ? {
                          name: longestPodium.female[0].name,
                          bib: longestPodium.female[0].bib,
                          chipTime: longestPodium.female[0].chipTime,
                          city: longestPodium.female[0].city,
                        }
                      : undefined
                  }
                  ctaHref={`/giai-chay/${raceSlug}/ket-qua`}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── PACE (Variation A 2-col narrative) ── */}
        <section id="pace" className="mb-16 md:mb-20 scroll-mt-32">
          <SectionHeading number="03" eyebrow="The shape of the race" title="PACE CURVE" />
          {firstPace ? (
            <PaceCurveNarrativeBlock
              distribution={firstPace.distribution}
              medianPace={firstPace.medianPace}
              p10Pace={firstPace.p10Pace}
              p90Pace={firstPace.p90Pace}
              finisherCount={firstPace.finisherCount}
              storyHeadline={`Một cuộc đua ${firstPace.medianPace.replace('/km', '/km')} median — hai nửa hoàn toàn khác nhau.`}
              storyBody={`Median pace toàn cuộc đua dừng ở ${firstPace.medianPace.replace('/km', '/km')} — top 10% chạy dưới ${firstPace.p10Pace.replace('/km', '/km')}, bottom 10% trên ${firstPace.p90Pace.replace('/km', '/km')}. ${paceSpread(firstPace.p10Pace, firstPace.p90Pace)} spread giữa các nhóm pace.`}
            />
          ) : (
            <p className="text-stone-500 italic">Chưa có dữ liệu pace.</p>
          )}
        </section>

        {/* ── NEG SPLIT (Variation B donut to + half-time table) ── */}
        <section id="negsplit" className="mb-16 md:mb-20 scroll-mt-32">
          <SectionHeading number="04" eyebrow="Pacing strategy" title="NEGATIVE SPLIT %" />
          {recap.negativeSplits.length > 0 ? (
            <NegSplitDonutLarge
              percent={recap.negativeSplits[0].negativeSplitPercent}
              benchmark={recap.negativeSplits[0].benchmark ?? 40}
              avgFirstHalf={recap.negativeSplits[0].avgFirstHalf}
              avgSecondHalf={recap.negativeSplits[0].avgSecondHalf}
              deltaSeconds={recap.negativeSplits[0].deltaSeconds}
              finishersAnalyzed={recap.negativeSplits[0].finishersAnalyzed ?? 0}
              interpretation={recap.negativeSplits[0].interpretation}
            />
          ) : (
            <p className="text-stone-500 italic">Chưa có dữ liệu split.</p>
          )}
        </section>

        {/* ── AG BREAKDOWN (Variation B table với filter tabs static) ── */}
        <section id="ag" className="mb-16 md:mb-20 scroll-mt-32">
          <SectionHeading
            number="05"
            eyebrow="Age group"
            title="TOP 3 MỖI BRACKET"
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
            <AGBreakdownTable
              rows={recap.agBreakdowns.flatMap((ag) =>
                ag.buckets.map((b) => ({
                  courseId: ag.courseId,
                  courseName: ag.courseName,
                  bucket: {
                    category: b.category,
                    finisherCount: b.finisherCount,
                    top5: b.top5.map((t) => ({
                      name: t.name,
                      bib: t.bib,
                      chipTime: t.chipTime,
                      medal: t.medal,
                    })),
                  },
                })),
              )}
            />
          )}
        </section>

        {/* ── 5BIB STORIES (auto-generated articles per Phase 4) ── */}
        {recap.recapArticles && recap.recapArticles.length > 0 ? (
          <section id="stories" className="mb-16 md:mb-20 scroll-mt-32">
            <SectionHeading
              number="06"
              eyebrow="5BIB Stories"
              title="BÀI VIẾT TỪ HỆ THỐNG"
              action={
                <span
                  className="font-mono text-[12px] text-stone-500"
                  style={{ letterSpacing: '0.08em' }}
                >
                  {recap.recapArticles.length} BÀI · TỰ ĐỘNG TỔNG HỢP
                </span>
              }
            />
            <div className="grid gap-4 md:gap-5 md:grid-cols-2">
              {recap.recapArticles.map((article) => (
                <RecapStoryCard
                  key={article.slug}
                  slug={article.slug}
                  title={article.title}
                  summary={article.summary}
                  category={article.category}
                  readMinutes={article.readMinutes}
                  html={article.html}
                  source={article.source}
                  publishedAt={article.publishedAt}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── INSIGHT ── */}
        <section id="insight" className="mb-12 scroll-mt-32">
          <SectionHeading number="07" eyebrow="5BIB Editorial" title="INSIGHT" />
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

