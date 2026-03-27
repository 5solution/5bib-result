'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, MapPin, Calendar, ChevronRight, X } from 'lucide-react';

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

const DEMO_RACES: Race[] = [
  { id: 1, name: 'VnExpress Marathon Hà Nội 2026', slug: 'vnexpress-marathon-hanoi-2026', date: '2026-04-12', location: 'Hà Nội', status: 'upcoming', distances: ['5K', '10K', '21K', '42K'], total_results: 0 },
  { id: 2, name: 'Dalat Ultra Trail 2026', slug: 'dalat-ultra-trail-2026', date: '2026-03-28', location: 'Đà Lạt, Lâm Đồng', status: 'live', distances: ['21K', '42K', '55K', '70K'], total_results: 1200 },
  { id: 3, name: 'Techcombank HCM Marathon 2026', slug: 'techcombank-hcm-marathon-2026', date: '2026-01-15', location: 'TP. Hồ Chí Minh', status: 'completed', distances: ['5K', '10K', '21K', '42K'], total_results: 15000 },
  { id: 4, name: 'Halong Bay Heritage Marathon', slug: 'halong-bay-heritage-marathon-2025', date: '2025-11-10', location: 'Quảng Ninh', status: 'completed', distances: ['5K', '10K', '21K', '42K'], total_results: 8000 },
  { id: 5, name: 'Hue Marathon 2026', slug: 'hue-marathon-2026', date: '2026-06-01', location: 'Huế', status: 'upcoming', distances: ['5K', '10K', '21K'], total_results: 0 },
  { id: 6, name: 'Vietnam Mountain Marathon 2026', slug: 'vietnam-mountain-marathon-2026', date: '2026-09-20', location: 'Sa Pa, Lào Cai', status: 'upcoming', distances: ['10K', '21K', '42K', '70K', '100K'], total_results: 0 },
  { id: 7, name: 'Da Nang International Marathon', slug: 'da-nang-international-marathon', date: '2025-08-15', location: 'Đà Nẵng', status: 'completed', distances: ['5K', '10K', '21K', '42K'], total_results: 10000 },
  { id: 8, name: 'Quy Nhon Night Run 2026', slug: 'quy-nhon-night-run-2026', date: '2026-05-10', location: 'Quy Nhơn, Bình Định', status: 'upcoming', distances: ['5K', '10K', '21K'], total_results: 0 },
  { id: 9, name: 'Phú Quốc Island Trail 2026', slug: 'phu-quoc-island-trail-2026', date: '2026-10-10', location: 'Phú Quốc, Kiên Giang', status: 'upcoming', distances: ['15K', '25K', '50K'], total_results: 0 },
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
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialStatus = (searchParams.get('status') as StatusFilter) || 'all';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRaces = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/races');
      if (res.ok) {
        const data = await res.json();
        setRaces(Array.isArray(data) ? data : (data.data || []));
      } else {
        setRaces(DEMO_RACES);
      }
    } catch {
      setRaces(DEMO_RACES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

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
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateRange = (start: string, end?: string) => {
    const s = new Date(start);
    if (!end) return formatDate(start);
    const e = new Date(end);
    return `${s.toLocaleDateString('vi-VN', { day: '2-digit' })} - ${e.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  };

  const getCountdown = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return [
      { value: String(days).padStart(2, '0'), unit: 'Ngày' },
      { value: String(hours).padStart(2, '0'), unit: 'Giờ' },
      { value: String(mins).padStart(2, '0'), unit: 'Phút' },
      { value: String(secs).padStart(2, '0'), unit: 'Giây' },
    ];
  };

  const getRaceImage = (race: Race, index: number) => {
    return race.image || RACE_IMAGES[index % RACE_IMAGES.length];
  };

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'live', label: 'Đang diễn ra' },
    { key: 'upcoming', label: 'Sắp tới' },
    { key: 'completed', label: 'Đã kết thúc' },
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
          <p className="text-blue-200 text-sm font-medium tracking-wider uppercase mb-2">Chương trình đầy đủ</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-8">Upcoming Events</h1>

          {/* Search + Filter bar */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tên sự kiện..."
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
            {loading ? 'Đang tải...' : `${filteredRaces.length} kết quả`}
          </p>
        </div>

        {/* Race grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg overflow-hidden animate-pulse">
                <div className="h-[360px] bg-slate-200" />
              </div>
            ))}
          </div>
        ) : filteredRaces.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Không tìm thấy sự kiện</h3>
            <p className="text-slate-500 text-sm">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRaces.map((race, index) => {
              const countdown = race.status === 'upcoming' ? getCountdown(race.date) : null;
              return (
                <Link key={race.id} href={`/races/${race.slug}`}>
                  <div className="relative h-[400px] md:h-[420px] overflow-hidden rounded-lg group cursor-pointer">
                    {/* Background image */}
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${getRaceImage(race, index)})` }}
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                    {/* Status badge */}
                    <div className="absolute top-4 left-4 z-20">
                      {race.status === 'live' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          Live
                        </span>
                      ) : race.status === 'upcoming' ? (
                        <span className="px-3 py-1 bg-blue-600/80 backdrop-blur-sm rounded text-xs font-bold text-white uppercase">
                          Coming Soon
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-slate-600/80 backdrop-blur-sm rounded text-xs font-bold text-white uppercase">
                          Completed
                        </span>
                      )}
                    </div>

                    {/* Results count (top right) */}
                    {race.total_results != null && race.total_results > 0 && (
                      <div className="absolute top-4 right-4 z-20">
                        <span className="px-3 py-1 bg-white/15 backdrop-blur-sm rounded text-xs font-semibold text-white">
                          {race.total_results.toLocaleString('vi-VN')} kết quả
                        </span>
                      </div>
                    )}

                    {/* Content at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 z-20 p-5">
                      <h3 className="text-white font-bold text-base leading-tight mb-1.5 line-clamp-2 group-hover:underline">
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
                        Live Tracking
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
