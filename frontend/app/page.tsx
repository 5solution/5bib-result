'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Calendar, Trophy, Timer, Award, Share2, ChevronRight, Bell } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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
}

interface StatsData {
  totalRaces: number;
  totalResults: number;
  totalAthletes: number;
}

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [races, setRaces] = useState<Race[]>([]);
  const [stats, setStats] = useState<StatsData>({ totalRaces: 0, totalResults: 0, totalAthletes: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/races');
      if (res.ok) {
        const body = await res.json();
        const apiList = body?.data?.list ?? body?.data ?? [];
        const raceList: Race[] = apiList.map((r: any) => ({
          id: r._id || r.id,
          name: r.title || r.name,
          slug: r.slug,
          date: r.startDate || r.date || '',
          end_date: r.endDate || r.end_date,
          location: r.province || r.location || '',
          status: r.status === 'pre_race' ? 'upcoming' : r.status === 'live' ? 'live' : 'completed',
          distances: r.courses?.map((c: any) => c.distance || c.name) || r.distances || [],
          total_results: r.total_results || 0,
        }));
        setRaces(raceList);

        const totalResults = raceList.reduce((sum: number, r: Race) => sum + (r.total_results || 0), 0);
        setStats({
          totalRaces: raceList.length,
          totalResults: totalResults || raceList.length * 500,
          totalAthletes: Math.round((totalResults || raceList.length * 500) * 0.85),
        });
      }
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

  const upcomingRaces = races
    .filter((r) => r.status === 'live' || r.status === 'upcoming')
    .sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      return (new Date(a.date || 0).getTime() || 0) - (new Date(b.date || 0).getTime() || 0);
    })
    .slice(0, 6);

  const mockUpcomingEvents = [
    {
      id: 1, name: 'Dalat Ultra Trail 2026', slug: 'dalat-ultra-trail-2026',
      location: 'Đà Lạt, Lâm Đồng', dateLabel: '28 - 30 Tháng 3, 2026', live: true,
      image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
      distances: ['21K', '42K', '55K', '70K'],
      countdown: null,
    },
    {
      id: 2, name: 'VnExpress Marathon Hà Nội 2026', slug: 'vnexpress-marathon-hanoi-2026',
      location: 'Hà Nội', dateLabel: '12 Tháng 4, 2026', live: false,
      image: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=600&q=80',
      distances: ['5K', '10K', '21K', '42K'],
      countdown: [{ value: '16', unit: 'Ngày' }, { value: '08', unit: 'Giờ' }, { value: '42', unit: 'Phút' }],
    },
    {
      id: 3, name: 'Halong Bay Heritage Marathon', slug: 'halong-bay-heritage-marathon',
      location: 'Quảng Ninh', dateLabel: '26 Tháng 4, 2026', live: false,
      image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&q=80',
      distances: ['5K', '10K', '21K', '42K'],
      countdown: [{ value: '30', unit: 'Ngày' }, { value: '12', unit: 'Giờ' }, { value: '15', unit: 'Phút' }],
    },
    {
      id: 4, name: 'Hue Marathon 2026', slug: 'hue-marathon-2026',
      location: 'Huế', dateLabel: '01 Tháng 6, 2026', live: false,
      image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&q=80',
      distances: ['5K', '10K', '21K'],
      countdown: [{ value: '66', unit: 'Ngày' }, { value: '05', unit: 'Giờ' }, { value: '30', unit: 'Phút' }],
    },
    {
      id: 5, name: 'Vietnam Mountain Marathon', slug: 'vietnam-mountain-marathon-2026',
      location: 'Sa Pa, Lào Cai', dateLabel: '20 Tháng 9, 2026', live: false,
      image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80',
      distances: ['10K', '21K', '42K', '70K', '100K'],
      countdown: null,
    },
    {
      id: 6, name: 'Quy Nhon Beach Marathon', slug: 'quy-nhon-beach-marathon-2026',
      location: 'Quy Nhơn, Bình Định', dateLabel: '15 Tháng 7, 2026', live: false,
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
      distances: ['5K', '10K', '21K', '42K'],
      countdown: null,
    },
    {
      id: 7, name: 'Da Nang International Marathon', slug: 'da-nang-international-marathon-2026',
      location: 'Đà Nẵng', dateLabel: '09 Tháng 8, 2026', live: false,
      image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80',
      distances: ['5K', '10K', '21K', '42K'],
      countdown: null,
    },
    {
      id: 8, name: 'Cần Thơ Heritage Run', slug: 'can-tho-heritage-run-2026',
      location: 'Cần Thơ', dateLabel: '22 Tháng 8, 2026', live: false,
      image: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80',
      distances: ['5K', '10K', '21K'],
      countdown: null,
    },
    {
      id: 9, name: 'Phú Quốc Island Trail', slug: 'phu-quoc-island-trail-2026',
      location: 'Phú Quốc, Kiên Giang', dateLabel: '10 Tháng 10, 2026', live: false,
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80',
      distances: ['15K', '25K', '50K'],
      countdown: null,
    },
  ];

  const mockPastEvents = [
    {
      id: 101, name: 'Techcombank HCM Marathon 2026', slug: 'techcombank-hcm-marathon-2026',
      location: 'TP. Hồ Chí Minh', dateLabel: '15 Tháng 1, 2026',
      image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&q=80',
      totalResults: 15000,
    },
    {
      id: 102, name: 'Halong Bay Heritage Marathon 2025', slug: 'halong-bay-heritage-marathon-2025',
      location: 'Quảng Ninh', dateLabel: '10 Tháng 11, 2025',
      image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&q=80',
      totalResults: 8000,
    },
    {
      id: 103, name: 'VPBank Hanoi Marathon 2025', slug: 'vpbank-hanoi-marathon-2025',
      location: 'Hà Nội', dateLabel: '19 Tháng 10, 2025',
      image: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=600&q=80',
      totalResults: 12000,
    },
    {
      id: 104, name: 'Vietnam Trail Marathon Sa Pa 2025', slug: 'vietnam-trail-marathon-sapa-2025',
      location: 'Sa Pa, Lào Cai', dateLabel: '20 Tháng 9, 2025',
      image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80',
      totalResults: 5500,
    },
    {
      id: 105, name: 'Da Nang Bay Marathon 2025', slug: 'da-nang-bay-marathon-2025',
      location: 'Đà Nẵng', dateLabel: '03 Tháng 8, 2025',
      image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80',
      totalResults: 9200,
    },
    {
      id: 106, name: 'Mekong Delta Marathon 2025', slug: 'mekong-delta-marathon-2025',
      location: 'Hậu Giang', dateLabel: '15 Tháng 6, 2025',
      image: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80',
      totalResults: 4300,
    },
    {
      id: 107, name: 'Nha Trang Sunrise Marathon 2025', slug: 'nha-trang-sunrise-marathon-2025',
      location: 'Nha Trang, Khánh Hòa', dateLabel: '25 Tháng 5, 2025',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80',
      totalResults: 6800,
    },
    {
      id: 108, name: 'Dalat Ultra Trail 2025', slug: 'dalat-ultra-trail-2025',
      location: 'Đà Lạt, Lâm Đồng', dateLabel: '29 Tháng 3, 2025',
      image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
      totalResults: 3200,
    },
  ];

  const features = [
    {
      icon: <Timer className="w-7 h-7" />,
      title: 'Live Tracking',
      description: 'Theo dõi kết quả trực tiếp theo thời gian thực khi vận động viên về đích.',
    },
    {
      icon: <Trophy className="w-7 h-7" />,
      title: 'Kết quả chi tiết',
      description: 'Chip time, gun time, pace, split times và xếp hạng chi tiết theo hạng mục.',
    },
    {
      icon: <Award className="w-7 h-7" />,
      title: 'Chứng nhận điện tử',
      description: 'Tải về chứng nhận hoàn thành kỹ thuật số với đầy đủ thông tin thành tích.',
    },
    {
      icon: <Share2 className="w-7 h-7" />,
      title: 'Chia sẻ thành tích',
      description: 'Chia sẻ kết quả lên mạng xã hội và tự hào với thành tích của bạn.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero + Upcoming Events — same first screen */}
      <section className="relative pt-14 overflow-x-clip overflow-y-visible">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1920&q=80)' }}
        />
        {/* Gradient: blue top → transparent → dark bottom for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-700/90 via-blue-600/50 to-slate-900/80" />

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-16 pb-8">
          <div className="max-w-3xl">
            <p className="text-blue-100 text-sm md:text-base font-medium tracking-wide uppercase mb-3">
              Nền tảng kết quả giải chạy #1 Việt Nam
            </p>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-5 leading-[1.05] uppercase">
              Theo dõi<br />
              kết quả{' '}
              <span className="text-blue-200">trực tiếp</span>
            </h1>

            <p className="text-base md:text-lg text-white/80 mb-6 max-w-xl leading-relaxed">
              Xem kết quả realtime, theo dõi vận động viên yêu thích, truy cập thống kê chi tiết.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="max-w-xl mb-6">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Tìm vận động viên theo tên hoặc số BIB..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-32 py-4 bg-white rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all text-base shadow-2xl"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all text-sm"
                >
                  Tìm kiếm
                </button>
              </div>
            </form>

            {/* Stats row */}
            <div className="flex flex-wrap gap-3 mb-2">
              {[
                { value: stats.totalRaces, label: 'Giải đấu' },
                { value: stats.totalResults.toLocaleString('vi-VN'), label: 'Kết quả' },
                { value: stats.totalAthletes.toLocaleString('vi-VN'), label: 'VĐV' },
              ].map((stat, i) => (
                <div key={i} className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/15">
                  <div className="text-lg md:text-xl font-black text-white leading-none">{loading ? '--' : stat.value}</div>
                  <div className="text-[11px] text-blue-200/80 font-medium mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Events — edge-to-edge horizontal scroll */}
        <div className="relative z-10 pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl md:text-2xl font-bold text-white">Upcoming Events</h2>
              <Link
                href="/calendar"
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white border border-white/30 rounded-full hover:bg-white/10 transition-all"
              >
                See all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max gap-3 pb-4" style={{ paddingLeft: 'max(1rem, calc((100vw - 1280px) / 2))', paddingRight: '1rem' }}>
              {mockUpcomingEvents.map((event) => (
                <Link key={event.id} href={`/races/${event.slug}`} className="shrink-0 w-[280px] md:w-[300px] group">
                  <div className="relative h-[380px] md:h-[420px] overflow-hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${event.image})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    <div className="absolute top-3 left-3 z-20">
                      {event.live ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 rounded text-[11px] font-bold text-white uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          Live
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-blue-600/80 backdrop-blur-sm rounded text-[11px] font-bold text-white uppercase">
                          Coming Soon
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 z-20 p-4 whitespace-normal">
                      <h3 className="text-white font-bold text-sm leading-tight mb-1 line-clamp-2 group-hover:underline">
                        {event.name}
                      </h3>
                      <p className="text-white/70 text-xs">{event.location}</p>
                      <p className="text-white/90 text-xs font-medium mt-1">{event.dateLabel}</p>

                      {event.countdown && (
                        <div className="flex gap-1.5 mt-2">
                          {event.countdown.map((item, ci) => (
                            <div key={ci} className="px-2 py-1 bg-white/15 backdrop-blur-sm rounded text-center min-w-[36px]">
                              <div className="text-white text-xs font-bold leading-none">{item.value}</div>
                              <div className="text-white/60 text-[9px] mt-0.5">{item.unit}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {event.distances && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {event.distances.map((d) => (
                            <span key={d} className="px-2 py-0.5 bg-blue-500/60 backdrop-blur-sm rounded text-[10px] font-bold text-white">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-1 mt-2.5 text-[11px] text-white/70">
                        <MapPin className="w-3 h-3" />
                        Live Tracking
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          </div>
      </section>

      {/* Spacer */}
      <div className="py-8 md:py-12 bg-[var(--5bib-bg)]" />

      {/* Race Alert Banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800" />
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1920&q=60)' }} />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Bell className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-white">Race Alert</h3>
                <p className="text-slate-300 text-sm md:text-base mt-1 max-w-lg">
                  Nhận thông báo cập nhật từ 5BIB: lịch giải đấu, điểm nhấn sự kiện, tóm tắt giải chạy, kết quả và nhiều hơn nữa!
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

      {/* Past Events — horizontal scroll, same style as upcoming */}
      <section className="py-16 md:py-20 bg-[var(--5bib-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-[var(--5bib-text)]">Xem lại các giải đã diễn ra</h2>
              <p className="text-[var(--5bib-text-muted)] mt-1 max-w-xl">
                Xem lại thành tích của các vận động viên yêu thích, khám phá dữ liệu cự ly và theo dõi sự phát triển qua từng mùa giải.
              </p>
            </div>
            <Link
              href="/calendar?status=completed"
              className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[var(--5bib-text)] border border-[var(--5bib-border)] rounded-full hover:bg-slate-50 transition-all"
            >
              Xem tất cả giải đã kết thúc <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex w-max gap-3 pb-4" style={{ paddingLeft: 'max(1rem, calc((100vw - 1280px) / 2))', paddingRight: '1rem' }}>
            {mockPastEvents.map((event) => (
              <Link key={event.id} href={`/races/${event.slug}`} className="shrink-0 w-[280px] md:w-[300px] group">
                <div className="relative h-[380px] md:h-[420px] overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${event.image})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  <div className="absolute top-3 left-3 z-20">
                    <span className="px-2.5 py-1 bg-slate-700/80 backdrop-blur-sm text-[11px] font-bold text-white uppercase">
                      Completed
                    </span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 z-20 p-4 whitespace-normal">
                    <h3 className="text-white font-bold text-sm leading-tight mb-1 line-clamp-2 group-hover:underline">
                      {event.name}
                    </h3>
                    <p className="text-white/70 text-xs">{event.location}</p>
                    <p className="text-white/90 text-xs font-medium mt-1">{event.dateLabel}</p>

                    {event.totalResults > 0 && (
                      <div className="mt-2 px-2 py-1 bg-white/15 backdrop-blur-sm rounded text-[10px] font-bold text-white inline-block">
                        {event.totalResults.toLocaleString('vi-VN')} kết quả
                      </div>
                    )}

                    <div className="flex items-center gap-1 mt-2.5 text-[11px] text-white/70">
                      <Trophy className="w-3 h-3" />
                      Xem kết quả
                    </div>
                  </div>
                </div>
              </Link>
            ))}
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

      {/* Features */}
      <section className="py-16 md:py-24 bg-[var(--5bib-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-black text-[var(--5bib-text)] mb-3">Tính năng nổi bật</h2>
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
                <h3 className="text-lg font-bold text-[var(--5bib-text)] mb-2">{feature.title}</h3>
                <p className="text-sm text-[var(--5bib-text-muted)] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function RaceCard({ race }: { race: Race }) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Chưa xác định';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Chưa xác định';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const statusConfig = {
    live: { label: 'LIVE', bg: 'bg-[var(--5bib-live)]', pulse: true },
    upcoming: { label: 'Sắp diễn ra', bg: 'bg-[var(--5bib-accent-dim)]', pulse: false },
    completed: { label: 'Đã kết thúc', bg: 'bg-[var(--5bib-text-muted)]/30', pulse: false },
  };

  const status = statusConfig[race.status] || statusConfig.upcoming;

  return (
    <Link href={`/races/${race.slug}`}>
      <div className="bg-white border border-[var(--5bib-border)] rounded-xl p-6 card-hover cursor-pointer h-full flex flex-col shadow-sm">
        {/* Status badge */}
        <div className="flex items-center justify-between mb-4">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white ${status.bg}`}>
            {status.pulse && <span className="w-1.5 h-1.5 rounded-full bg-white pulse-live" />}
            {status.label}
          </div>
          {race.total_results != null && race.total_results > 0 && (
            <span className="text-xs text-[var(--5bib-text-muted)]">{race.total_results.toLocaleString('vi-VN')} kết quả</span>
          )}
        </div>

        {/* Race info */}
        <h3 className="text-lg font-bold text-[var(--5bib-text)] mb-3 line-clamp-2">{race.name}</h3>

        <div className="space-y-2 mb-4 flex-1">
          <div className="flex items-center gap-2 text-sm text-[var(--5bib-text-muted)]">
            <Calendar className="w-4 h-4 text-[var(--5bib-accent)]" />
            {formatDate(race.date)}
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--5bib-text-muted)]">
            <MapPin className="w-4 h-4 text-[var(--5bib-accent)]" />
            {race.location}
          </div>
        </div>

        {/* Distance badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {race.distances.map((d) => (
            <span
              key={d}
              className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[var(--5bib-accent)]/10 text-[var(--5bib-accent)] border border-[var(--5bib-accent)]/20"
            >
              {d}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--5bib-accent)]">
          Xem kết quả <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
