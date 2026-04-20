'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search, MapPin, Calendar, ChevronLeft, ChevronRight, ChevronDown,
  Users, X, ChevronsLeft, ChevronsRight, GitCompareArrows,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import LiveTimer from '@/components/LiveTimer';
import { countryToFlag } from '@/lib/country-flags';
import { useRaceBySlug, useFilterOptions, useRaceSponsors, useRaceResults, useCourseStats } from '@/lib/api-hooks';
import CourseStatsViz from '@/components/CourseStatsViz';
import CountryRankingTable from '@/components/CountryRankingTable';

/* ─── Helpers ─── */

function formatCourseTime(value?: string): string {
  if (!value) return '-';
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return `${m[4]}:${m[5]} - ${m[3]}/${m[2]}/${m[1]}`;
  return value;
}

/* ─── Types ─── */

interface Course {
  id: string;
  distance: string;
  name?: string;
  distanceKm?: number;
  elevation?: string;
  cutOffTime?: string;
  starters?: number;
  dnf?: number;
  finishers?: number;
  startTime?: string;
  startLocation?: string;
}

interface RaceInfo {
  id: number;
  name: string;
  slug: string;
  date: string;
  end_date?: string;
  location: string;
  status: 'live' | 'upcoming' | 'completed';
  courses: Course[];
  logoUrl?: string;
  imageUrl?: string;
}

interface RaceResult {
  Bib: number;
  Name: string;
  OverallRank: string;
  GenderRank: string;
  CatRank: string;
  Gender: string;
  Category: string;
  ChipTime: string;
  GunTime: string;
  Pace: string;
  Gap: string;
  Nationality: string;
  Nation: string;
  Certificate: string;
  race_id: number;
  course_id: string;
  distance: string;
  TimingPoint?: string;
  avatarUrl?: string;
}

/* ─── Demo data ─── */

const DEMO_RACE: RaceInfo = {
  id: 2,
  name: 'Dalat Ultra Trail 2026',
  slug: 'dalat-ultra-trail-2026',
  date: '2026-03-28',
  end_date: '2026-03-30',
  location: 'Đà Lạt, Lâm Đồng',
  status: 'completed',
  courses: [
    { id: 'DUT70', distance: '70K', name: 'Ultra Trail 70K', distanceKm: 70, elevation: '3.200 M+', starters: 450, dnf: 85, finishers: 365, startTime: '18:00', startLocation: 'Quảng trường Lâm Viên' },
    { id: 'DUT55', distance: '55K', name: 'Mountain Trail 55K', distanceKm: 55, elevation: '2.400 M+', starters: 520, dnf: 62, finishers: 458, startTime: '04:00', startLocation: 'Hồ Tuyền Lâm' },
    { id: 'DUT42', distance: '42K', name: 'Forest Marathon 42K', distanceKm: 42, elevation: '1.800 M+', starters: 680, dnf: 45, finishers: 635, startTime: '05:00', startLocation: 'Thung lũng Tình Yêu' },
    { id: 'DUT21', distance: '21K', name: 'Pine Hill Half 21K', distanceKm: 21, elevation: '800 M+', starters: 1200, dnf: 30, finishers: 1170, startTime: '05:30', startLocation: 'Hồ Xuân Hương' },
  ],
};

const DEMO_NAMES_M = [
  'Nguyễn Văn An', 'Lê Minh Cường', 'Hoàng Văn Em', 'Đỗ Quang Huy', 'Ngô Đức Mạnh', 'Trần Đình Phú',
  'Phạm Tuấn Kiệt', 'Vũ Hoàng Nam', 'Bùi Thanh Sơn', 'Đinh Công Đức', 'Lý Văn Hải', 'Trịnh Quốc Bảo',
  'Dương Minh Trí', 'Hồ Ngọc Tùng', 'Mai Xuân Thắng', 'Cao Đình Lộc', 'Tạ Quang Vinh', 'Phan Văn Toàn',
];
const DEMO_NAMES_F = [
  'Trần Thị Bình', 'Phạm Thị Dung', 'Vũ Thị Phương', 'Bùi Thị Lan', 'Trịnh Thu Ngân', 'Lý Thị Hoa',
  'Nguyễn Thanh Thảo', 'Lê Thị Mai', 'Hoàng Thị Yến', 'Đỗ Thị Hằng', 'Ngô Thị Linh', 'Phạm Thị Nga',
];

