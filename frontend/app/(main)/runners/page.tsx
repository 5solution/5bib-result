/**
 * /runners — public discover page for athletes (F-056 Phase 5).
 *
 * Server Component, ISR revalidate=1800s. Reads searchParams (letter, page,
 * province, gender, ageGroup, specialty, minRaces, maxRaces, sort) and renders:
 *   - Hero + 4 stat tiles (athletes-stats)
 *   - A→Z alphabet jumper (byLetter map)
 *   - Filter sidebar (form GET) + listing (athletes paginated)
 *   - First-letter monogram header when ?letter is set
 *   - VĐV của tháng spotlight (athletes-spotlight)
 *   - Featured 90d carousel (athletes-featured-90d)
 *
 * All filter state lives in URL search params — no client useState.
 */

import type { Metadata } from 'next';

import AlphabetJumper from '@/components/runners/AlphabetJumper';
import AthleteCard from '@/components/runners/AthleteCard';
import Featured90dCarousel from '@/components/runners/Featured90dCarousel';
import FilterSidebar from '@/components/runners/FilterSidebar';
import HeroStatsTiles from '@/components/runners/HeroStatsTiles';
import LetterMonogramHeader from '@/components/runners/LetterMonogramHeader';
import Pagination from '@/components/runners/Pagination';
import SortDropdown from '@/components/runners/SortDropdown';
import SpotlightOfMonthCard from '@/components/runners/SpotlightOfMonthCard';
import type {
  AthletesFeatured90d,
  AthletesListResponse,
  AthletesSpotlight,
  AthletesStats,
  RunnersSearchParams,
} from '@/components/runners/types';

export const revalidate = 1800;

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';
const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: 'Vận động viên — Profile & thành tích | 5BIB',
  description:
    'Khám phá hơn 54.000 vận động viên Việt Nam — Personal Records, badge thành tựu, lịch sử race trên 87 giải chạy chính thức.',
  alternates: { canonical: 'https://5bib.com/runners' },
  openGraph: {
    title: 'Vận động viên 5BIB',
    description:
      'Profile + thành tích VĐV trên các giải chạy Việt Nam — A→Z directory + spotlight tháng + top 90 ngày.',
    url: 'https://5bib.com/runners',
    type: 'website',
  },
};

// ───────────────────────── data fetchers ─────────────────────────

async function getStats(): Promise<AthletesStats> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/race-results/athletes-stats`, {
      next: { revalidate: 1800, tags: ['runners:stats'] },
    });
    if (!res.ok)
      return {
        totalAthletes: 0,
        totalRaces: 0,
        totalProvinces: 0,
        totalChipTimes: 0,
      };
    return (await res.json()) as AthletesStats;
  } catch {
    return {
      totalAthletes: 0,
      totalRaces: 0,
      totalProvinces: 0,
      totalChipTimes: 0,
    };
  }
}

async function getAthletes(
  sp: RunnersSearchParams,
): Promise<AthletesListResponse> {
  const q = new URLSearchParams();
  if (sp.letter) q.set('letter', sp.letter);
  if (sp.province) q.set('province', sp.province);
  if (sp.gender) q.set('gender', sp.gender);
  if (sp.ageGroup) q.set('ageGroup', sp.ageGroup);
  if (sp.specialty) q.set('specialty', sp.specialty);
  if (sp.minRaces) q.set('minRaces', sp.minRaces);
  if (sp.maxRaces) q.set('maxRaces', sp.maxRaces);
  q.set('sort', sp.sort ?? 'az');
  q.set('page', sp.page ?? '1');
  q.set('pageSize', String(PAGE_SIZE));

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/race-results/athletes?${q.toString()}`,
      { next: { revalidate: 1800, tags: ['runners:list'] } },
    );
    if (!res.ok)
      return {
        data: [],
        total: 0,
        pageNo: 1,
        pageSize: PAGE_SIZE,
        byLetter: {},
      };
    return (await res.json()) as AthletesListResponse;
  } catch {
    return {
      data: [],
      total: 0,
      pageNo: 1,
      pageSize: PAGE_SIZE,
      byLetter: {},
    };
  }
}

