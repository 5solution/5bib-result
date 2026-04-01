'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search, MapPin, Calendar, ChevronLeft, ChevronRight, ChevronDown,
  Users, X, ChevronsLeft, ChevronsRight,
} from 'lucide-react';

/* ─── Types ─── */

interface Course {
  id: string;
  distance: string;
  name?: string;
  distanceKm?: number;
  elevation?: string;
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

  const [race, setRace] = useState<RaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rankingRef = useRef<HTMLDivElement>(null);

  const [totalItems, setTotalItems] = useState(0);
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchRace = useCallback(async () => {
    try {
      const res = await fetch(`/api/races/slug/${slug}`);
      if (res.ok) {
        const body = await res.json();
        const r = body?.data ?? body;
        if (r) {
          setRace({
            id: r._id || r.id,
            name: r.title || r.name,
            slug: r.slug,
            date: r.startDate || r.date || '',
            end_date: r.endDate || r.end_date,
            location: r.province || r.location || '',
            status: r.status === 'pre_race' ? 'upcoming' : r.status === 'live' ? 'live' : 'completed',
            distances: r.courses?.map((c: any) => c.distance || c.name) || [],
            courses: (r.courses || []).map((c: any) => ({
              id: c.courseId || c.id,
              distance: c.distance || c.name,
              name: c.name,
              distanceKm: c.distanceKm,
              elevation: c.elevationGain ? `${c.elevationGain} M+` : undefined,
              starters: 0,
              dnf: 0,
              finishers: 0,
            })),
            logoUrl: r.logoUrl,
            imageUrl: r.imageUrl,
          });
        } else {
          setRace(DEMO_RACE);
        }
      } else {
        setRace(DEMO_RACE);
      }
    } catch {
      setRace(DEMO_RACE);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchRace();
  }, [fetchRace]);

  const course = race?.courses.find((c) => c.id === courseId) || null;

  const fetchResults = useCallback(async () => {
    if (!courseId) return;
    setLoadingResults(true);
    try {
      const params = new URLSearchParams({
        course_id: courseId,
        pageNo: String(currentPage),
        pageSize: String(ITEMS_PER_PAGE),
        sortField: 'OverallRank',
        sortDirection: 'ASC',
      });
      if (searchQuery.trim()) params.set('name', searchQuery.trim());

      const res = await fetch(`/api/race-results?${params}`);
      if (res.ok) {
        const body = await res.json();
        setResults(body?.data ?? []);
        setTotalItems(body?.pagination?.total ?? 0);
      }
    } catch {
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  }, [courseId, currentPage, searchQuery]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const paginatedResults = results;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const formatDateRange = (start: string, end?: string) => {
    if (!start) return 'Chưa xác định';
    const s = new Date(start);
    if (isNaN(s.getTime())) return 'Chưa xác định';
    if (!end) return s.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
    const e = new Date(end);
    if (isNaN(e.getTime())) return s.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
    return `${s.toLocaleDateString('vi-VN', { day: '2-digit' })} - ${e.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  };

  const scrollToRanking = () => {
    rankingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-14 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!race || !course) {
    return (
      <div className="min-h-screen bg-white pt-14 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Không tìm thấy cự ly</h2>
          <Link href={`/races/${slug}`} className="text-blue-600 hover:underline">Quay lại giải đấu</Link>
        </div>
      </div>
    );
  }

  const statusLabel = race.status === 'live' ? 'Đang diễn ra' : race.status === 'completed' ? 'Đã kết thúc' : 'Sắp diễn ra';

  const infoItems = [
    { label: 'Địa điểm xuất phát', value: course.startLocation || race.location },
    { label: 'Ngày thi đấu', value: formatDateRange(race.date) },
    { label: 'Giờ xuất phát', value: course.startTime || '05:00' },
    { label: 'Cự ly', value: `${course.distanceKm || '-'} KM` },
    { label: 'Tổng leo cao', value: course.elevation || '-' },
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
            {/* Breadcrumb */}
            <Link
              href={`/races/${slug}`}
              className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white mb-4 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> {race.name}
            </Link>

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
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 flex-1">
              <div className="flex items-center gap-2.5">
                {race.status === 'live' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                )}
                <span className="text-base md:text-lg font-black uppercase tracking-wide text-white">
                  {statusLabel}
                </span>
              </div>

              <div className="hidden sm:block w-px h-7 bg-white/30" />

              <div className="flex items-center gap-6 sm:gap-8 text-sm md:text-base">
                <span className="text-blue-100">
                  Xuất phát{' '}
                  <strong className="text-white font-black text-lg md:text-xl ml-1.5">
                    {course.starters?.toLocaleString('vi-VN') || '-'}
                  </strong>
                </span>
                <span className="text-blue-100">
                  DNF{' '}
                  <strong className="text-yellow-300 font-black text-lg md:text-xl ml-1.5">
                    {course.dnf?.toLocaleString('vi-VN') || '-'}
                  </strong>
                </span>
                <span className="text-blue-100">
                  Hoàn thành{' '}
                  <strong className="text-emerald-300 font-black text-lg md:text-xl ml-1.5">
                    {course.finishers?.toLocaleString('vi-VN') || '-'}
                  </strong>
                </span>
              </div>
            </div>

            <button
              onClick={scrollToRanking}
              className="flex items-center justify-center gap-2.5 px-7 py-3 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 text-white text-sm md:text-base font-bold rounded-full transition-all cursor-pointer shrink-0"
            >
              Xem bảng xếp hạng
              <ChevronDown className="w-4 h-4 animate-bounce" />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">

          {/* ── PHẦN 3: Bảng xếp hạng ── */}
          <div ref={rankingRef} className="mt-10 scroll-mt-32">
            {/* Search bar — centered */}
            <div className="flex justify-center mb-6">
              <div className="relative w-full max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm vận động viên theo tên hoặc số BIB..."
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

            {searchQuery && (
              <p className="text-center text-sm text-slate-500 mb-4">
                Tìm thấy <strong className="text-slate-700">{filteredResults.length}</strong> kết quả
              </p>
            )}

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-20">Hạng</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vận động viên</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-36">Thời gian</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-28">Pace</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-32">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedResults.map((result) => (
                      <RankingRow key={result.Bib} result={result} slug={slug} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-slate-100">
                {paginatedResults.map((result) => (
                  <MobileRankingCard key={result.Bib} result={result} slug={slug} />
                ))}
              </div>

              {/* Empty */}
              {paginatedResults.length === 0 && (
                <div className="py-16 text-center">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Không tìm thấy kết quả</p>
                  <p className="text-sm text-slate-400 mt-1">Thử tìm kiếm với từ khóa khác</p>
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

            {/* Sponsor placeholder */}
            <div className="mt-12 py-8 border-t border-slate-100">
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-5">
                Ban tổ chức & Nhà tài trợ
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6">
                {['SUUNTO', 'HOKA', 'GU Energy', 'GARMIN', 'The North Face', 'Compressport'].map((name) => (
                  <div
                    key={name}
                    className="w-32 h-14 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-300 font-semibold"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── RankingRow — desktop table row ─── */

function RankingRow({ result, slug }: { result: RaceResult; slug: string }) {
  const rankNum = parseInt(result.OverallRank);
  const rank = isNaN(rankNum) ? result.OverallRank : rankNum;
  const rankDisplay = typeof rank === 'number' ? rank : rank;

  const getMedalColor = (r: number | string) => {
    if (r === 1) return 'bg-amber-400 text-amber-900';
    if (r === 2) return 'bg-slate-300 text-slate-700';
    if (r === 3) return 'bg-orange-300 text-orange-800';
    return 'bg-slate-100 text-slate-600';
  };

  const formatName = (name: string) =>
    name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <tr className="group transition-all duration-200 hover:bg-blue-50/60 hover:shadow-[inset_4px_0_0_0_#2563eb] cursor-pointer">
      <td className="px-4 py-3.5">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black ${typeof rank === 'string' ? 'text-[10px]' : 'text-sm'} ${getMedalColor(rank)}`}>
          {rank}
        </div>
      </td>

      <td className="px-4 py-3.5">
        <Link href={`/races/${slug}/${result.Bib}`} className="block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-sm font-bold text-slate-500 group-hover:text-blue-600 transition-colors shrink-0">
              {result.Name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 truncate transition-colors">
                {formatName(result.Name)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-bold text-blue-600">#{result.Bib}</span>
                <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                  result.Gender === 'Male' ? 'bg-blue-500' : 'bg-pink-500'
                }`}>
                  {result.Gender === 'Male' ? '♂' : '♀'}
                </span>
                <span className="text-xs text-slate-400">{result.Nation} {result.Category}</span>
              </div>
            </div>
          </div>
        </Link>
      </td>

      <td className="px-4 py-3.5">
        <p className="text-sm font-bold text-slate-900 font-mono tracking-tight">{result.ChipTime}</p>
      </td>

      <td className="px-4 py-3.5">
        <p className="text-sm text-slate-600 font-mono">{result.Pace}</p>
      </td>

      <td className="px-4 py-3.5">
        <p className={`text-sm font-mono ${result.Gap === '-' ? 'text-slate-300' : 'text-slate-500'}`}>
          {result.Gap}
        </p>
      </td>
    </tr>
  );
}

/* ─── MobileRankingCard ─── */

function MobileRankingCard({ result, slug }: { result: RaceResult; slug: string }) {
  const rankNum = parseInt(result.OverallRank);
  const rank = isNaN(rankNum) ? result.OverallRank : rankNum;

  const getMedalColor = (r: number | string) => {
    if (r === 1) return 'bg-amber-400 text-amber-900';
    if (r === 2) return 'bg-slate-300 text-slate-700';
    if (r === 3) return 'bg-orange-300 text-orange-800';
    return 'bg-slate-100 text-slate-600';
  };

  const formatName = (name: string) =>
    name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <Link href={`/races/${slug}/${result.Bib}`} className="block">
      <div className="px-4 py-4 flex items-center gap-3 active:bg-blue-50 transition-colors">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black shrink-0 ${typeof rank === 'string' ? 'text-[10px]' : 'text-sm'} ${getMedalColor(rank)}`}>
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900 truncate">{formatName(result.Name)}</p>
            <span className="text-xs font-mono font-bold text-blue-600">#{result.Bib}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">{result.Nation} {result.Category}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900 font-mono">{result.ChipTime}</p>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{result.Pace}</p>
        </div>
      </div>
    </Link>
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
        aria-label="Trang đầu"
      >
        <ChevronsLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Trang trước"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {getPages().map((page, i) => (
        <button
          key={i}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-semibold transition-all ${
            page === currentPage
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
        aria-label="Trang sau"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Trang cuối"
      >
        <ChevronsRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── SubHeader — sticky sub-navigation for ranking page ─── */

function SubHeader({ race, course, slug }: { race: RaceInfo; course: Course; slug: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed top-14 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-white border-b border-slate-200 shadow-sm'
          : 'bg-transparent border-b border-white/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-12 gap-4">
        {/* Back to race */}
        <Link
          href={`/races/${slug}`}
          className={`flex items-center gap-1.5 text-sm font-semibold shrink-0 transition-colors duration-300 ${
            scrolled ? 'text-slate-600 hover:text-blue-700' : 'text-white/80 hover:text-white'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{race.name}</span>
        </Link>

        <div className="flex-1" />

        {/* Course name */}
        <span className={`text-sm font-bold transition-colors duration-300 ${
          scrolled ? 'text-slate-900' : 'text-white'
        }`}>
          {course.name || course.distance}
        </span>

        <div className="flex-1" />

        {/* Quick links to other courses */}
        <div className="hidden md:flex items-center gap-1">
          {race.courses.map((c) => (
            <Link
              key={c.id}
              href={`/races/${slug}/ranking/${c.id}`}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors duration-300 ${
                c.id === course.id
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
