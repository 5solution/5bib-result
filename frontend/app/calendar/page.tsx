'use client';

import { useState, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useRaces } from '@/lib/api-hooks';

const PAGE_SIZE = 9;

interface Race {
  id: number;
  name: string;
  slug: string;
  date: string;
  end_date?: string;
  location: string;
  status: 'live' | 'upcoming' | 'completed';
  distances: string[];
  total_results?: number;
  description?: string;
  image?: string;
  imageUrl?: string;
  bannerUrl?: string;
}

const RACE_IMAGES = [
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
  'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=600&q=80',
  'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&q=80',
  'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80',
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80',
  'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
];


type StatusFilter = 'all' | 'live' | 'upcoming' | 'completed';

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white pt-14 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CalendarContent />
    </Suspense>
  );
}

function CalendarContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialStatus = (searchParams.get('status') as StatusFilter) || 'all';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [page, setPage] = useState(1);

  const { data: racesRaw, isLoading: loading } = useRaces();

  const races = useMemo<Race[]>(() => {
    const apiList = (racesRaw as any)?.data?.list ?? (racesRaw as any)?.data ?? (racesRaw as any) ?? [];
    return apiList.map((r: any) => ({
      id: r._id || r.id,
      name: r.title || r.name,
      slug: r.slug,
      date: r.startDate || r.date || '',
      end_date: r.endDate || r.end_date,
      location: r.province || r.location || '',
      status: r.status === 'pre_race' ? 'upcoming' : r.status === 'live' ? 'live' : 'completed',
      distances: r.courses?.map((c: any) => c.distance || c.name) || r.distances || [],
      total_results: r.total_results || 0,
      imageUrl: r.imageUrl || null,
      bannerUrl: r.bannerUrl || null,
    }));
  }, [racesRaw]);

  const filteredRaces = races.filter((race) => {
    const matchesSearch =
      !searchQuery ||
      race.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      race.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || race.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const statusOrder = { live: 0, upcoming: 1, completed: 2 };
    const orderDiff = statusOrder[a.status] - statusOrder[b.status];
    if (orderDiff !== 0) return orderDiff;
    if (a.status === 'completed') return new Date(b.date).getTime() - new Date(a.date).getTime();
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return t('common.unknown');
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return t('common.unknown');
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateRange = (start: string, end?: string) => {
    if (!start) return t('common.unknown');
    const s = new Date(start);
    if (isNaN(s.getTime())) return t('common.unknown');
    if (!end) return formatDate(start);
    const e = new Date(end);
    if (isNaN(e.getTime())) return formatDate(start);
    return `${s.toLocaleDateString('vi-VN', { day: '2-digit' })} - ${e.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  };

  const getCountdown = (dateStr: string) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    if (isNaN(diff)) return null;
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return [
      { value: String(days).padStart(2, '0'), unit: t('countdown.days') },
      { value: String(hours).padStart(2, '0'), unit: t('countdown.hours') },
      { value: String(mins).padStart(2, '0'), unit: t('countdown.minutes') },
      { value: String(secs).padStart(2, '0'), unit: t('countdown.seconds') },
    ];
  };

  // Reset to page 1 when filters change
  const prevSearch = useRef(searchQuery);
  const prevStatus = useRef(statusFilter);
  if (prevSearch.current !== searchQuery || prevStatus.current !== statusFilter) {
    prevSearch.current = searchQuery;
    prevStatus.current = statusFilter;
    if (page !== 1) setPage(1);
  }

  const totalPages = Math.ceil(filteredRaces.length / PAGE_SIZE);
  const pagedRaces = filteredRaces.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getRaceImage = (race: Race, index: number) => {
    return race.imageUrl || race.bannerUrl || race.image || RACE_IMAGES[index % RACE_IMAGES.length];
  };

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('calendar.filterAll') },
    { key: 'live', label: t('calendar.filterLive') },
    { key: 'upcoming', label: t('calendar.filterUpcoming') },
    { key: 'completed', label: t('calendar.filterCompleted') },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero header — UTMB style */}
      <section className="relative pt-14 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1551632811-561732d1e306?w=1920&q=80)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-700/90 via-blue-600/70 to-blue-800/90" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
          <p className="text-blue-200 text-sm font-medium tracking-wider uppercase mb-2">{t('calendar.subtitle')}</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-8">{t('calendar.title')}</h1>

          {/* Search + Filter bar */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t('calendar.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-white rounded-full text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm shadow-lg"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {statusTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    statusFilter === tab.key
                      ? 'bg-white text-blue-700 shadow-lg'
                      : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Results count + Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">
            {loading ? t('common.loading') : t('calendar.resultsCount', { count: filteredRaces.length })}
          </p>
        </div>

        {/* Race grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg overflow-hidden animate-pulse bg-slate-100">
                <div className="h-[400px] md:h-[420px] flex flex-col justify-end p-5 gap-2.5">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="h-5 w-4/5 bg-slate-200 rounded" />
                  <div className="h-3 w-1/2 bg-slate-200 rounded" />
                  <div className="h-3 w-2/3 bg-slate-200 rounded" />
                  <div className="flex gap-1.5 mt-2">
                    {[1,2,3].map(j => <div key={j} className="h-5 w-12 bg-slate-200 rounded" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredRaces.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shadow-inner">
              <Search className="w-9 h-9 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('calendar.noEvents')}</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">{t('calendar.noEventsHint')}</p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="mt-4 px-5 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-full hover:bg-blue-50 transition-colors">
                {t('common.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pagedRaces.map((race, index) => {
              const countdown = race.status === 'upcoming' ? getCountdown(race.date) : null;
              return (
                <Link key={race.id} href={`/races/${race.slug}`}>
                  <div className="relative h-[400px] md:h-[420px] overflow-hidden rounded-lg group cursor-pointer shadow-md hover:shadow-2xl transition-all duration-500">
                    {/* Background image */}
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                      style={{ backgroundImage: `url(${getRaceImage(race, index)})` }}
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent group-hover:from-black/90 transition-all duration-500" />

                    {/* Status badge */}
                    <div className="absolute top-4 left-4 z-20">
                      {race.status === 'live' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          {t('status.live')}
                        </span>
                      ) : race.status === 'upcoming' ? (
                        <span className="px-3 py-1 bg-blue-600/80 backdrop-blur-sm rounded text-xs font-bold text-white uppercase">
                          {t('calendar.comingSoon')}
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-slate-600/80 backdrop-blur-sm rounded text-xs font-bold text-white uppercase">
                          {t('status.completed')}
                        </span>
                      )}
                    </div>

                    {/* Results count (top right) */}
                    {race.total_results != null && race.total_results > 0 && (
                      <div className="absolute top-4 right-4 z-20">
                        <span className="px-3 py-1 bg-white/15 backdrop-blur-sm rounded text-xs font-semibold text-white">
                          {t('calendar.resultsCount', { count: race.total_results })}
                        </span>
                      </div>
                    )}

                    {/* Content at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 z-20 p-5 translate-y-0 group-hover:-translate-y-1 transition-transform duration-500">
                      <h3 className="text-white font-bold text-base leading-tight mb-1.5 line-clamp-2">
                        {race.name}
                      </h3>
                      <p className="text-white/70 text-sm">{race.location}</p>
                      <p className="text-white/90 text-sm font-medium mt-1">
                        {formatDateRange(race.date, race.end_date)}
                      </p>

                      {/* Countdown */}
                      {countdown && (
                        <div className="flex gap-1.5 mt-3">
                          {countdown.map((item, ci) => (
                            <div key={ci} className="px-2.5 py-1.5 bg-white/15 backdrop-blur-sm rounded text-center min-w-[40px]">
                              <div className="text-white text-sm font-bold leading-none">{item.value}</div>
                              <div className="text-white/60 text-[9px] mt-0.5">{item.unit}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Distances */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {race.distances.map((d) => (
                          <span key={d} className="px-2.5 py-0.5 bg-blue-500/60 backdrop-blur-sm rounded text-[11px] font-bold text-white">
                            {d}
                          </span>
                        ))}
                      </div>

                      {/* Live tracking */}
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-white/70">
                        <MapPin className="w-3.5 h-3.5" />
                        {t('status.liveTracking')}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={page === 1}
              className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const isEllipsis = totalPages > 7 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages;
              if (isEllipsis) {
                if (p === page - 3 || p === page + 3) return <span key={p} className="text-slate-300 px-1">…</span>;
                return null;
              }
              return (
                <button
                  key={p}
                  onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`w-9 h-9 rounded-full text-sm font-semibold transition-colors ${
                    p === page
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={page === totalPages}
              className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