async function getSpotlight(): Promise<AthletesSpotlight> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/race-results/athletes-spotlight`,
      { next: { revalidate: 1800, tags: ['runners:spotlight'] } },
    );
    if (!res.ok)
      return { topOne: null, topFive: [], month: nowMonth() };
    return (await res.json()) as AthletesSpotlight;
  } catch {
    return { topOne: null, topFive: [], month: nowMonth() };
  }
}

async function getFeatured90d(): Promise<AthletesFeatured90d> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/race-results/athletes-featured-90d`,
      { next: { revalidate: 1800, tags: ['runners:featured'] } },
    );
    if (!res.ok) return { items: [], windowDays: 90 };
    return (await res.json()) as AthletesFeatured90d;
  } catch {
    return { items: [], windowDays: 90 };
  }
}

function nowMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

// ───────────────────────── page ─────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Coerce searchParams to typed string|undefined record (Next.js 16 quirk: arrays possible). */
function normalize(raw: Record<string, string | string[] | undefined>): RunnersSearchParams {
  const pick = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  return {
    letter: pick('letter'),
    province: pick('province'),
    gender: pick('gender'),
    ageGroup: pick('ageGroup'),
    specialty: pick('specialty'),
    minRaces: pick('minRaces'),
    maxRaces: pick('maxRaces'),
    sort: pick('sort'),
    page: pick('page'),
  };
}

export default async function RunnersIndexPage(props: PageProps) {
  const sp = normalize(await props.searchParams);
  const currentPage = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const [stats, list, spotlight, featured] = await Promise.all([
    getStats(),
    getAthletes(sp),
    getSpotlight(),
    getFeatured90d(),
  ]);

  const totalPages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const displayedLetterLabel = sp.letter ? `vần '${sp.letter}'` : 'tất cả VĐV';

  return (
    <div className="bg-stone-50 min-h-screen">
      {/* ─── Section A: Hero + Stats ─── */}
      <HeroStatsTiles stats={stats} />

      {/* ─── Section B: Alphabet jumper ─── */}
      <AlphabetJumper
        byLetter={list.byLetter}
        active={sp.letter}
        searchParams={sp}
      />

      {/* ─── Section C: Filter sidebar + listing ─── */}
      <main className="max-w-7xl mx-auto px-6 md:px-8 py-10 md:py-14">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
          <FilterSidebar searchParams={sp} />

          <section className="flex-1 min-w-0">
            {/* Listing header: count + sort */}
            <header className="flex items-center justify-between gap-4 flex-wrap mb-5">
              <div>
                <div className="font-mono font-bold uppercase text-[11px] tracking-[0.18em] text-stone-500 mb-1">
                  Hiển thị · {displayedLetterLabel}
                </div>
                <div className="font-heading font-black uppercase text-stone-900 text-[22px] tracking-tight">
                  {list.total.toLocaleString('vi-VN')} VĐV
                </div>
              </div>
              <SortDropdown />
            </header>

            {/* First-letter monogram header when ?letter set */}
            {sp.letter ? (
              <LetterMonogramHeader letter={sp.letter} athletes={list.data} />
            ) : null}

            {list.data.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
                <p className="font-body italic text-stone-500">
                  Không có VĐV nào khớp với điều kiện lọc. Thử nới rộng bộ lọc
                  hoặc xoá để xem toàn bộ.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {list.data.map((a) => (
                  <AthleteCard key={a.slug} athlete={a} />
                ))}
              </div>
            )}

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              searchParams={sp}
            />
          </section>
        </div>
      </main>

      {/* ─── Section D: Spotlight VĐV của tháng ─── */}
      <SpotlightOfMonthCard spotlight={spotlight} />

      {/* ─── Section E: Featured 90d carousel ─── */}
      <Featured90dCarousel featured={featured} />
    </div>
  );
}