function generateResults(courseId: string, distance: string, count = 80): RaceResult[] {
  return Array.from({ length: count }, (_, i) => {
    const isFemale = i % 3 === 1;
    const names = isFemale ? DEMO_NAMES_F : DEMO_NAMES_M;
    const baseMinutes = distance === '70K' ? 420 : distance === '55K' ? 330 : distance === '42K' ? 210 : 100;
    const timeMinutes = baseMinutes + i * 3 + Math.floor(Math.random() * 8);
    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;
    const secs = Math.floor(Math.random() * 60);
    const chipTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const distKm = parseInt(distance) || 42;
    const paceTotal = timeMinutes / distKm;
    const paceMins = Math.floor(paceTotal);
    const paceSecs = Math.floor((paceTotal - paceMins) * 60);
    const gapMins = i === 0 ? 0 : i * 3 + Math.floor(Math.random() * 8);
    const gapH = Math.floor(gapMins / 60);
    const gapM = gapMins % 60;
    const gapS = Math.floor(Math.random() * 60);

    return {
      Bib: 1001 + i,
      Name: names[i % names.length],
      OverallRank: String(i + 1),
      GenderRank: String(Math.ceil((i + 1) / 2)),
      CatRank: String(Math.ceil((i + 1) / 3)),
      Gender: isFemale ? 'Female' : 'Male',
      Category: isFemale
        ? ['F20-29', 'F30-39', 'F40-49'][i % 3]
        : ['M20-29', 'M30-39', 'M40-49'][i % 3],
      ChipTime: chipTime,
      GunTime: chipTime,
      Pace: `${paceMins}:${String(paceSecs).padStart(2, '0')}/km`,
      Gap: i === 0 ? '-' : `+${gapH > 0 ? `${gapH}:` : ''}${String(gapM).padStart(2, '0')}:${String(gapS).padStart(2, '0')}`,
      Nationality: ['VIE', 'VIE', 'VIE', 'JPN', 'KOR', 'FRA', 'GBR', 'AUS'][i % 8],
      Nation: ['🇻🇳', '🇻🇳', '🇻🇳', '🇯🇵', '🇰🇷', '🇫🇷', '🇬🇧', '🇦🇺'][i % 8],
      Certificate: '',
      race_id: 2,
      course_id: courseId,
      distance,
    };
  });
}

/* ─── Constants ─── */

const ITEMS_PER_PAGE = 20;

/* ─── Page ─── */

