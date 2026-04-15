'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRaces } from '@/lib/api-hooks';
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
  ChevronLeft,
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

function formatDateVN(dateStr: string | null, fallback = 'Chưa xác định'): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateRange(start: string | null, end: string | null, fallback = 'Chưa xác định'): string {
  if (!start) return fallback;
  const s = new Date(start);
  if (isNaN(s.getTime())) return fallback;

  if (end) {
    const e = new Date(end);
    if (!isNaN(e.getTime()) && e.getTime() !== s.getTime()) {
      const sameMonth =
        s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
      if (sameMonth) {
        return `${s.getDate()} - ${e.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
      }
      return `${formatDateVN(start, fallback)} - ${formatDateVN(end, fallback)}`;
    }
  }
  return formatDateVN(start, fallback);
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
  const { t } = useTranslation();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [, setTick] = useState(0);

  // Tick every second for countdown timers
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: racesRaw, isLoading: loading } = useRaces();

  const races = useMemo<Race[]>(() => {
    const apiList: ApiRace[] = (racesRaw as any)?.data?.list ?? (racesRaw as any)?.data ?? (racesRaw as any) ?? [];
    if (!Array.isArray(apiList)) return [];
    return apiList
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
  }, [racesRaw]);

  const stats = useMemo<StatsData>(() => {
    const totalResults = races.reduce((sum, r) => sum + r.totalResults, 0);
    return {
      totalRaces: races.length,
      totalResults: totalResults || races.length * 500,
      totalAthletes: Math.round((totalResults || races.length * 500) * 0.85),
    };
  }, [races]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
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
      title: t('home.featureLiveTitle'),
      description: t('home.featureLiveDesc'),
    },
    {
      icon: <Trophy className="w-7 h-7" />,
      title: t('home.featureDetailTitle'),
      description: t('home.featureDetailDesc'),
    },
    {
      icon: <Award className="w-7 h-7" />,
      title: t('home.featureCertTitle'),
      description: t('home.featureCertDesc'),
    },
    {
      icon: <Share2 className="w-7 h-7" />,
      title: t('home.featureShareTitle'),
      description: t('home.featureShareDesc'),
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
                  {t('home.liveRaces', { count: liveRaces.length })}
                </span>
              </div>
            )}

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-5 leading-[1.08] uppercase">
              {t('home.headline').split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}{' '}
              <span className="text-blue-400">{t('home.headlineLive')}</span>
            </h1>

            <p className="text-base md:text-lg text-white/70 mb-8 max-w-xl leading-relaxed">
              {t('home.tagline')}
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="max-w-xl mb-8">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder={t('home.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-32 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:bg-white/15 transition-all text-base"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-sm"
                >
                  {t('common.search')}
                </button>
              </div>
            </form>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 md:gap-8">
              {[
                {
                  value: loading ? '--' : stats.totalRaces,
                  label: t('home.statsRaces'),
                  icon: <Calendar className="w-4 h-4 text-blue-400" />,
                },
                {
                  value: loading
                    ? '--'
                    : stats.totalResults.toLocaleString('vi-VN'),
                  label: t('home.statsResults'),
                  icon: <Trophy className="w-4 h-4 text-blue-400" />,
                },
                {
                  value: loading
                    ? '--'
                    : stats.totalAthletes.toLocaleString('vi-VN'),
                  label: t('home.statsAthletes'),
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
                {liveAndUpcoming.length === 0 && completedRaces.length > 0
                  ? t('home.recentEvents')
                  : liveRaces.length > 0
                    ? `Live & ${t('home.upcomingEvents')}`
                    : t('home.upcomingEvents')}
              </h2>
              <Link
                href="/calendar"
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white border border-white/30 rounded-full hover:bg-white/10 transition-all"
              >
                {t('common.viewAll')} <ChevronRight className="w-4 h-4" />
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
                    className="shrink-0 w-[280px] md:w-[300px] h-[400px] md:h-[440px] bg-white/10 animate-pulse rounded-lg overflow-hidden"
                  >
                    <div className="h-full flex flex-col justify-end p-4 gap-2">
                      <div className="h-3 w-16 bg-white/10 rounded" />
                      <div className="h-5 w-3/4 bg-white/10 rounded" />
                      <div className="h-3 w-1/2 bg-white/10 rounded" />
                      <div className="h-3 w-2/3 bg-white/10 rounded mt-1" />
                      <div className="flex gap-1.5 mt-2">
                        {[1, 2, 3, 4].map(j => <div key={j} className="h-10 w-10 bg-white/10 rounded" />)}
                      </div>
                    </div>
                  </div>
                ))
                : liveAndUpcoming.length > 0
                  ? liveAndUpcoming.map((race) => (
                    <EventCard key={race.id} race={race} />
                  ))
                  : completedRaces.length > 0
                    ? completedRaces.slice(0, 8).map((race) => (
                      <PastEventCard key={race.id} race={race} />
                    ))
                    : (
                      <div className="flex items-center justify-center w-full min-w-[300px] h-[400px] text-white/50 text-sm">
                        {t('home.noEvents')}
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
                  {t('home.raceAlert')}
                </h3>
                <p className="text-slate-300 text-sm md:text-base mt-1 max-w-lg">
                  {t('home.raceAlertDesc')}
                </p>
              </div>
            </div>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white border border-white/30 rounded-full hover:bg-white/10 transition-all shrink-0"
            >
              {t('home.subscribe')} <ChevronRight className="w-4 h-4" />
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
                {t('home.pastEvents')}
              </h2>
              <p className="text-[var(--5bib-text-muted)] mt-1 max-w-xl">
                {t('home.pastEventsSubtitle')}
              </p>
            </div>
            <Link
              href="/calendar?status=completed"
              className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[var(--5bib-text)] border border-[var(--5bib-border)] rounded-full hover:bg-slate-50 transition-all"
            >
              {t('common.viewAll')} <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <PastEventsSlider races={completedRaces} loading={loading} />
        {/* ================================================================= */}
        {/* FEATURES SECTION                                                   */}
        {/* ================================================================= */}
        <section className="py-16 md:py-20 bg-[var(--5bib-surface)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-2xl md:text-3xl font-black text-[var(--5bib-text)] mb-3">
                {t('home.features')}
              </h2>
              <p className="text-[var(--5bib-text-muted)] max-w-lg mx-auto">
                {t('home.featuresSubtitle')}
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

        <div className="mt-6 text-center md:hidden">
          <Link
            href="/calendar?status=completed"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[var(--5bib-accent)] border border-[var(--5bib-accent)]/30 rounded-full hover:bg-blue-50 transition-all"
          >
            {t('home.viewAllPast')} <ChevronRight className="w-4 h-4" />
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
  const { t } = useTranslation();
  const isLive = race.status === 'live';
  const countdown = getCountdown(race.startDate);
  const image = getRaceImage(race);

  return (
    <Link
      href={`/races/${race.slug}`}
      className="shrink-0 w-[280px] md:w-[300px] group"
    >
      <div className="relative h-[400px] md:h-[440px] overflow-hidden rounded-lg shadow-md hover:shadow-2xl transition-shadow duration-500">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
          style={{ backgroundImage: `url(${image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent group-hover:from-black/90 transition-all duration-500" />

        {/* Status badge */}
        <div className="absolute top-3 left-3 z-20">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase tracking-wide shadow-lg shadow-red-600/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              Live
            </span>
          ) : (
            <span className="px-3 py-1 bg-blue-600/80 backdrop-blur-sm rounded text-xs font-bold text-white uppercase tracking-wide">
              {t('status.upcoming')}
            </span>
          )}
        </div>

        {/* Card content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 whitespace-normal translate-y-0 group-hover:-translate-y-1 transition-transform duration-500">
          <h3 className="text-white font-bold text-sm leading-tight mb-1.5 line-clamp-2">
            {race.name}
          </h3>

          <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{race.location || 'Việt Nam'}</span>
          </div>

          <p className="text-white/90 text-xs font-medium">
            {formatDateRange(race.startDate, race.endDate, t('common.unknown'))}
          </p>

          {/* Countdown timer */}
          {!isLive && countdown && (
            <div className="flex gap-1.5 mt-3">
              {[
                { value: countdown.days, unit: t('countdown.days') },
                { value: countdown.hours, unit: t('countdown.hours') },
                { value: countdown.minutes, unit: t('countdown.minutes') },
                { value: countdown.seconds, unit: t('countdown.seconds') },
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
            {isLive ? t('status.live') : t('status.liveTracking')}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Past Events Slider — scroll strip with prev/next arrow buttons
// ---------------------------------------------------------------------------

function PastEventsSlider({ races, loading }: { races: Race[]; loading: boolean }) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const CARD_WIDTH = 312; // 300px card + 12px gap

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState, races]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -CARD_WIDTH * 3 : CARD_WIDTH * 3, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {/* Prev button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          aria-label="Previous"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-all border border-slate-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-4"
        style={{
          paddingLeft: 'max(1rem, calc((100vw - 1280px) / 2))',
          paddingRight: '1rem',
          scrollSnapType: 'x mandatory',
        }}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-[280px] md:w-[300px] h-[380px] md:h-[420px] bg-slate-100 animate-pulse rounded-lg overflow-hidden"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="h-full flex flex-col justify-end p-4 gap-2">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="h-5 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/2 bg-slate-200 rounded" />
              </div>
            </div>
          ))
          : races.length > 0
            ? races.map((race) => (
              <div key={race.id} style={{ scrollSnapAlign: 'start' }}>
                <PastEventCard race={race} />
              </div>
            ))
            : (
              <div className="flex items-center justify-center w-full min-w-[300px] h-[380px] text-[var(--5bib-text-muted)] text-sm">
                {t('home.noPastEvents')}
              </div>
            )}
      </div>

      {/* Next button */}
      {canScrollRight && races.length > 0 && !loading && (
        <button
          onClick={() => scroll('right')}
          aria-label="Next"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-all border border-slate-100"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Past Event Card
// ---------------------------------------------------------------------------

function PastEventCard({ race }: { race: Race }) {
  const { t } = useTranslation();
  const image = getRaceImage(race);

  return (
    <Link
      href={`/races/${race.slug}`}
      className="shrink-0 w-[280px] md:w-[300px] group"
    >
      <div className="relative h-[380px] md:h-[420px] overflow-hidden rounded-lg shadow-md hover:shadow-2xl transition-shadow duration-500">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
          style={{ backgroundImage: `url(${image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 transition-all duration-500" />

        <div className="absolute top-3 left-3 z-20">
          <span className="px-3 py-1 bg-slate-700/80 backdrop-blur-sm rounded text-xs font-bold text-white uppercase tracking-wide">
            {t('status.completed')}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 whitespace-normal translate-y-0 group-hover:-translate-y-1 transition-transform duration-500">
          <h3 className="text-white font-bold text-sm leading-tight mb-1.5 line-clamp-2">
            {race.name}
          </h3>

          <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{race.location || 'Việt Nam'}</span>
          </div>

          <p className="text-white/90 text-xs font-medium">
            {formatDateVN(race.startDate, t('common.unknown'))}
          </p>

          {race.distances.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {race.distances.map((d) => (
                <span key={d} className="px-2 py-0.5 bg-blue-500/60 backdrop-blur-sm rounded text-[10px] font-bold text-white">
                  {d}
                </span>
              ))}
            </div>
          )}

          {race.totalResults > 0 && (
            <div className="mt-2 px-2 py-1 bg-white/15 backdrop-blur-sm rounded text-[10px] font-bold text-white inline-block">
              {t('home.resultsCount', { count: race.totalResults })}
            </div>
          )}

          <div className="flex items-center gap-1 mt-2.5 text-[11px] text-white/60">
            <Trophy className="w-3 h-3" />
            {t('home.viewResults')}
          </div>
        </div>
      </div>
    </Link>
  );
}
