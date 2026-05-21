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

      {/* ── HERO — editorial magazine layout. Topo SVG overlay + oversized
            race count as floating display number. Avatar with ambient conic
            spin (.ap-avatar-ring from globals.css). Diagonal gradient accent
            bottom for athletic-broadcast vibe. */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-900">
        {/* topographic line pattern overlay — trail/race-day texture */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07] mix-blend-screen"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="topo" width="240" height="240" patternUnits="userSpaceOnUse">
              <path d="M0 60 Q60 20 120 60 T240 60" fill="none" stroke="white" strokeWidth="1" />
              <path d="M0 120 Q60 80 120 120 T240 120" fill="none" stroke="white" strokeWidth="1" />
              <path d="M0 180 Q60 140 120 180 T240 180" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo)" />
        </svg>
        {/* warm-tone gradient wash for depth + readable text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        {/* diagonal accent strip — 5BIB blue↗orange (energy) bar across bottom */}
        <div
          className="absolute bottom-0 left-0 h-1.5 w-full"
          style={{
            background:
              'linear-gradient(90deg, var(--5bib-accent) 0%, var(--5bib-accent) 55%, var(--5bib-energy) 100%)',
          }}
        />

        <div className="relative mx-auto flex min-h-[18rem] max-w-6xl flex-col justify-end px-4 py-10 md:min-h-[22rem] md:px-8 md:py-14">
          <div className="flex items-end gap-5 md:gap-8">
            {/* Avatar with conic ambient ring — perpetually subtle motion */}
            <div className="ap-avatar-ring shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-24 w-24 rounded-full object-cover ring-[3px] ring-white/95 shadow-2xl md:h-32 md:w-32"
                />
              ) : (
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-white to-stone-100 text-3xl font-bold text-blue-800 ring-[3px] ring-white/95 shadow-2xl md:h-32 md:w-32 md:text-4xl"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
                >
                  {initials || '?'}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/90">
                  Vận động viên
                </span>
              </div>
              <h1
                className="mt-2 text-3xl font-bold leading-[1.05] text-white drop-shadow-lg md:text-5xl"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                {profile.canonicalName}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 font-mono text-xs font-semibold text-white backdrop-blur-sm ring-1 ring-white/20">
                  <span className="opacity-60">BIB</span>
                  <span className="tabular-nums">{profile.primaryBib}</span>
                </span>
                {profile.gender && (
                  <span className="inline-block rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/20">
                    {profile.gender === 'male'
                      ? 'Nam'
                      : profile.gender === 'female'
                        ? 'Nữ'
                        : '—'}
                  </span>
                )}
                {profile.ageGroupSnapshot && (
                  /* AG bracket promoted to MEDAL-style amber pill */
                  <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-br from-amber-300/95 to-amber-500/90 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-[0_0_0_1px_rgba(252,211,77,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]">
                    <span aria-hidden="true">🏷️</span>
                    <span>{profile.ageGroupSnapshot}</span>
                  </span>
                )}
                {profile.club && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/20">
                    <span aria-hidden="true">🏃</span>
                    <span className="truncate max-w-[160px]">{profile.club}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Oversized race count — editorial display number. Hidden mobile,
                visible md+ as RIGHT-aligned hero stat. */}
            <div className="hidden md:flex md:flex-col md:items-end md:justify-end md:self-end md:pl-4">
              <div
                className="text-7xl font-bold leading-none text-white tabular-nums drop-shadow-lg"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em' }}
              >
                {profile.totalRaces}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-100/80">
                Giải đã tham gia
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {/* Breadcrumb — refined, smaller, with custom chevron + uppercase */}
        <nav
          className="mb-8 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500"
          aria-label="Breadcrumb"
        >
          <Link href="/" className="hover:text-blue-700">
            Trang chủ
          </Link>
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <Link href="/giai-chay" className="hover:text-blue-700">
            Giải chạy
          </Link>
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span className="truncate text-stone-900">{profile.canonicalName}</span>
        </nav>

        {/* F-051 PAUSE-51-03 — AI-friendly lead paragraph. Editorial italic
            treatment with left accent bar. Always in DOM for crawlers + AI
            search engines (SGE / ChatGPT / Perplexity / Gemini). */}
        <p
          className="mb-10 sr-only italic leading-relaxed text-stone-700 md:not-sr-only md:relative md:border-l-2 md:border-blue-700 md:pl-5 md:text-[15px] md:[font-family:var(--font-display)] md:before:absolute md:before:-left-[2px] md:before:top-0 md:before:h-2 md:before:w-2 md:before:-translate-x-1/2 md:before:rounded-full md:before:bg-blue-700"
          data-seo="lead"
        >
          {leadParagraph}
        </p>

        {/* F-050 — Thành tích nổi bật badges (streak + specialist + geographic).
            Sculpted segmented pills with icon left + text right. */}
        {hasAnyBadge && (
          <section className="mb-10">
            <h2
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Thành tích nổi bật
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {streakBadge && (
                /* Streak — orange with subtle pulse on the flame */
                <span className="group inline-flex items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-orange-200 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="flex h-8 items-center bg-gradient-to-br from-orange-500 to-orange-600 px-3 text-base text-white">
                    🔥
                  </span>
                  <span className="px-3.5 py-1.5 text-sm font-semibold text-orange-900">
                    {streakBadge.replace('🔥 ', '')}
                  </span>
                </span>
              )}
              {specialistBadges.map((b) => (
                <span
                  key={b}
                  className="group inline-flex items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-blue-200 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="flex h-8 items-center bg-gradient-to-br from-blue-600 to-blue-700 px-3 text-base text-white">
                    🎯
                  </span>
                  <span className="px-3.5 py-1.5 text-sm font-semibold text-blue-900">
                    {b.replace('🎯 ', '')}
                  </span>
                </span>
              ))}
              {geographicBadge && (
                <span className="group inline-flex items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-emerald-200 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="flex h-8 items-center bg-gradient-to-br from-emerald-600 to-emerald-700 px-3 text-base text-white">
                    🌍
                  </span>
                  <span className="px-3.5 py-1.5 text-sm font-semibold text-emerald-900">
                    {geographicBadge.replace('🌍 ', '')}
                  </span>
                </span>
              )}
            </div>
          </section>
        )}

        {/* ── PR Records — 4 cards with color-coded distance accent bar (Strava-style)
              + oversized mono chip time (display font) + race link with underline reveal. */}
        <section className="mb-12">
          <div className="mb-5 flex items-baseline justify-between">
            <h2
              className="text-2xl font-bold text-stone-900"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
            >
              Personal Records
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
              Best Times
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {(['5K', '10K', 'HM', 'FM'] as const).map((distance) => {
              const pr = profile.prRecords.find((p) => p.distance === distance);
              const accent = PR_DISTANCE_ACCENT[distance];
              return (
                <div
                  key={distance}
                  className="group relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:ring-stone-300"
                >
                  {/* color-coded vertical accent bar on left edge */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${accent.bar}`}
                  />
                  <div className="flex items-center justify-between">
                    <div
                      className={`text-[10px] font-bold uppercase tracking-[0.18em] ${accent.label}`}
                    >
                      {distance === 'HM' ? 'Half Marathon' : distance === 'FM' ? 'Marathon' : distance + ' Race'}
                    </div>
                    {pr && (
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${accent.dot}`}
                        aria-hidden="true"
                      >
                        ★
                      </span>
                    )}
                  </div>
                  <div
                    className={`mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight md:text-[2rem] ${
                      pr ? accent.time : 'text-stone-300'
                    }`}
                  >
                    {pr ? pr.chipTime : '—:—:—'}
                  </div>
                  {pr ? (
                    <Link
                      href={`/giai-chay/${pr.raceSlug}`}
                      className="mt-3 block truncate text-xs font-medium text-stone-600 transition hover:text-stone-900"
                      title={pr.raceTitle}
                    >
                      <span className="bg-gradient-to-r from-stone-900 to-stone-900 bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 group-hover:bg-[length:100%_1px]">
                        {pr.raceTitle}
                      </span>
                    </Link>
                  ) : (
                    <div className="mt-3 text-xs italic text-stone-400">
                      Chưa có PR
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* F-050 — Best AG performance — medal/ribbon treatment */}
          {profile.bestAgRank && (
            <div className="relative mt-5 overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 via-yellow-50/50 to-orange-50/40 p-5 shadow-sm ring-1 ring-amber-200/80">
              {/* subtle gold shimmer corner */}
              <div
                aria-hidden="true"
                className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-amber-200/40 to-transparent blur-2xl"
              />
              <div className="relative flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_12px_rgba(217,119,6,0.3)]">
                  <span aria-hidden="true">🏅</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-800">
                    Thành tích AG xuất sắc nhất
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className="text-2xl font-bold leading-none text-stone-900 tabular-nums md:text-3xl"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Hạng {profile.bestAgRank.rank}
                    </span>
                    {profile.bestAgRank.bracket && (
                      <span className="text-sm font-medium text-stone-700">
                        · {profile.bestAgRank.bracket}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/giai-chay/${profile.bestAgRank.raceSlug}`}
                    className="mt-1.5 block truncate text-sm text-stone-600 transition hover:text-amber-800 hover:underline"
                    title={profile.bestAgRank.raceTitle}
                  >
                    {profile.bestAgRank.raceTitle}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Stats — 5-card grid with vertical color accent + oversized
              tabular-nums numbers. Hover lift micro-interaction. */}
        <section className="mb-12">
          <div className="mb-5 flex items-baseline justify-between">
            <h2
              className="text-2xl font-bold text-stone-900"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
            >
              Thống kê
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
              Career Totals
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard
              label="Tổng giải"
              value={profile.totalRaces}
              accent="bg-stone-900"
              valueColor="text-stone-900"
            />
            <StatCard
              label="Về đích"
              value={profile.totalFinished}
              accent="bg-blue-700"
              valueColor="text-blue-700"
            />
            <StatCard
              label="DNF"
              value={profile.totalDNF}
              accent="bg-orange-500"
              valueColor="text-orange-600"
            />
            <StatCard
              label="DNS"
              value={profile.totalDNS ?? 0}
              accent="bg-stone-400"
              valueColor="text-stone-500"
            />
            <StatCard
              label="DSQ"
              value={profile.totalDSQ ?? 0}
              accent="bg-red-500"
              valueColor="text-red-600"
            />
          </div>
        </section>

        {/* ── Race History table — F-050 client component. */}
        <section className="mb-12">
          <div className="mb-5 flex items-baseline justify-between">
            <h2
              className="text-2xl font-bold text-stone-900"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
            >
              Lịch sử race{' '}
              <span className="ml-2 text-base font-medium text-stone-400 tabular-nums">
                {profile.raceHistory.length}
              </span>
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
              Race Log
            </span>
          </div>
          {profile.raceHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-12 text-center">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-stone-200 text-2xl">
                🏁
              </div>
              <p className="text-sm text-stone-600">Chưa có dữ liệu race</p>
            </div>
          ) : (
            <RaceHistoryTable rows={profile.raceHistory} />
          )}
        </section>

        {/* Block 4: Photos gallery (Phase 1B — approved photos signed URL 24h) */}
        <PhotosBlock slug={slug} />


        {/* Footer info — refined with brand mark + mono timestamp */}
        <footer className="mt-12 flex items-center justify-between border-t border-stone-200 pt-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-700" />
            <span>5BIB Athlete Profile</span>
          </div>
          <div className="font-mono text-[11px] text-stone-500 tabular-nums">
            Cập nhật {new Date(profile.computedAt).toLocaleString('vi-VN')}
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * F-050 + UI polish — Stat card with vertical color accent bar (Strava-style),
 * oversized tabular-nums display number, and hover lift micro-interaction.
 */
function StatCard({
  label,
  value,
  accent,
  valueColor,
}: {
  label: string;
  value: number;
  accent: string;
  valueColor: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:ring-stone-300">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${accent}`}
      />
      <div
        className={`text-4xl font-bold leading-none tabular-nums ${valueColor}`}
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
      >
        {value.toLocaleString('vi-VN')}
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </div>
    </div>
  );
}

/**
 * PR distance accent palette — color-coded per distance to give visual rhythm
 * across the 4-card grid (mirrors Strava's distance-level color system).
 */
const PR_DISTANCE_ACCENT: Record<
  '5K' | '10K' | 'HM' | 'FM',
  { bar: string; label: string; time: string; dot: string }
> = {
  '5K': {
    bar: 'bg-sky-500',
    label: 'text-sky-700',
    time: 'text-sky-700',
    dot: 'bg-sky-100 text-sky-700',
  },
  '10K': {
    bar: 'bg-blue-700',
    label: 'text-blue-700',
    time: 'text-blue-700',
    dot: 'bg-blue-100 text-blue-700',
  },
  HM: {
    bar: 'bg-orange-500',
    label: 'text-orange-700',
    time: 'text-orange-600',
    dot: 'bg-orange-100 text-orange-700',
  },
  FM: {
    bar: 'bg-red-600',
    label: 'text-red-700',
    time: 'text-red-700',
    dot: 'bg-red-100 text-red-700',
  },
};

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