export default function CourseRankingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const courseId = params.courseId as string;

  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [nationalityFilter, setNationalityFilter] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const rankingRef = useRef<HTMLDivElement>(null);

  const [selectedBibs, setSelectedBibs] = useState<Set<number>>(new Set());
  const router = useRouter();
  const { t } = useTranslation();

  // ─── Data fetching via API hooks ───
  const { data: raceRaw, isLoading: loadingRace } = useRaceBySlug(slug);
  const race = useMemo<RaceInfo | null>(() => {
    const r = (raceRaw as any)?.data ?? raceRaw;
    if (!r) return null;
    return {
      id: r._id || r.id,
      name: r.title || r.name,
      slug: r.slug,
      date: r.startDate || r.date || '',
      end_date: r.endDate || r.end_date,
      location: r.province || r.location || '',
      status: r.status === 'pre_race' ? 'upcoming' : r.status === 'live' ? 'live' : 'completed',
      courses: (r.courses || []).map((c: any) => ({
        id: c.courseId || c.id,
        distance: c.distance || c.name,
        name: c.name,
        distanceKm: c.distanceKm,
        elevation: c.elevationGain ? `${c.elevationGain} M+` : undefined,
        cutOffTime: c.cutOffTime,
        starters: 0,
        dnf: 0,
        finishers: 0,
      })),
      logoUrl: r.logoUrl,
      imageUrl: r.imageUrl,
    };
  }, [raceRaw]);

  const { data: filtersRaw } = useFilterOptions(courseId);
  const availableGenders = useMemo(() => (filtersRaw as any)?.data?.genders || [], [filtersRaw]);
  const availableCategories = useMemo(() => (filtersRaw as any)?.data?.categories || [], [filtersRaw]);

  const { data: sponsorsRaw } = useRaceSponsors(String(race?.id || ''), { enabled: !!race?.id });
  const sponsors = useMemo(() => {
    const list = (sponsorsRaw as any)?.data ?? sponsorsRaw;
    return Array.isArray(list) ? list : [];
  }, [sponsorsRaw]);

  const isLive = race?.status === 'live';

  const { data: resultsRaw, isLoading: loadingResults } = useRaceResults({
    raceId: race?.id !== undefined ? String(race.id) : undefined,
    course_id: courseId,
    name: searchQuery.trim() || undefined,
    gender: genderFilter || undefined,
    category: categoryFilter || undefined,
    type: (typeFilter as any) || undefined,
    nationality: nationalityFilter || undefined,
    pageNo: currentPage,
    pageSize,
    sortField: 'OverallRank',
    sortDirection: 'ASC',
  }, {
    enabled: !!courseId && !!race?.id,
    refetchInterval: isLive ? 30_000 : false,
  });
  const results: RaceResult[] = useMemo(() => (resultsRaw as any)?.data ?? [], [resultsRaw]);
  const totalItems = useMemo(() => (resultsRaw as any)?.pagination?.total ?? 0, [resultsRaw]);

  // Fetch course stats for finishers count
  const { data: courseStatsRaw } = useCourseStats(courseId, { enabled: !!courseId, refetchInterval: isLive ? 30_000 : false });
  const courseStats = useMemo(() => {
    const s = (courseStatsRaw as any)?.data ?? courseStatsRaw;
    return s || null;
  }, [courseStatsRaw]);

  const rawCourse = race?.courses.find((c) => c.id === courseId) || null;
  const course = useMemo(() => {
    if (!rawCourse) return null;
    // Use Started/Finished/DNF from first result record (provided by external API)
    const firstResult = results[0] as any;
    return {
      ...rawCourse,
      starters: firstResult?.Started ?? 0,
      finishers: firstResult?.Finished ?? 0,
      dnf: firstResult?.DNF ?? 0,
    };
  }, [rawCourse, results]);

  const toggleBib = (bib: number) => {
    setSelectedBibs(prev => {
      const next = new Set(prev);
      if (next.has(bib)) next.delete(bib);
      else if (next.size < 5) next.add(bib);
      return next;
    });
  };

  const goCompare = () => {
    if (selectedBibs.size < 2) return;
    const bibs = Array.from(selectedBibs).join(',');
    router.push(`/races/${slug}/compare/${courseId}?bibs=${bibs}`);
  };

  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedResults = results;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, genderFilter, categoryFilter, typeFilter, nationalityFilter, pageSize]);

  const formatDateRange = (start: string, end?: string) => {
    if (!start) return t('common.unknown');
    const s = new Date(start);
    if (isNaN(s.getTime())) return t('common.unknown');
    if (!end) return s.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
    const e = new Date(end);
    if (isNaN(e.getTime())) return s.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
    return `${s.toLocaleDateString('vi-VN', { day: '2-digit' })} - ${e.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  };

  const scrollToRanking = () => {
    rankingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loadingRace) {
    return (
      <div className="min-h-screen bg-white pt-14">
        {/* Hero skeleton */}
        <div className="relative pt-[104px]">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-700 to-blue-800 animate-pulse" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="h-4 w-32 bg-white/20 rounded mb-4" />
            <div className="h-10 w-2/3 bg-white/20 rounded mb-3" />
            <div className="flex gap-6 mt-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="h-3 w-16 bg-white/15 rounded" />
                  <div className="h-5 w-20 bg-white/20 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Table skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-12 w-full max-w-lg mx-auto bg-slate-100 rounded-xl mb-6 animate-pulse" />
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-slate-100 last:border-0 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-slate-200 rounded" />
                  <div className="h-3 w-24 bg-slate-100 rounded" />
                </div>
                <div className="h-4 w-20 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!race || !course) {
    return (
      <div className="min-h-screen bg-white pt-14 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{t('ranking.courseNotFound')}</h2>
          <Link href={`/races/${slug}`} className="text-blue-600 hover:underline">{t('ranking.backToRace')}</Link>
        </div>
      </div>
    );
  }

  const statusLabel = race.status === 'live' ? t('status.live') : race.status === 'completed' ? t('status.completed') : t('status.upcoming');

  const infoItems = [
    { label: t('race.startLocation'), value: course.startLocation || race.location },
    { label: t('race.startTime'), value: formatCourseTime(course.startTime) },
    { label: t('race.distance'), value: `${course.distanceKm || '-'} KM` },
    ...(course.cutOffTime ? [{ label: 'COT', value: formatCourseTime(course.cutOffTime) }] : []),
    ...(course.elevation ? [{ label: t('race.totalElevation'), value: course.elevation }] : []),
  ];

  return (
    <>
      <SubHeader race={race} course={course} slug={slug} />

      <div className="min-h-screen bg-white">
        {/* Hero — compact */}
        <section className="relative pt-[104px] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${race.imageUrl || 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1920&q=80'})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-blue-700/90 via-blue-600/70 to-blue-800/90" />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">


            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white">
              {course.name || course.distance}
            </h1>
            <p className="text-sm text-blue-200 mt-2 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {race.location}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDateRange(race.date, race.end_date)}
              </span>
            </p>
          </div>
        </section>

        {/* ── PHẦN 1: Thông tin cự ly ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              {infoItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-4 md:px-5 md:py-5 ${idx === 0 ? 'col-span-2 sm:col-span-1' : ''}`}
                >
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    {item.label}
                  </p>
                  <p className="text-sm md:text-base font-bold text-slate-900 leading-snug">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PHẦN 2: Trạng thái cuộc đua — full width gradient ── */}
        <div className={`bg-gradient-to-r ${race.status === 'live' ? 'from-rose-700 via-red-600 to-amber-600' : 'from-blue-600 via-blue-700 to-blue-800'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 flex-1">
              <div className="flex items-center gap-2.5">
                {race.status === 'live' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                )}
                <span className="text-base md:text-lg font-black uppercase tracking-wide text-white">
                  {statusLabel}
                </span>
                {race.status === 'live' && race.date && (
                  <LiveTimer startDate={race.date} />
                )}
              </div>

              <div className="hidden sm:block w-px h-7 bg-white/30" />

              <div className="flex items-center gap-6 sm:gap-8 text-sm md:text-base">
                {race.status === 'upcoming' ? (
                  <span className="text-blue-200 italic">{t('status.upcoming')}</span>
                ) : (
                  <>
                    <span className="text-blue-100">
                      {t('ranking.starters')}{' '}
                      <strong className="text-white font-black text-lg md:text-xl ml-1.5">
                        {(course.starters ?? 0).toLocaleString('vi-VN')}
                      </strong>
                    </span>
                    {(course.finishers ?? 0) > 0 && (
                      <span className="text-blue-100">
                        {t('ranking.finishers')}{' '}
                        <strong className="text-emerald-300 font-black text-lg md:text-xl ml-1.5">
                          {course.finishers!.toLocaleString('vi-VN')}
                        </strong>
                      </span>
                    )}
                    {(course.dnf ?? 0) > 0 && (
                      <span className="text-blue-100">
                        DNF{' '}
                        <strong className="text-yellow-300 font-black text-lg md:text-xl ml-1.5">
                          {course.dnf!.toLocaleString('vi-VN')}
                        </strong>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <button
              onClick={scrollToRanking}
              className="flex items-center justify-center gap-2.5 px-7 py-3 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 text-white text-sm md:text-base font-bold rounded-full transition-all cursor-pointer shrink-0"
            >
              {t('ranking.viewRanking')}
              <ChevronDown className="w-4 h-4 animate-bounce" />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">

          {/* ── Course Stats Viz (F-03) + Country Ranking (F-04) ──
              Chỉ hiện khi race đã hoàn thành — số liệu giữa chừng dễ gây
              hiểu lầm, và hero card "Xuất phát / Hoàn thành / DNF" chưa có
              nghĩa khi race đang live / chưa diễn ra. */}
          {courseId && race.status === 'completed' && (
            <div className="mt-8 space-y-4">
              <CourseStatsViz
                courseId={courseId}
                /* Prefer the live-computed counters from the stats endpoint
                 * (getCourseStats has a fallback that derives them from
                 * timingPoint + overallRank when the API-reported counters
                 * are null). Only fall back to the course-config values if
                 * the stats endpoint is missing. */
                started={courseStats?.started ?? course?.starters}
                finished={courseStats?.finished ?? course?.finishers}
                dnf={courseStats?.dnf ?? course?.dnf}
                avgTime={courseStats?.avgTime}
                minTime={courseStats?.minTime}
              />
              <CountryRankingTable courseId={courseId} />
            </div>
          )}

          {/* ── PHẦN 3: Bảng xếp hạng ── */}
          <div ref={rankingRef} className="mt-10 scroll-mt-32">
            {/* Search bar — centered */}
            <div className="flex justify-center mb-6">
              <div className="relative w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('ranking.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              {/* Type filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Loại</span>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {[
                    { value: '', label: 'Tất cả' },
                    { value: 'finisher', label: 'Hoàn thành' },
                    { value: 'dnf', label: 'DNF' },
                    { value: 'dns', label: 'DNS' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setTypeFilter(value)}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l first:border-l-0 border-slate-200 ${typeFilter === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {availableGenders.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('ranking.genderFilter')}</span>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setGenderFilter('')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${!genderFilter ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {t('common.all')}
                    </button>
                    {availableGenders.map((g: string) => (
                      <button
                        key={g}
                        onClick={() => setGenderFilter(g === genderFilter ? '' : g)}
                        className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 ${genderFilter === g ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {g === 'Male' ? t('common.male') : g === 'Female' ? t('common.female') : g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableCategories.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('ranking.ageGroup')}</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
                  >
                    <option value="">{t('common.all')}</option>
                    {availableCategories.map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nationality filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quốc tịch</span>
                <input
                  type="text"
                  placeholder="VN, JP..."
                  value={nationalityFilter}
                  onChange={(e) => setNationalityFilter(e.target.value)}
                  maxLength={5}
                  className="w-20 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 uppercase"
                />
              </div>

              {/* PageSize selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}/trang</option>
                  ))}
                </select>
              </div>

              {(typeFilter || genderFilter || categoryFilter || nationalityFilter) && (
                <button
                  onClick={() => { setTypeFilter(''); setGenderFilter(''); setCategoryFilter(''); setNationalityFilter(''); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  {t('common.clearFilters')}
                </button>
              )}
            </div>

            {(searchQuery || genderFilter || categoryFilter || typeFilter || nationalityFilter) && (
              <p className="text-center text-sm text-slate-500 mb-4">
                {t('common.resultsFound')} <strong className="text-slate-700">{totalItems}</strong> {t('common.results')}
              </p>
            )}

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {loadingResults ? (
                <div className="divide-y divide-slate-100">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                      <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 bg-slate-200 rounded" />
                        <div className="h-3 w-24 bg-slate-100 rounded" />
                      </div>
                      <div className="h-4 w-20 bg-slate-200 rounded" />
                      <div className="hidden md:block h-4 w-16 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b-2 border-slate-200">
                          <th className="px-2 py-3.5 w-10"></th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-20">
                            {t('ranking.rank')}
                          </th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('ranking.athlete')}</th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-36">{t('ranking.time')}</th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-24">Pace</th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-28">Tốc độ</th>
                          <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-32">Cách 1st</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedResults.map((result) => (
                          <RankingRow key={result.Bib} result={result} slug={slug} selected={selectedBibs.has(result.Bib)} onToggle={() => toggleBib(result.Bib)} genderFilter={genderFilter} categoryFilter={categoryFilter} raceStatus={race.status} />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {paginatedResults.map((result) => (
                      <MobileRankingCard key={result.Bib} result={result} slug={slug} selected={selectedBibs.has(result.Bib)} onToggle={() => toggleBib(result.Bib)} genderFilter={genderFilter} categoryFilter={categoryFilter} raceStatus={race.status} />
                    ))}
                  </div>
                </>
              )}

              {/* Empty */}
              {paginatedResults.length === 0 && (
                <div className="py-16 text-center">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">{t('ranking.noResults')}</p>
                  <p className="text-sm text-slate-400 mt-1">{t('ranking.tryDifferentSearch')}</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6">
                <RankingPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}

            {/* Race Sponsors — large display at bottom */}
            {sponsors.length > 0 && (
              <div className="mt-16 py-10 border-t-2 border-slate-100">
                <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-slate-400 mb-8">
                  {t('ranking.sponsors')}
                </p>
                {/* Diamond sponsors — extra large */}
                {sponsors.filter(s => s.level === 'diamond').length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-10 mb-8">
                    {sponsors.filter(s => s.level === 'diamond').map((s: any) => (
                      <a
                        key={s._id || s.name}
                        href={s.website || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block transition-transform hover:scale-105"
                      >
                        {s.logoUrl ? (
                          <img src={s.logoUrl} alt={s.name} className="h-32 md:h-40 w-auto object-contain" />
                        ) : (
                          <div className="px-8 py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-lg font-bold text-slate-500">{s.name}</div>
                        )}
                      </a>
                    ))}
                  </div>
                )}
                {/* Gold sponsors — large */}
                {sponsors.filter(s => s.level === 'gold').length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-8 mb-6">
                    {sponsors.filter(s => s.level === 'gold').map((s: any) => (
                      <a
                        key={s._id || s.name}
                        href={s.website || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block transition-transform hover:scale-105"
                      >
                        {s.logoUrl ? (
                          <img src={s.logoUrl} alt={s.name} className="h-24 md:h-28 w-auto object-contain" />
                        ) : (
                          <div className="px-6 py-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-sm font-semibold text-slate-400">{s.name}</div>
                        )}
                      </a>
                    ))}
                  </div>
                )}
                {/* Silver sponsors — medium */}
                {sponsors.filter(s => s.level === 'silver').length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-6">
                    {sponsors.filter(s => s.level === 'silver').map((s: any) => (
                      <a
                        key={s._id || s.name}
                        href={s.website || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block transition-transform hover:scale-105"
                      >
                        {s.logoUrl ? (
                          <img src={s.logoUrl} alt={s.name} className="h-16 md:h-20 w-auto object-contain" />
                        ) : (
                          <div className="px-4 py-2 bg-slate-50 border border-dashed border-slate-200 rounded text-xs font-semibold text-slate-400">{s.name}</div>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Floating compare bar */}
      {selectedBibs.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <GitCompareArrows className="w-5 h-5 text-blue-400 shrink-0" />
          <span className="text-sm font-medium">{t('ranking.athleteCount', { count: selectedBibs.size })}</span>
          <button
            onClick={goCompare}
            disabled={selectedBibs.size < 2}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-sm font-bold rounded-lg transition-colors"
          >
            {t('ranking.compare')}
          </button>
          <button
            onClick={() => setSelectedBibs(new Set())}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}

/* ─── Speed helper ─── */
function computeSpeed(result: RaceResult): string | null {
  const distKm = result.distance ? parseFloat(result.distance) : null;
  if (!distKm || !result.ChipTime) return null;
  const parts = result.ChipTime.split(':').map(Number);
  const hours = parts.length === 3
    ? parts[0] + parts[1] / 60 + parts[2] / 3600
    : parts.length === 2
      ? parts[0] / 60 + parts[1] / 3600
      : null;
  if (!hours || hours <= 0) return null;
  return (distKm / hours).toFixed(1);
}

/* ─── RankingRow — desktop table row ─── */

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0; }
  return Math.abs(h);
}
const AVATAR_COLORS = ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6'];
function getAvatarColor(bib: number | string, raceId: number | string): string {
  return AVATAR_COLORS[simpleHash(`${raceId}-${bib}`) % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function RankingRow({ result, slug, selected, onToggle, genderFilter, categoryFilter, raceStatus }: { result: RaceResult; slug: string; selected: boolean; onToggle: () => void; genderFilter: string; categoryFilter: string; raceStatus: string }) {
  const { t } = useTranslation();
  const isUpcoming = raceStatus === 'upcoming';
  const rankStr = (result.OverallRank || '').trim();
  const rankNum = parseInt(rankStr);
  const rank = !rankStr ? '' : isNaN(rankNum) ? rankStr : rankNum;

  const isTop3 = typeof rank === 'number' && rank >= 1 && rank <= 3;

  const getMedalColor = (r: number | string) => {
    if (r === 1) return 'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-900 shadow-md shadow-amber-200/50';
    if (r === 2) return 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700 shadow-md shadow-gray-200/50';
    if (r === 3) return 'bg-gradient-to-br from-amber-400 to-orange-600 text-orange-900 shadow-md shadow-orange-200/50';
    if (typeof r === 'string' && ['DNF', 'DNS', 'DSQ', 'OOC'].includes(r)) return 'bg-red-100 text-red-600';
    if (r === '') return 'bg-slate-50 text-slate-300';
    return 'bg-slate-100 text-slate-600';
  };

  const getRowBg = () => {
    if (selected) return 'bg-blue-50/40';
    if (rank === 1) return 'bg-amber-50/60';
    if (rank === 2) return 'bg-gray-50/60';
    if (rank === 3) return 'bg-orange-50/40';
    return '';
  };

  const getRowBorder = () => {
    if (rank === 1) return 'shadow-[inset_4px_0_0_0_#f59e0b]';
    if (rank === 2) return 'shadow-[inset_4px_0_0_0_#9ca3af]';
    if (rank === 3) return 'shadow-[inset_4px_0_0_0_#ea580c]';
    return '';
  };

  const getMedalEmoji = (r: number) => {
    if (r === 1) return '🥇';
    if (r === 2) return '🥈';
    if (r === 3) return '🥉';
    return '';
  };

  const formatName = (name: string) =>
    name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <tr className={`group transition-all duration-200 hover:bg-blue-50/60 hover:shadow-[inset_4px_0_0_0_#2563eb] cursor-pointer ${getRowBg()} ${!selected ? getRowBorder() : ''}`}>
      <td className="px-2 py-3.5">
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 hover:border-blue-400'}`}>
          {selected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
        </button>
      </td>
      <td className="px-4 py-3.5">
        {isUpcoming ? (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs bg-slate-50 text-slate-300">-</div>
        ) : isTop3 ? (
          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg ${getMedalColor(rank)}`}>
            {getMedalEmoji(rank as number)}
          </div>
        ) : (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black ${typeof rank === 'string' ? 'text-[10px]' : 'text-sm'} ${getMedalColor(rank)}`}>
            {rank || '-'}
          </div>
        )}
      </td>

      <td className="px-4 py-3.5">
        <Link href={`/races/${slug}/${result.Bib}`} className="block">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm overflow-hidden"
              style={{ background: result.avatarUrl ? 'transparent' : getAvatarColor(result.Bib, result.race_id) }}
            >
              {result.avatarUrl
                ? <img src={result.avatarUrl} alt={result.Name} className="w-full h-full object-cover" />
                : getInitials(result.Name)}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-bold group-hover:text-blue-700 truncate transition-colors ${isTop3 ? 'text-slate-950 font-black' : 'text-slate-900'}`}>
                {formatName(result.Name)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-black text-blue-600">BIB: {result.Bib}</span>
                <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${result.Gender === 'Male' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                  {result.Gender === 'Male' ? '♂' : '♀'}
                </span>
                <span className="text-xs text-slate-400">{countryToFlag(result.Nationality) || countryToFlag(result.Nation) || result.Nation} {result.Category}</span>
              </div>
              {/* Multi-rank sub-row (PRD) */}
              {!isUpcoming && result.OverallRank && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-400">Tổng: <strong className="text-slate-600">{result.OverallRank || '—'}</strong></span>
                  <span className="text-slate-200">·</span>
                  <span className="text-[10px] text-slate-400">{result.Gender === 'Female' ? 'Nữ' : 'Nam'}: <strong className="text-slate-600">{result.GenderRank || '—'}</strong></span>
                  <span className="text-slate-200">·</span>
                  <span className="text-[10px] text-slate-400">Nhóm: <strong className="text-slate-600">{result.CatRank || '—'}</strong></span>
                </div>
              )}
            </div>
          </div>
        </Link>
      </td>

      <td className="px-4 py-3.5">
        {isUpcoming ? (
          <p className="text-xs text-slate-400 italic">{t('status.notStarted')}</p>
        ) : (
          <>
            {result.TimingPoint && result.TimingPoint !== 'Finish' && (
              <p className="text-[10px] font-semibold text-amber-600 mb-0.5">{result.TimingPoint}</p>
            )}
            <p className="text-sm font-bold text-slate-900 font-mono tracking-tight">{result.ChipTime}</p>
          </>
        )}
      </td>

      <td className="px-4 py-3.5">
        {isUpcoming ? (
          <p className="text-xs text-slate-400 italic">-</p>
        ) : (
          <p className="text-sm text-slate-600 font-mono">{result.Pace}</p>
        )}
      </td>

      {/* Speed column (PRD) */}
      <td className="px-4 py-3.5">
        {isUpcoming ? (
          <p className="text-xs text-slate-400 italic">-</p>
        ) : (
          <p className="text-sm text-slate-600 font-mono">
            {computeSpeed(result) ? `${computeSpeed(result)} km/h` : '—'}
          </p>
        )}
      </td>

      {/* Gap column (BR-06) */}
      <td className="px-4 py-3.5">
        {isUpcoming ? (
          <p className="text-xs text-slate-400 italic">-</p>
        ) : (
          <p className={`text-sm font-mono ${!result.Gap || result.Gap === '-' || result.Gap === '--' ? 'text-slate-300' : 'text-slate-500'}`}>
            {result.Gap && result.Gap !== '-' && result.Gap !== '--' ? `+${result.Gap.replace(/^\+/, '')}` : '00:00:00'}
          </p>
        )}
      </td>
    </tr>
  );
}

/* ─── MobileRankingCard ─── */

function MobileRankingCard({ result, slug, selected, onToggle, genderFilter, categoryFilter, raceStatus }: { result: RaceResult; slug: string; selected: boolean; onToggle: () => void; genderFilter: string; categoryFilter: string; raceStatus: string }) {
  const { t } = useTranslation();
  const isUpcoming = raceStatus === 'upcoming';
  const rawRank = categoryFilter ? result.CatRank : genderFilter ? result.GenderRank : result.OverallRank;
  const rankStr = (rawRank || '').trim();
  const rankNum = parseInt(rankStr);
  const rank = !rankStr ? '' : isNaN(rankNum) ? rankStr : rankNum;
  const isTop3 = typeof rank === 'number' && rank >= 1 && rank <= 3;

  const getMedalColor = (r: number | string) => {
    if (r === 1) return 'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-900 shadow-md shadow-amber-200/50';
    if (r === 2) return 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-700 shadow-md shadow-gray-200/50';
    if (r === 3) return 'bg-gradient-to-br from-amber-400 to-orange-600 text-orange-900 shadow-md shadow-orange-200/50';
    if (typeof r === 'string' && ['DNF', 'DNS', 'DSQ', 'OOC'].includes(r)) return 'bg-red-100 text-red-600';
    if (r === '') return 'bg-slate-50 text-slate-300';
    return 'bg-slate-100 text-slate-600';
  };

  const getMedalEmoji = (r: number) => {
    if (r === 1) return '🥇';
    if (r === 2) return '🥈';
    if (r === 3) return '🥉';
    return '';
  };

  const getMobileBg = () => {
    if (selected) return 'bg-blue-50/40';
    if (rank === 1) return 'bg-amber-50/60 border-l-4 border-l-amber-400';
    if (rank === 2) return 'bg-gray-50/60 border-l-4 border-l-gray-400';
    if (rank === 3) return 'bg-orange-50/40 border-l-4 border-l-orange-400';
    return '';
  };

  const formatName = (name: string) =>
    name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <div className={`px-4 py-4 flex items-center gap-3 transition-colors ${getMobileBg()}`}>
      <button onClick={onToggle} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
        {selected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      </button>
      <Link href={`/races/${slug}/${result.Bib}`} className="flex items-center gap-3 flex-1 min-w-0">
        {isUpcoming ? (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs bg-slate-50 text-slate-300 shrink-0">-</div>
        ) : isTop3 ? (
          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg shrink-0 ${getMedalColor(rank)}`}>
            {getMedalEmoji(rank as number)}
          </div>
        ) : (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black shrink-0 ${typeof rank === 'string' ? 'text-[10px]' : 'text-sm'} ${getMedalColor(rank)}`}>
            {rank || '-'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold truncate ${isTop3 ? 'text-slate-950 font-black' : 'text-slate-900'}`}>{formatName(result.Name)}</p>
            <span className="text-xs font-mono font-black text-blue-600">BIB: {result.Bib}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">{result.Nation} {result.Category}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          {isUpcoming ? (
            <p className="text-xs text-slate-400 italic">{t('status.notStarted')}</p>
          ) : (
            <>
              {result.TimingPoint && result.TimingPoint !== 'Finish' && (
                <p className="text-[10px] font-semibold text-amber-600 mb-0.5">{result.TimingPoint}</p>
              )}
              <p className="text-sm font-bold text-slate-900 font-mono">{result.ChipTime}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{result.Pace}</p>
            </>
          )}
        </div>
      </Link>
    </div>
  );
}

