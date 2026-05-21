/**
 * FEATURE-047 — Athlete Profile page `/runners/[slug]` programmatic SEO.
 *
 * Server Component SSR. 6 blocks inline (F-046 pattern reuse):
 * Hero (banner gradient + avatar + name + chips) → PR records → Race history table
 * → AG rank summary → Stats → Photos gallery (Phase 1A empty state).
 *
 * Phase 1B will add admin editorial bio + photo upload UI.
 *
 * FEATURE-051 — AI search-first SEO layer (additive):
 *   - Extended JSON-LD Person schema (nationality, knowsAbout, performerIn, dateCreated/Modified)
 *   - BreadcrumbList JSON-LD (separate <script>)
 *   - FAQPage JSON-LD with 5 auto-generated Q&A pairs
 *   - AI-friendly lead paragraph (80-120 từ, factual, ISO 8601 dates)
 *   - Canonical URL via metadata.alternates.canonical
 *   - Twitter Card summary_large_image
 *   - Dynamic OG image via co-located opengraph-image.tsx route
 *
 * Per scope lock, F-051 owns: head metadata block + 3 JSON-LD scripts + lead paragraph.
 * F-050 owns hero/stats/race-history body content (non-overlapping regions).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

import { RaceHistoryTable, type RaceHistoryRow } from './race-history-table';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';
const SITE_ORIGIN = 'https://5bib.com';

interface PRRecord {
  distance: '5K' | '10K' | 'HM' | 'FM';
  chipTime: string;
  raceId: string;
  raceSlug: string;
  raceTitle: string;
  raceDate?: string;
}

// F-050 — best-AG performance card data
interface BestAgRank {
  raceId: string;
  raceSlug: string;
  raceTitle: string;
  raceDate?: string;
  rank: string;
  bracket?: string;
}

// F-050 — distance specialist groups (count ≥3 finished races same distance)
interface DistanceSpecialist {
  distance: string;
  count: number;
}

interface AthleteProfile {
  slug: string;
  canonicalName: string;
  primaryBib: string;
  gender?: string | null;
  province?: string;
  nationality?: string;
  club?: string;
  ageGroupSnapshot?: string;
  totalRaces: number;
  totalFinished: number;
  totalDNF: number;
  totalDNS?: number;
  totalDSQ?: number;
  prRecords: PRRecord[];
  raceHistory: RaceHistoryRow[];
  lastRaceDate?: string;
  avatarUrl?: string;
  computedAt: string;
  // ── F-050 race-ops additions (all optional, frontend hides on undefined) ──
  bestAgRank?: BestAgRank;
  streak?: number;
  distanceSpecialist?: DistanceSpecialist[];
  provinces?: string[];
}

async function getAthleteProfile(slug: string): Promise<AthleteProfile | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/race-results/athletes/${encodeURIComponent(slug)}`,
      {
        next: {
          revalidate: 1800,
          tags: [`athlete:profile:${slug}`, 'runners:profile'],
        },
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`[runners] backend returned ${res.status}`);
      return null;
    }
    return (await res.json()) as AthleteProfile;
  } catch (err) {
    console.error('[runners] fetch failed:', err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getAthleteProfile(slug);
  if (!profile) return { title: 'Athlete profile không tồn tại | 5BIB' };

  // BR-47-25: <title> "[Athlete Name] — VĐV [Total Races] giải | 5BIB"
  const title = `${profile.canonicalName} — VĐV ${profile.totalRaces} giải | 5BIB`;

  // BR-47-26: <meta description>
  const fmPR = profile.prRecords.find((p) => p.distance === 'FM');
  const hmPR = profile.prRecords.find((p) => p.distance === 'HM');
  const prFragments: string[] = [];
  if (fmPR) prFragments.push(`PR Marathon ${fmPR.chipTime}`);
  if (hmPR) prFragments.push(`PR HM ${hmPR.chipTime}`);
  const prText = prFragments.length > 0 ? `, ${prFragments.join(', ')}` : '';
  const description =
    `Profile VĐV ${profile.canonicalName}: ${profile.totalRaces} giải đã chạy${prText}. Lịch sử đầy đủ trên 5BIB.`.slice(
      0,
      160,
    );

  // F-051 — canonical URL prevents duplicate indexing
  const canonicalUrl = `${SITE_ORIGIN}/runners/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: 'profile',
      url: canonicalUrl,
      siteName: '5BIB',
      locale: 'vi_VN',
      // Next.js 16 picks up co-located opengraph-image.tsx automatically;
      // explicit array kept for clarity + crawler-safe absolute URL.
      images: [
        {
          url: `${canonicalUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${profile.canonicalName} — Hồ sơ vận động viên 5BIB`,
        },
      ],
    },
    twitter: {
      // F-051 — upgrade to summary_large_image so OG renders as full card
      card: 'summary_large_image',
      title,
      description,
      images: [`${canonicalUrl}/opengraph-image`],
    },
  };
}

// ─── F-051 SEO/AI-search helpers ──────────────────────────────────────────

/**
 * Derive earliest race date from race history (already DESC-sorted by service).
 * Used for JSON-LD Person `dateCreated` — when this athlete first appeared on 5BIB.
 */
