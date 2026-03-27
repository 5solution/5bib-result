'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, MapPin, Calendar, ChevronLeft, ChevronRight, ChevronDown, Users, X, Trophy, ArrowRight } from 'lucide-react';

interface Course {
  id: string;
  distance: string;
  name?: string;
  distanceKm?: number;
  elevation?: string;
  starters?: number;
  dnf?: number;
  finishers?: number;
  image?: string;
}

interface RaceInfo {
  id: number;
  name: string;
  slug: string;
  date: string;
  end_date?: string;
  location: string;
  status: 'live' | 'upcoming' | 'completed';
  distances: string[];
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

const COURSE_IMAGES = [
  'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80',
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80',
];

const DEMO_RACE: RaceInfo = {
  id: 2,
  name: 'Dalat Ultra Trail 2026',
  slug: 'dalat-ultra-trail-2026',
  date: '2026-03-28',
  end_date: '2026-03-30',
  location: 'Đà Lạt, Lâm Đồng',
  status: 'live',
  distances: ['21K', '42K', '55K', '70K'],
  courses: [
    { id: 'DUT70', distance: '70K', name: 'Ultra Trail 70K', distanceKm: 70, elevation: '3200 M+', starters: 450, dnf: 85, finishers: 365 },
    { id: 'DUT55', distance: '55K', name: 'Mountain Trail 55K', distanceKm: 55, elevation: '2400 M+', starters: 520, dnf: 62, finishers: 458 },
    { id: 'DUT42', distance: '42K', name: 'Forest Marathon 42K', distanceKm: 42, elevation: '1800 M+', starters: 680, dnf: 45, finishers: 635 },
    { id: 'DUT21', distance: '21K', name: 'Pine Hill Half 21K', distanceKm: 21, elevation: '800 M+', starters: 1200, dnf: 30, finishers: 1170 },
  ],
};

const DEMO_NAMES_M = ['Nguyễn Văn An', 'Lê Minh Cường', 'Hoàng Văn Em', 'Đỗ Quang Huy', 'Ngô Đức Mạnh', 'Trần Đình Phú'];
const DEMO_NAMES_F = ['Trần Thị Bình', 'Phạm Thị Dung', 'Vũ Thị Phương', 'Bùi Thị Lan', 'Trịnh Thu Ngân', 'Lý Thị Hoa'];

function generateResults(courseId: string, distance: string): RaceResult[] {
  return Array.from({ length: 30 }, (_, i) => ({
    Bib: 1001 + i,
    Name: i % 3 === 1 ? DEMO_NAMES_F[i % DEMO_NAMES_F.length] : DEMO_NAMES_M[i % DEMO_NAMES_M.length],
    OverallRank: String(i + 1),
    GenderRank: String(Math.ceil((i + 1) / 2)),
    CatRank: String(Math.ceil((i + 1) / 3)),
    Gender: i % 3 === 1 ? 'Female' : 'Male',
    Category: ['M20-29', 'F20-29', 'M30-39', 'F30-39', 'M40-49'][i % 5],
    ChipTime: `${Math.floor(180 + i * 5 + Math.random() * 15)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    GunTime: `${Math.floor(181 + i * 5 + Math.random() * 15)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    Pace: `${Math.floor(5 + i * 0.15)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    Gap: i === 0 ? '-' : `+${Math.floor(i * 5 + Math.random() * 15)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    Nationality: 'VIE',
    Nation: '🇻🇳',
    Certificate: '',
    race_id: 2,
    course_id: courseId,
    distance,
  }));
}

export default function RaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [race, setRace] = useState<RaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseResults, setCourseResults] = useState<Record<string, RaceResult[]>>({});

  const fetchRace = useCallback(async () => {
    try {
      const res = await fetch(`/api/races/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setRace(data);
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

  // Generate demo results for each course
  useEffect(() => {
    if (!race) return;
    const results: Record<string, RaceResult[]> = {};
    for (const course of race.courses) {
      results[course.id] = generateResults(course.id, course.distance);
    }
    setCourseResults(results);
  }, [race]);

  const formatDateRange = (start: string, end?: string) => {
    const s = new Date(start);
    if (!end) return s.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
    const e = new Date(end);
    return `${s.toLocaleDateString('vi-VN', { day: '2-digit' })} - ${e.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-[92px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!race) {
    return (
      <div className="min-h-screen bg-white pt-[92px] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Không tìm thấy giải đấu</h2>
          <Link href="/calendar" className="text-blue-600 hover:underline">Quay lại lịch sự kiện</Link>
        </div>
      </div>
    );
  }

  const topMen = (results: RaceResult[]) => results.filter(r => r.Gender === 'Male').slice(0, 3);
  const topWomen = (results: RaceResult[]) => results.filter(r => r.Gender === 'Female').slice(0, 3);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero header */}
      <section className="relative pt-[92px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${race.imageUrl || 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1920&q=80'})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-700/90 via-blue-600/70 to-blue-800/90" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          {/* Breadcrumb */}
          <Link href="/calendar" className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Lịch sự kiện
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            {/* Left: race info */}
            <div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3">{race.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-blue-100">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {race.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDateRange(race.date, race.end_date)}
                </span>
              </div>

              {/* Status + Live Tracking */}
              <div className="flex items-center gap-3 mt-4">
                {race.status === 'live' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Live
                  </span>
                )}
                <span className="flex items-center gap-1 text-sm text-blue-200">
                  <MapPin className="w-3.5 h-3.5" />
                  Live Tracking
                </span>
              </div>
            </div>

            {/* Right: logo placeholder */}
            {race.logoUrl ? (
              <img src={race.logoUrl} alt={race.name} className="h-20 md:h-24 w-auto object-contain" />
            ) : (
              <div className="hidden md:flex items-center justify-center w-40 h-20 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                <span className="text-white/60 text-sm font-semibold">Logo</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Races count */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-8">
          {race.courses.length} Races
        </h2>

        {/* Course cards — vertical list */}
        <div className="flex flex-col gap-6">
          {race.courses.map((course, ci) => {
            const results = courseResults[course.id] || [];
            const men = topMen(results);
            const women = topWomen(results);
            const courseImage = course.image || COURSE_IMAGES[ci % COURSE_IMAGES.length];
            const accentColors = [
              { border: 'border-b-red-500', text: 'text-red-700', bg: 'hover:shadow-red-500/10' },
              { border: 'border-b-orange-500', text: 'text-orange-700', bg: 'hover:shadow-orange-500/10' },
              { border: 'border-b-blue-500', text: 'text-blue-700', bg: 'hover:shadow-blue-500/10' },
              { border: 'border-b-emerald-500', text: 'text-emerald-700', bg: 'hover:shadow-emerald-500/10' },
              { border: 'border-b-purple-500', text: 'text-purple-700', bg: 'hover:shadow-purple-500/10' },
              { border: 'border-b-pink-500', text: 'text-pink-700', bg: 'hover:shadow-pink-500/10' },
            ];
            const accent = accentColors[ci % accentColors.length];

            return (
              <div
                key={course.id}
                className={`border border-slate-200 ${accent.border} border-b-4 rounded-lg overflow-hidden bg-white shadow-sm transition-all duration-300 hover:shadow-xl ${accent.bg} hover:-translate-y-0.5`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_0.8fr]">
                  {/* Part 1: Image + race status */}
                  <div className="relative h-[250px] lg:h-auto">
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${courseImage})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                    {/* Race finished banner */}
                    <div className="absolute bottom-0 left-0 right-0">
                      <div className={`px-4 py-2.5 text-center text-sm font-bold text-white uppercase ${
                        race.status === 'live' ? 'bg-red-600' : race.status === 'completed' ? 'bg-red-700' : 'bg-blue-600'
                      }`}>
                        {race.status === 'live' ? 'Race In Progress' : race.status === 'completed' ? 'Race Finished' : 'Coming Soon'}
                      </div>
                      {(course.starters || race.status === 'completed') && (
                        <div className="flex items-center justify-center gap-6 px-4 py-2 bg-slate-800 text-white text-xs">
                          <span>STARTERS <strong className="text-base ml-1">{course.starters || '-'}</strong></span>
                          <span>DNF <strong className="text-base ml-1">{course.dnf || '-'}</strong></span>
                          <span>FINISHERS <strong className="text-base ml-1">{course.finishers || '-'}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Part 2: Course info */}
                  <div className="p-5 md:p-6 flex flex-col justify-between">
                    <div>
                      <h3 className={`text-xl md:text-2xl font-black uppercase mb-1 ${accent.text}`}>
                        {course.name || course.distance}
                      </h3>
                      <p className="text-sm text-slate-500">{race.location}</p>
                      <p className="text-sm text-slate-700 font-medium mt-0.5">
                        {formatDateRange(race.date, race.end_date)}
                      </p>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                          <p className="text-[11px] text-slate-400 uppercase tracking-wide">Category</p>
                          <p className="text-lg font-bold text-slate-900">{course.distance}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400 uppercase tracking-wide">Distance</p>
                          <p className="text-lg font-bold text-slate-900">{course.distanceKm || '-'} KM</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400 uppercase tracking-wide">Elevation</p>
                          <p className="text-lg font-bold text-slate-900">{course.elevation || '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-5">
                      <Link
                        href={`/races/${slug}?course=${course.id}`}
                        className="group/cta inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-all"
                      >
                        Ranking and Stats
                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                      </Link>
                    </div>
                  </div>

                  {/* Part 3: Top 3 men & women */}
                  <div className="p-5 md:p-6 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50">
                    {/* Top 3 Women */}
                    <div className="mb-5">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Top 3 Women</p>
                      <div className="space-y-2">
                        {women.length > 0 ? women.map((r, i) => (
                          <div key={r.Bib} className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                              {r.Name.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-slate-700 w-4">{i + 1}</span>
                            <span className="text-sm text-slate-700 flex-1 truncate">{r.Name}</span>
                            <span className="text-xs text-slate-400">{r.Nation}</span>
                          </div>
                        )) : (
                          <p className="text-xs text-slate-400">Chưa có dữ liệu</p>
                        )}
                      </div>
                    </div>

                    {/* Top 3 Men */}
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Top 3 Men</p>
                      <div className="space-y-2">
                        {men.length > 0 ? men.map((r, i) => (
                          <div key={r.Bib} className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                              {r.Name.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-slate-700 w-4">{i + 1}</span>
                            <span className="text-sm text-slate-700 flex-1 truncate">{r.Name}</span>
                            <span className="text-xs text-slate-400">{r.Nation}</span>
                          </div>
                        )) : (
                          <p className="text-xs text-slate-400">Chưa có dữ liệu</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