/* ─── RankingPagination ─── */

function RankingPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  const getPages = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1.5">
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label={t('ranking.firstPage')}
      >
        <ChevronsLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label={t('ranking.prevPage')}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {getPages().map((page, i) => (
        <button
          key={i}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-semibold transition-all ${page === currentPage
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
            : page === '...'
              ? 'cursor-default text-slate-300'
              : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label={t('ranking.nextPage')}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label={t('ranking.lastPage')}
      >
        <ChevronsRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── SubHeader — sticky sub-navigation for ranking page ─── */

function SubHeader({ race, course, slug }: { race: RaceInfo; course: Course; slug: string }) {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed top-14 left-0 right-0 z-40 transition-all duration-300 ${scrolled
        ? 'bg-white border-b border-slate-200 shadow-sm'
        : 'bg-transparent border-b border-white/10'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-12 gap-4">
        {/* Back to race */}
        <Link
          href={`/races/${slug}`}
          className={`flex items-center gap-1.5 text-sm font-semibold shrink-0 transition-colors duration-300 ${scrolled ? 'text-slate-600 hover:text-blue-700' : 'text-white/80 hover:text-white'
            }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{race.name}</span>
        </Link>

        <div className="flex-1" />

        <div className="flex-1" />

        {/* Quick links to other courses */}
        <div className="hidden md:flex items-center gap-1">
          {race.courses.map((c) => (
            <Link
              key={c.id}
              href={`/races/${slug}/ranking/${c.id}`}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors duration-300 ${c.id === course.id
                ? scrolled
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white/20 text-white'
                : scrolled
                  ? 'text-slate-500 hover:bg-slate-100 hover:text-blue-700'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
            >
              {c.distance}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