function deriveDateCreated(profile: AthleteProfile): string | undefined {
  const dates = profile.raceHistory
    .map((r) => r.raceDate)
    .filter((d): d is string => Boolean(d));
  if (dates.length === 0) return undefined;
  return dates.reduce((min, cur) => (cur < min ? cur : min));
}

/**
 * Derive top-3 podium award strings (kept from F-047 baseline behaviour).
 */
function deriveAwards(profile: AthleteProfile): string[] {
  return profile.raceHistory
    .filter((r) => r.overallRank && parseInt(r.overallRank, 10) <= 3)
    .slice(0, 5)
    .map((r) => `Top ${r.overallRank} — ${r.raceTitle}`);
}

/**
 * Infer sport keywords from race history distance/course names.
 * Drives JSON-LD Person.knowsAbout + AI search topical signal.
 */
function deriveKnowsAbout(profile: AthleteProfile): string[] {
  const topics = new Set<string>(['Running']);
  for (const r of profile.raceHistory) {
    const hay = `${r.distance ?? ''} ${r.courseName ?? ''} ${r.raceTitle ?? ''}`.toLowerCase();
    if (/trail|ultra|jungle|mountain|forest|peak/.test(hay)) topics.add('Trail Running');
    if (/marathon|42k|42km|fm\b/.test(hay)) topics.add('Marathon');
    if (/half|21k|21km|\bhm\b/.test(hay)) topics.add('Half Marathon');
    if (/^|[^0-9]5k|^5km/.test(hay)) topics.add('5K Road Race');
    if (/10k|10km/.test(hay)) topics.add('10K Road Race');
  }
  return Array.from(topics);
}

/**
 * BR-47-27 + F-051 — extended JSON-LD Person schema.
 *
 * F-047 baseline (kept):    name, url, gender, nationality, affiliation, image, award
 * F-051 additions:          alternateName, mainEntityOfPage, knowsAbout, performerIn[],
 *                            dateCreated, dateModified
 *
 * Nationality upgraded to schema.org Country structured form (was string fallback).
 */
function buildPersonSchema(profile: AthleteProfile, slug: string): string {
  const url = `${SITE_ORIGIN}/runners/${slug}`;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.canonicalName,
    url,
    mainEntityOfPage: url,
  };

  // alternateName — last word of canonical (commonly the given name in VN convention)
  const nameParts = profile.canonicalName.trim().split(/\s+/);
  if (nameParts.length > 1) {
    ld.alternateName = nameParts[nameParts.length - 1];
  }

  if (profile.gender) {
    ld.gender =
      profile.gender === 'male'
        ? 'https://schema.org/Male'
        : profile.gender === 'female'
          ? 'https://schema.org/Female'
          : profile.gender;
  }
  if (profile.nationality) {
    ld.nationality = { '@type': 'Country', name: profile.nationality };
  }
  if (profile.club) {
    ld.affiliation = { '@type': 'Organization', name: profile.club };
  }
  if (profile.avatarUrl) ld.image = profile.avatarUrl;

  const awards = deriveAwards(profile);
  if (awards.length > 0) ld.award = awards;

  const knowsAbout = deriveKnowsAbout(profile);
  if (knowsAbout.length > 0) ld.knowsAbout = knowsAbout;

  // performerIn — top 10 most-recent SportsEvent (race history already DESC by date)
  const performerIn = profile.raceHistory.slice(0, 10).map((r) => {
    const event: Record<string, unknown> = {
      '@type': 'SportsEvent',
      name: r.raceTitle,
      url: `${SITE_ORIGIN}/giai-chay/${r.raceSlug}`,
      sport: /trail|ultra/i.test(`${r.distance ?? ''} ${r.courseName ?? ''}`)
        ? 'Trail Running'
        : 'Road Running',
    };
    if (r.raceDate) event.startDate = r.raceDate.slice(0, 10);
    if (r.distance) event.description = `Cự ly ${r.distance}`;
    return event;
  });
  if (performerIn.length > 0) ld.performerIn = performerIn;

  const dateCreated = deriveDateCreated(profile);
  if (dateCreated) ld.dateCreated = dateCreated;

  // PAUSE-51-06 — `dateModified` = max(synced_at) ≈ profile.computedAt (refresh tick).
  ld.dateModified = profile.computedAt;

  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

