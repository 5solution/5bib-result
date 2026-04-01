'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  MapPin,
  Calendar,
  Trophy,
  Timer,
  Award,
  Share2,
  ChevronRight,
  Bell,
  Users,
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiRace {
  _id: string;
  title: string;
  slug: string;
  status: 'pre_race' | 'live' | 'ended' | 'draft';
  startDate: string | null;
  endDate: string | null;
  province: string;
  imageUrl: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  courses: { name: string; distance: string }[];
  total_results?: number;
}

interface Race {
  id: string;
  name: string;
  slug: string;
  status: 'live' | 'upcoming' | 'completed';
  startDate: string | null;
  endDate: string | null;
  location: string;
  imageUrl: string | null;
  bannerUrl: string | null;
  distances: string[];
  totalResults: number;
}

interface StatsData {
  totalRaces: number;
  totalResults: number;
  totalAthletes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80';

const HERO_BG =
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1920&q=80';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateVN(dateStr: string | null): string {
  if (!dateStr) return 'Chưa xác định';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Chưa xác định';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Chưa xác định';
  const s = new Date(start);
  if (isNaN(s.getTime())) return 'Chưa xác định';

  if (end) {
    const e = new Date(end);
    if (!isNaN(e.getTime()) && e.getTime() !== s.getTime()) {
      const sameMonth =
        s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
      if (sameMonth) {
        return `${s.getDate()} - ${e.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
      }
      return `${formatDateVN(start)} - ${formatDateVN(end)}`;
    }
  }
  return formatDateVN(start);
}

function getCountdown(dateStr: string | null): { days: number; hours: number; minutes: number; seconds: number } | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return null;
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function getRaceImage(race: Race): string {
  return race.bannerUrl || race.imageUrl || FALLBACK_IMAGE;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [races, setRaces] = useState<Race[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalRaces: 0,
    totalResults: 0,
    totalAthletes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  // Tick every second for countdown timers
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/races');
      if (!res.ok) throw new Error('fetch failed');
      const body = await res.json();
      const apiList: ApiRace[] = body?.data?.list ?? body?.data ?? [];

      // Filter out drafts and map
      const raceList: Race[] = apiList
        .filter((r) => r.status !== 'draft')
        .map((r) => ({
          id: r._id,
          name: r.title,
          slug: r.slug,
          startDate: r.startDate || null,
          endDate: r.endDate || null,
          location: r.province || '',
          imageUrl: r.imageUrl || null,
          bannerUrl: r.bannerUrl || null,
          status:
            r.status === 'live'
              ? 'live'
              : r.status === 'pre_race'
                ? 'upcoming'
                : 'completed',
          distances:
            r.courses?.map((c) => c.distance || c.name).filter(Boolean) || [],
          totalResults: r.total_results || 0,
        }));

      setRaces(raceList);

      const totalResults = raceList.reduce((sum, r) => sum + r.totalResults, 0);
      setStats({
        totalRaces: raceList.length,
        totalResults: totalResults || raceList.length * 500,
        totalAthletes: Math.round((totalResults || raceList.length * 500) * 0.85),
      });
    } catch {
      setRaces([]);
      setStats({ totalRaces: 0, totalResults: 0, totalAthletes: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/calendar?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Split races
  const liveRaces = races.filter((r) => r.status === 'live');
  const upcomingRaces = races
    .filter((r) => r.status === 'upcoming')
    .sort(
      (a, b) =>
        (new Date(a.startDate || 0).getTime() || 0) -
        (new Date(b.startDate || 0).getTime() || 0),
    );
  const completedRaces = races
    .filter((r) => r.status === 'completed')
    .sort(
      (a, b) =>
        (new Date(b.startDate || 0).getTime() || 0) -
        (new Date(a.startDate || 0).getTime() || 0),
    );

  const liveAndUpcoming = [...liveRaces, ...upcomingRaces];

  const features = [
    {
      icon: <Timer className="w-7 h-7" />,
      title: 'Live Tracking',
      description:
        'Theo dõi kết quả trực tiếp theo thời gian thực khi vận động viên về đích.',
    },
    {
      icon: <Trophy className="w-7 h-7" />,
      title: 'Kết quả chi tiết',
      description:
        'Chip time, gun time, pace, split times và xếp hạng chi tiết theo hạng mục.',
    },
    {
      icon: <Award className="w-7 h-7" />,
      title: 'Chứng nhận điện tử',
      description:
        'Tải về chứng nhận hoàn thành kỹ thuật số với đầy đủ thông tin thành tích.',
    },
    {
      icon: <Share2 className="w-7 h-7" />,
      title: 'Chia sẻ thành tích',
      description:
        'Chia sẻ kết quả lên mạng xã hội và tự hào với thành tích của bạn.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* ================================================================= */}
      {/* HERO SECTION                                                      */}
      {/* ================================================================= */}
      <section className="relative pt-14 overflow-x-clip overflow-y-visible">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        {/* Dark overlay with gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-900/95" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 md:pt-24 pb-10">
          <div className="max-w-3xl mx-auto text-center md:text-left md:mx-0">
            {/* Live indicator */}
            {liveRaces.length > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-600/20 border border-red-500/30 rounded-full mb-6">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-red-300 text-sm font-semibold">
                  {liveRaces.length} giải đang diễn ra LIVE
                </span>
              </div>
            )}

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-5 leading-[1.05] uppercase">
              Kết quả<br />
              giải chạy{' '}
              <span className="text-blue-400">trực tiếp</span>
            </h1>

            <p className="text-base md:text-lg text-white/70 mb-8 max-w-xl leading-relaxed">
              Nền tảng kết quả giải chạy #1 Việt Nam. Xem kết quả realtime, theo
              dõi vận động viên, truy cập thống kê chi tiết.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="max-w-xl mb-8">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Tìm giải chạy, vận động viên, hoặc số BIB..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-32 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:bg-white/15 transition-all text-base"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-sm"
                >
                  Tìm kiếm
                </button>
              </div>
            </form>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 md:gap-8">
              {[
                {
                  value: loading ? '--' : stats.totalRaces,
                  label: 'Giải đấu',
                  icon: <Calendar className="w-4 h-4 text-blue-400" />,
                },
                {
                  value: loading
                    ? '--'
                    : stats.totalResults.toLocaleString('vi-VN'),
                  label: 'Kết quả',
                  icon: <Trophy className="w-4 h-4 text-blue-400" />,
                },
                {
                  value: loading
                    ? '--'
                    : stats.totalAthletes.toLocaleString('vi-VN'),
                  label: 'VĐV',
                  icon: <Users className="w-4 h-4 text-blue-400" />,
                },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                    {stat.icon}
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-black text-white leading-none">
                      {stat.value}
                    </div>
                    <div className="text-xs text-white/50 font-medium mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* LIVE & UPCOMING EVENTS — horizontal scroll overlapping hero       */}
        {/* ================================================================= */}
        <div className="relative z-10 pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl md:text-2xl font-bold text-white">
                {liveRaces.length > 0 ? 'Live & Upcoming Events' : 'Upcoming Events'}
              </h2>
              <Link
                href="/calendar"
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white border border-white/30 rounded-full hover:bg-white/10 transition-all"
              >
                Xem tất cả <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <ScrollArea className="w-full whitespace-nowrap">
            <div
              className="flex w-max gap-3 pb-4"
              style={{
                paddingLeft: 'max(1rem, calc((100vw - 1280px) / 2))',
                paddingRight: '1rem',
              }}
            >
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="shrink-0 w-[280px] md:w-[300px] h-[400px] md:h-[440px] bg-white/10 animate-pulse rounded-lg"
                    />
                  ))
                : liveAndUpcoming.length > 0
                  ? liveAndUpcoming.map((race) => (
                      <EventCard key={race.id} race={race} />
                    ))
                  : (
                    <div className="flex items-center justify-center w-full min-w-[300px] h-[400px] text-white/50 text-sm">
                      Chưa có sự kiện sắp tới
                    </div>
                  )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </section>

      {/* Spacer */}
      <div className="py-8 md:py-12 bg-[var(--5bib-bg)]" />

      {/* ================================================================= */}
      {/* FEATURES SECTION                                                   */}
      {/* ================================================================= */}
      <section className="py-16 md:py-20 bg-[var(--5bib-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-black text-[var(--5bib-text)] mb-3">
              Tính năng nổi bật
            </h2>
            <p className="text-[var(--5bib-text-muted)] max-w-lg mx-auto">
              Trải nghiệm theo dõi kết quả giải chạy toàn diện nhất
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="p-6 bg-white border border-[var(--5bib-border)] rounded-xl card-hover group shadow-sm"
              >
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-[var(--5bib-accent)] mb-4 group-hover:bg-blue-100 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-[var(--5bib-text)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--5bib-text-muted)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* RACE ALERT BANNER                                                  */}
      {/* ================================================================= */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1920&q=60)',
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Bell className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-white">
                  Race Alert
                </h3>
                <p className="text-slate-300 text-sm md:text-base mt-1 max-w-lg">
                  Nhận thông báo cập nhật từ 5BIB: lịch giải đấu, điểm nhấn sự
                  kiện, tóm tắt giải chạy, kết quả và nhiều hơn nữa!
                </p>
              </div>
            </div>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white border border-white/30 rounded-full hover:bg-white/10 transition-all shrink-0"
            >
              Đăng ký nhận thông báo <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* PAST EVENTS                                                        */}
      {/* ================================================================= */}
      <section className="py-16 md:py-20 bg-[var(--5bib-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-[var(--5bib-text)]">
                Xem lại các giải đã diễn ra
              </h2>
              <p className="text-[var(--5bib-text-muted)] mt-1 max-w-xl">
                Xem lại thành tích của các vận động viên, khám phá dữ liệu cự ly
                và theo dõi sự phát triển qua từng mùa giải.
              </p>
            </div>
            <Link
              href="/calendar?status=completed"
              className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[var(--5bib-text)] border border-[var(--5bib-border)] rounded-full hover:bg-slate-50 transition-all"
            >
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <ScrollArea className="w-full whitespace-nowrap">
          <div
            className="flex w-max gap-3 pb-4"
            style={{
              paddingLeft: 'max(1rem, calc((100vw - 1280px) / 2))',
              paddingRight: '1rem',
            }}
          >
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="shrink-0 w-[280px] md:w-[300px] h-[380px] md:h-[420px] bg-slate-200 animate-pulse rounded-lg"
                  />
                ))
              : completedRaces.length > 0
                ? completedRaces.map((race) => (
                    <PastEventCard key={race.id} race={race} />
                  ))
                : (
                  <div className="flex items-center justify-center w-full min-w-[300px] h-[380px] text-[var(--5bib-text-muted)] text-sm">
                    Chưa có giải đã kết thúc
                  </div>
                )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="mt-6 text-center md:hidden">
          <Link
            href="/calendar?status=completed"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[var(--5bib-accent)] border border-[var(--5bib-accent)]/30 rounded-full hover:bg-blue-50 transition-all"
          >
            Xem tất cả giải đã kết thúc <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Card — Live & Upcoming (with countdown)
// ---------------------------------------------------------------------------

function EventCard({ race }: { race: Race }) {
  const isLive = race.status === 'live';
  const countdown = getCountdown(race.startDate);
  const image = getRaceImage(race);

  return (
    <Link
      href={`/races/${race.slug}`}
      className="shrink-0 w-[280px] md:w-[300px] group"
    >
      <div className="relative h-[400px] md:h-[440px] overflow-hidden rounded-lg">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3 z-20">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              Live
            </span>
          ) : (
            <span className="px-3 py-1 bg-blue-600/80 backdrop-blur-sm rounded text-xs font-bold text-white uppercase tracking-wide">
              Sắp diễn ra
            </span>
          )}
        </div>

        {/* Card content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 whitespace-normal">
          <h3 className="text-white font-bold text-sm leading-tight mb-1.5 line-clamp-2 group-hover:underline">
            {race.name}
          </h3>

          <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{race.location || 'Việt Nam'}</span>
          </div>

          <p className="text-white/90 text-xs font-medium">
            {formatDateRange(race.startDate, race.endDate)}
          </p>

          {/* Countdown timer */}
          {!isLive && countdown && (
            <div className="flex gap-1.5 mt-3">
              {[
                { value: countdown.days, unit: 'Ngày' },
                { value: countdown.hours, unit: 'Giờ' },
                { value: countdown.minutes, unit: 'Phút' },
                { value: countdown.seconds, unit: 'Giây' },
              ].map((item, ci) => (
                <div
                  key={ci}
                  className="px-2 py-1.5 bg-white/15 backdrop-blur-sm rounded text-center min-w-[40px]"
                >
                  <div className="text-white text-sm font-bold leading-none font-mono">
                    {pad(item.value)}
                  </div>
                  <div className="text-white/50 text-[9px] mt-0.5">
                    {item.unit}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Distances */}
          {race.distances.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {race.distances.map((d) => (
                <span
                  key={d}
                  className="px-2 py-0.5 bg-blue-500/60 backdrop-blur-sm rounded text-[10px] font-bold text-white"
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 mt-3 text-[11px] text-white/60">
            <Timer className="w-3 h-3" />
            {isLive ? 'Đang diễn ra' : 'Live Tracking'}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Past Event Card
// ---------------------------------------------------------------------------

function PastEventCard({ race }: { race: Race }) {
  const image = getRaceImage(race);

  return (
    <Link
      href={`/races/${race.slug}`}
      className="shrink-0 w-[280px] md:w-[300px] group"
    >
      <div className="relative h-[380px] md:h-[420px] overflow-hidden rounded-lg">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute top-3 left-3 z-20">
          <span className="px-3 py-1 bg-slate-700/80 backdrop-blur-sm rounded text-xs font-bold text-white uppercase tracking-wide">
            Đã kết thúc
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 whitespace-normal">
          <h3 className="text-white font-bold text-sm leading-tight mb-1.5 line-clamp-2 group-hover:underline">
            {race.name}
          </h3>

          <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{race.location || 'Việt Nam'}</span>
          </div>

          <p className="text-white/90 text-xs font-medium">
            {formatDateVN(race.startDate)}
          </p>

          {race.totalResults > 0 && (
            <div className="mt-2 px-2 py-1 bg-white/15 backdrop-blur-sm rounded text-[10px] font-bold text-white inline-block">
              {race.totalResults.toLocaleString('vi-VN')} kết quả
            </div>
          )}

          <div className="flex items-center gap-1 mt-2.5 text-[11px] text-white/60">
            <Trophy className="w-3 h-3" />
            Xem kết quả
          </div>
        </div>
      </div>
    </Link>
  );
}