/**
 * F-051 — BreadcrumbList JSON-LD (separate <script>).
 * Mirrors visible breadcrumb UI: Trang chủ › Giải chạy › <Athlete>.
 */
function buildBreadcrumbSchema(profile: AthleteProfile, slug: string): string {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Trang chủ',
        item: SITE_ORIGIN,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Giải chạy',
        item: `${SITE_ORIGIN}/giai-chay`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: profile.canonicalName,
        item: `${SITE_ORIGIN}/runners/${slug}`,
      },
    ],
  };
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

/**
 * F-051 (PAUSE-51-02 accepted: 5 Q&A) — auto-generate FAQ schema from profile data.
 *
 * 5 questions cover: totalRaces, PR, race types, last race, AG rank.
 * Answers strictly factual, no marketing fluff. Skips Q if data unavailable to
 * avoid empty/placeholder answers that hurt Rich Results validation.
 */
function buildFaqSchema(profile: AthleteProfile): string | null {
  const qa: Array<{ q: string; a: string }> = [];
  const name = profile.canonicalName;

  // Q1 — totalRaces breakdown
  const breakdownParts: string[] = [`${profile.totalFinished} về đích`];
  if (profile.totalDNF > 0) breakdownParts.push(`${profile.totalDNF} DNF`);
  if ((profile.totalDNS ?? 0) > 0) breakdownParts.push(`${profile.totalDNS} DNS`);
  if ((profile.totalDSQ ?? 0) > 0) breakdownParts.push(`${profile.totalDSQ} DSQ`);
  qa.push({
    q: `${name} đã chạy bao nhiêu giải trên 5BIB?`,
    a: `${profile.totalRaces} giải, trong đó ${breakdownParts.join(', ')}.`,
  });

  // Q2 — best PR across 4 distances
  const allPRs = profile.prRecords;
  const bestPR =
    allPRs.find((p) => p.distance === 'FM') ??
    allPRs.find((p) => p.distance === 'HM') ??
    allPRs.find((p) => p.distance === '10K') ??
    allPRs.find((p) => p.distance === '5K');
  if (bestPR) {
    const distLabel =
      bestPR.distance === 'FM'
        ? 'Marathon'
        : bestPR.distance === 'HM'
          ? 'Half Marathon'
          : bestPR.distance;
    qa.push({
      q: `Personal Best ${distLabel} của ${name}?`,
      a: `${bestPR.chipTime} tại giải ${bestPR.raceTitle}${bestPR.raceDate ? ` (${bestPR.raceDate.slice(0, 10)})` : ''}.`,
    });
  }

  // Q3 — race types
  const knowsAbout = deriveKnowsAbout(profile).filter((t) => t !== 'Running');
  if (knowsAbout.length > 0) {
    qa.push({
      q: `${name} thi đấu các cự ly nào?`,
      a: `Đã tham gia: ${knowsAbout.join(', ')}.`,
    });
  }

  // Q4 — last race
  const lastRace = profile.raceHistory[0];
  if (lastRace) {
    const dateStr = lastRace.raceDate ? lastRace.raceDate.slice(0, 10) : 'chưa rõ ngày';
    const rankStr =
      lastRace.status === 'finished' && lastRace.overallRank
        ? ` (xếp hạng ${lastRace.overallRank})`
        : '';
    qa.push({
      q: `Giải đua gần nhất của ${name}?`,
      a: `${lastRace.raceTitle} ngày ${dateStr}${rankStr}.`,
    });
  }

  // Q5 — current AG bracket
  if (profile.ageGroupSnapshot) {
    qa.push({
      q: `${name} thuộc nhóm tuổi (AG) nào?`,
      a: `Nhóm tuổi gần nhất: ${profile.ageGroupSnapshot}.`,
    });
  }

  if (qa.length === 0) return null;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

/**
 * PAUSE-51-03 accepted — AI-friendly factual lead paragraph (80-120 từ target).
 * Deterministic template — no LLM call. Skips fragments when data missing so
 * crawler never sees placeholder text like "chưa rõ".
 */
function buildLeadParagraph(profile: AthleteProfile): string {
  const name = profile.canonicalName;
  const bib = profile.primaryBib;
  const nationality = profile.nationality ?? 'Việt Nam';
  const totalRaces = profile.totalRaces;

  const dateCreated = deriveDateCreated(profile);
  const yearRange =
    dateCreated && profile.lastRaceDate
      ? `từ ${dateCreated.slice(0, 4)} đến ${profile.lastRaceDate.slice(0, 4)}`
      : dateCreated
        ? `từ ${dateCreated.slice(0, 4)}`
        : '';

  const knowsAbout = deriveKnowsAbout(profile).filter((t) => t !== 'Running');
  const sportSummary =
    knowsAbout.length > 0 ? `chuyên ${knowsAbout.join(', ').toLowerCase()}` : 'chạy bộ phong trào';

  // Best PR fragment
  const bestPR =
    profile.prRecords.find((p) => p.distance === 'FM') ??
    profile.prRecords.find((p) => p.distance === 'HM') ??
    profile.prRecords.find((p) => p.distance === '10K') ??
    profile.prRecords.find((p) => p.distance === '5K');
  const prFragment = bestPR
    ? ` Personal Best ${bestPR.distance === 'FM' ? 'Marathon' : bestPR.distance === 'HM' ? 'Half Marathon' : bestPR.distance} hiện tại ${bestPR.chipTime} tại giải ${bestPR.raceTitle}.`
    : '';

  // Finished races recap — top 3 unique race titles
  const finishedTitles = Array.from(
    new Set(
      profile.raceHistory.filter((r) => r.status === 'finished').map((r) => r.raceTitle),
    ),
  );
  const finishedFragment =
    profile.totalFinished > 0
      ? ` Đã hoàn thành ${profile.totalFinished} giải về đích${
          finishedTitles.length > 0
            ? ` bao gồm ${finishedTitles.slice(0, 3).join(', ')}`
            : ''
        }.`
      : '';

  const clubFragment = profile.club ? ` Thành viên câu lạc bộ ${profile.club}.` : '';
  const agFragment = profile.ageGroupSnapshot
    ? ` Nhóm tuổi thi đấu hiện tại ${profile.ageGroupSnapshot}.`
    : '';

  // Most-recent race fragment — strengthens recency signal for AI search
  const lastRace = profile.raceHistory[0];
  const lastRaceFragment = lastRace
    ? ` Giải gần nhất là ${lastRace.raceTitle}${lastRace.raceDate ? ` ngày ${lastRace.raceDate.slice(0, 10)}` : ''}.`
    : '';

  return (
    `${name} (BIB ${bib}) là vận động viên ${nationality} đã tham gia ${totalRaces} giải chạy trên hệ thống 5BIB ${yearRange}, ${sportSummary}.` +
    prFragment +
    finishedFragment +
    lastRaceFragment +
    clubFragment +
    agFragment
  ).trim();
}

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getAthleteProfile(slug);
  if (!profile) notFound();

  const personLd = buildPersonSchema(profile, slug);
  const breadcrumbLd = buildBreadcrumbSchema(profile, slug);
  const faqLd = buildFaqSchema(profile);
  const leadParagraph = buildLeadParagraph(profile);

  const initials = profile.canonicalName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(-2)
    .join('')
    .toUpperCase();

  // ── F-050 — qualify achievement badges. All thresholds locked via PAUSE defaults.
  const streakBadge =
    profile.streak !== undefined && profile.streak >= 5
      ? `🔥 ${profile.streak} race về đích liên tiếp`
      : null;
  const specialistBadges =
    profile.distanceSpecialist
      ?.filter((s) => s.count >= 3)
      .map((s) => `🎯 ${s.distance} specialist (${s.count} lần)`) ?? [];
  const geographicBadge =
    profile.provinces && profile.provinces.length >= 3
      ? `🌍 Đã chạy ${profile.provinces.length} tỉnh: ${profile.provinces.slice(0, 5).join(', ')}${
          profile.provinces.length > 5 ? '…' : ''
        }`
      : null;
  const hasAnyBadge = Boolean(
    streakBadge || specialistBadges.length > 0 || geographicBadge,
  );

  return (
    <div>
      {/* F-051 — three JSON-LD scripts (Person + BreadcrumbList + FAQPage).
          Separate <script> tags per Google's Rich Results recommendation. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: personLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqLd }}
        />
      )}

      {/* Hero block — gradient bg + avatar + name + chips */}
      <div className="relative h-48 w-full bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 md:h-56">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
        <div className="absolute bottom-0 left-0 right-0 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto flex max-w-5xl items-end gap-4">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-xl md:h-24 md:w-24"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-2xl font-bold text-blue-700 ring-4 ring-white shadow-xl md:h-24 md:w-24 md:text-3xl">
                {initials || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="inline-block rounded-full bg-blue-100/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-900">
                Vận động viên
              </span>
              <h1 className="mt-1 text-2xl font-bold text-white drop-shadow-lg md:text-4xl">
                {profile.canonicalName}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded bg-white/20 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                  #{profile.primaryBib}
                </span>
                {profile.gender && (
                  <span className="rounded bg-white/20 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                    {profile.gender === 'male' ? 'Nam' : profile.gender === 'female' ? 'Nữ' : '—'}
                  </span>
                )}
                {profile.ageGroupSnapshot && (
                  /* F-050 — promote AG bracket to highlighted amber chip (race-day signal). */
                  <span className="rounded bg-amber-400/30 px-2 py-1 text-xs font-semibold text-white backdrop-blur ring-1 ring-amber-200/60">
                    🏷️ {profile.ageGroupSnapshot}
                  </span>
                )}
                {profile.club && (
                  <span className="rounded bg-white/20 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                    🏃 {profile.club}
                  </span>
                )}
                <span className="rounded bg-white/30 px-2 py-1 text-xs font-bold text-white">
                  VĐV {profile.totalRaces} giải
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 md:py-10">
        {/* F-051 PAUSE-51-03 — AI-friendly lead paragraph.
            Always in DOM for crawlers + AI search engines (Google SGE / ChatGPT /
            Perplexity / Gemini). Hidden visually on mobile to preserve hero focus,
            visible desktop as factual lede. */}
        <p
          className="mb-6 sr-only text-sm leading-relaxed text-stone-700 md:not-sr-only md:rounded-lg md:border md:border-stone-200 md:bg-stone-50 md:p-4 md:text-base"
          data-seo="lead"
        >
          {leadParagraph}
        </p>

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
          <span className="text-stone-900">{profile.canonicalName}</span>
        </nav>

        {/* F-050 — Thành tích nổi bật badges (streak + specialist + geographic).
            Block hidden entirely when no badges qualify. */}
        {hasAnyBadge && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">
              Thành tích nổi bật
            </h2>
            <div className="flex flex-wrap gap-2">
              {streakBadge && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-800 ring-1 ring-orange-200">
                  {streakBadge}
                </span>
              )}
              {specialistBadges.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-800 ring-1 ring-blue-200"
                >
                  {b}
                </span>
              ))}
              {geographicBadge && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  {geographicBadge}
                </span>
              )}
            </div>
          </section>
        )}

        {/* Block 1: PR Records (4 cards grid) */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-stone-900">
            Personal Records
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(['5K', '10K', 'HM', 'FM'] as const).map((distance) => {
              const pr = profile.prRecords.find((p) => p.distance === distance);
              return (
                <div
                  key={distance}
                  className="rounded-lg border border-stone-200 bg-white p-4"
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                    {distance === 'HM' ? 'Half Marathon' : distance === 'FM' ? 'Marathon' : distance}
                  </div>
                  <div className={`mt-1 font-mono text-xl font-bold ${pr ? 'text-blue-700' : 'text-stone-300'}`}>
                    {pr ? pr.chipTime : '—'}
                  </div>
                  {pr && (
                    <Link
                      href={`/giai-chay/${pr.raceSlug}`}
                      className="mt-2 block truncate text-xs text-stone-600 hover:text-blue-700"
                      title={pr.raceTitle}
                    >
                      {pr.raceTitle}
                    </Link>
                  )}
                  {!pr && <div className="mt-2 text-xs text-stone-400">Chưa có PR</div>}
                </div>
              );
            })}
          </div>

          {/* F-050 — Best AG performance card. Show only when categoryRank is available
              in at least one finished race. Graceful hide otherwise. */}
          {profile.bestAgRank && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center gap-3">
                <div className="text-2xl" aria-hidden="true">
                  🏅
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                    Thành tích AG xuất sắc nhất
                  </div>
                  <div className="mt-1 text-base font-semibold text-stone-900">
                    Hạng {profile.bestAgRank.rank}
                    {profile.bestAgRank.bracket
                      ? ` — ${profile.bestAgRank.bracket}`
                      : ''}
                  </div>
                  <Link
                    href={`/giai-chay/${profile.bestAgRank.raceSlug}`}
                    className="mt-1 block truncate text-sm text-stone-600 hover:text-blue-700"
                    title={profile.bestAgRank.raceTitle}
                  >
                    {profile.bestAgRank.raceTitle}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Block 2: Stats */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-stone-900">Thống kê</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Tổng giải" value={profile.totalRaces} color="text-stone-900" />
            <StatCard label="Về đích" value={profile.totalFinished} color="text-blue-700" />
            <StatCard label="DNF" value={profile.totalDNF} color="text-orange-600" />
            <StatCard label="DNS" value={profile.totalDNS ?? 0} color="text-stone-500" />
            <StatCard label="DSQ" value={profile.totalDSQ ?? 0} color="text-red-600" />
          </div>
        </section>

        {/* Block 3: Race History table — F-050 client component with race-ops columns
            (classification icon, D+, AG rank) + gun time toggle persisted in localStorage. */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-stone-900">
            Lịch sử race ({profile.raceHistory.length})
          </h2>
          {profile.raceHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-stone-600">
              Chưa có dữ liệu race
            </div>
          ) : (
            <RaceHistoryTable rows={profile.raceHistory} />
          )}
        </section>

        {/* Block 4: Photos gallery (Phase 1B — approved photos signed URL 24h) */}
        <PhotosBlock slug={slug} />


        {/* Footer info */}
        <footer className="mt-8 border-t border-stone-200 pt-4 text-xs text-stone-500">
          Cập nhật: {new Date(profile.computedAt).toLocaleString('vi-VN')}
        </footer>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className={`text-3xl font-bold ${color}`}>{value.toLocaleString('vi-VN')}</div>
      <div className="mt-1 text-sm text-stone-600">{label}</div>
    </div>
  );
}

interface PhotoItem {
  id: string;
  type: 'selfie' | 'bib_photo' | 'finish_line';
  s3Url: string;
  raceId?: string;
  bib?: string;
  uploadedAt: string;
}

async function fetchApprovedPhotos(slug: string): Promise<PhotoItem[]> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/race-results/athletes/${encodeURIComponent(slug)}/photos`,
      { next: { revalidate: 600, tags: [`athlete:photos:${slug}`] } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { photos: PhotoItem[] };
    return data.photos ?? [];
  } catch {
    return [];
  }
}

async function PhotosBlock({ slug }: { slug: string }) {
  const photos = await fetchApprovedPhotos(slug);

  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-semibold text-stone-900">
        Ảnh ({photos.length})
      </h2>
      {photos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
          <p className="text-sm text-stone-700">
            Chưa có ảnh được duyệt. VĐV có thể đăng nhập để upload ảnh.
          </p>
          <Link
            href="/login?redirect=/runners/${slug}/upload"
            className="mt-3 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Đăng nhập để upload
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {photos.map((p) => (
            <div
              key={p.id}
              className="aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.s3Url}
                alt={`${p.type}`}
                className="h-full w-full object-cover transition hover:scale-105"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export const revalidate = 1800;
