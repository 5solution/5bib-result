'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Calendar, ChevronLeft, Trophy, ArrowRight, User, Clock, Mountain, Timer, Route, Globe } from 'lucide-react';
import LiveTimer from '@/components/LiveTimer';
import { useRaceBySlug, useSponsors } from '@/lib/api-hooks';
import { raceResultControllerGetRaceResults, raceResultControllerGetCourseStats } from '@/lib/api-generated';

const GpxMap = dynamic(() => import('@/components/GpxMap'), { ssr: false });

interface Course {
  id: string;
  distance: string;
  name?: string;
  distanceKm?: number;
  elevation?: string;
  cutOffTime?: string;
  startTime?: string;
  startLocation?: string;
  starters?: number;
  dnf?: number;
  finishers?: number;
  image?: string;
  gpxUrl?: string;
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
  description?: string;
  organizer?: string;
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
  const { t } = useTranslation();
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const { data: raceRaw, isLoading: loadingRace } = useRaceBySlug(slug);
  const [courseResults, setCourseResults] = useState<Record<string, RaceResult[]>>({});
  const [courseStatsMap, setCourseStatsMap] = useState<Record<string, { starters: number; finishers: number; dnf: number; nationalityCount: number }>>({});

  const race = useMemo<RaceInfo | null>(() => {
    const r = (raceRaw as any)?.data ?? raceRaw;
    if (!r) return loadingRace ? null : DEMO_RACE;
    return {
      id: r._id || r.id,
      name: r.title || r.name,
      slug: r.slug,
      date: r.startDate || r.date || '',
      end_date: r.endDate || r.end_date,
      location: r.province || r.location || '',
      status: r.status === 'pre_race' ? 'upcoming' : r.status === 'live' ? 'live' : 'completed',
      distances: r.courses?.map((c: any) => c.distance || c.name) || [],
      courses: (r.courses || []).map((c: any, i: number) => ({
        id: c.courseId || c.id,
        distance: c.distance || c.name,
        name: c.name,
        distanceKm: c.distanceKm,
        elevation: c.elevationGain ? `${c.elevationGain} M+` : undefined,
        cutOffTime: c.cutOffTime,
        startTime: c.startTime,
        startLocation: c.startLocation,
        starters: 0,
        dnf: 0,
        finishers: 0,
        image: c.imageUrl || COURSE_IMAGES[i % COURSE_IMAGES.length],
        gpxUrl: c.gpxUrl,
      })),
      logoUrl: r.logoUrl,
      imageUrl: r.imageUrl,
      description: r.description,
      organizer: r.organizer,
    };
  }, [raceRaw, loadingRace]);

  const loading = loadingRace;

  useEffect(() => {
    if (!race || race.status === 'upcoming') return; // Don't fetch results for upcoming races
    const raceId = String(race.id);
    const courses = race.courses;

    courses.forEach(async (course) => {
      try {
        const [menRes, womenRes, statsRes] = await Promise.all([
          raceResultControllerGetRaceResults({
            query: {
              raceId,
              course_id: course.id,
              gender: 'Male',
              pageNo: 1,
              pageSize: 3,
              sortField: 'GenderRank',
              sortDirection: 'ASC',
            },
          }),
          raceResultControllerGetRaceResults({
            query: {
              raceId,
              course_id: course.id,
              gender: 'Female',
              pageNo: 1,
              pageSize: 3,
              sortField: 'GenderRank',
              sortDirection: 'ASC',
            },
          }),
          raceResultControllerGetCourseStats({
            path: { courseId: course.id },
          }),
        ]);
        const menList = (menRes.data as any)?.data ?? menRes.data;
        const womenList = (womenRes.data as any)?.data ?? womenRes.data;
        const resultArr = [
          ...(Array.isArray(menList) ? menList : []),
          ...(Array.isArray(womenList) ? womenList : []),
        ];
        const stats = (statsRes.data as any)?.data ?? statsRes.data;
        setCourseResults(prev => ({ ...prev, [course.id]: resultArr }));
        setCourseStatsMap(prev => ({
          ...prev,
          [course.id]: {
            starters: stats?.started ?? stats?.total ?? 0,
            finishers: stats?.finished ?? 0,
            dnf: stats?.dnf ?? 0,
            nationalityCount: stats?.nationalityCount ?? 0,
          },
        }));
      } catch {
        setCourseResults(prev => ({ ...prev, [course.id]: [] }));
      }
    });
  }, [race]);

  const formatDateRange = (start: string, end?: string) => {
    if (!start) return '';
    const s = new Date(start);
    if (isNaN(s.getTime())) return '';
    if (!end) return s.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
    const e = new Date(end);
    if (isNaN(e.getTime())) return s.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });
    return `${s.toLocaleDateString('vi-VN', { day: '2-digit' })} - ${e.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-14">
        {/* Hero skeleton */}
        <div className="relative pt-[104px]">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-700 to-blue-800 animate-pulse" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
            <div className="h-4 w-32 bg-white/20 rounded mb-6" />
            <div className="h-10 w-2/3 bg-white/20 rounded mb-3" />
            <div className="h-4 w-1/3 bg-white/20 rounded" />
          </div>
        </div>
        {/* Course cards skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-8 w-32 bg-slate-200 rounded mb-8 animate-pulse" />
          <div className="flex flex-col gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-slate-200 rounded-lg overflow-hidden animate-pulse">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_0.8fr]">
                  <div className="h-[250px] lg:h-[280px] bg-slate-200" />
                  <div className="p-6 space-y-3">
                    <div className="h-6 w-3/4 bg-slate-200 rounded" />
                    <div className="h-4 w-1/2 bg-slate-100 rounded" />
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      {[1,2,3].map(j => <div key={j} className="h-12 bg-slate-100 rounded" />)}
                    </div>
                    <div className="h-10 w-40 bg-slate-200 rounded-full mt-4" />
                  </div>
                  <div className="p-6 bg-slate-50 space-y-3">
                    <div className="h-3 w-20 bg-slate-200 rounded" />
                    {[1,2,3].map(j => <div key={j} className="h-8 bg-slate-200 rounded" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!race) {
    return (
      <div className="min-h-screen bg-white pt-14 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{t('race.notFound')}</h2>
          <Link href="/calendar" className="text-blue-600 hover:underline">{t('race.backToCalendar')}</Link>
        </div>
      </div>
    );
  }

  const topMen = (results: RaceResult[]) => results.filter(r => r.Gender === 'Male').slice(0, 3);
  const topWomen = (results: RaceResult[]) => results.filter(r => r.Gender === 'Female').slice(0, 3);

  return (
    <>
    <SubHeader race={race} slug={slug} />

    <div className="min-h-screen bg-white">

      {/* Hero header */}
      <section className="relative pt-[104px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${race.imageUrl || 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=1920&q=80'})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-700/90 via-blue-600/70 to-blue-800/90" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-28">
          {/* Breadcrumb */}
          <Link href="/calendar" className="inline-flex items-center gap-1 text-sm text-blue-200 hover:text-white mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" /> {t('nav.calendar')}
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

              {/* Status badge */}
              <div className="flex items-center gap-3 mt-4">
                {race.status === 'live' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-rose-700 via-red-600 to-amber-600 rounded text-xs font-bold text-white uppercase shadow-lg shadow-red-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Live
                  </span>
                )}
                {race.status === 'upcoming' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500 rounded text-xs font-bold text-white uppercase">
                    <Calendar className="w-3.5 h-3.5" />
                    {t('status.upcoming')}
                  </span>
                )}
                {race.status !== 'upcoming' && (
                  <span className="flex items-center gap-1 text-sm text-blue-200">
                    <MapPin className="w-3.5 h-3.5" />
                    {t('status.liveTracking')}
                  </span>
                )}
              </div>
              {/* Live elapsed timer */}
              {race.status === 'live' && race.date && (
                <div className="mt-4">
                  <LiveTimer startDate={race.date} variant="hero" />
                </div>
              )}
            </div>

            {/* Right: logo placeholder */}
            {race.logoUrl && (
              <img src={race.logoUrl} alt={race.name} className="h-20 md:h-24 w-auto object-contain" />
            )}
          </div>
        </div>
      </section>

      {/* Race info section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upcoming race info block */}
        {race.status === 'upcoming' && (race.description || race.organizer) && (
          <RaceDescription description={race.description} organizer={race.organizer} />
        )}

        <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-8">
          {t('race.distances', { count: race.courses.length })}
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
              <Link
                key={course.id}
                href={`/races/${slug}/ranking/${course.id}`}
                className={`group border border-slate-200 ${accent.border} border-b-4 rounded-lg overflow-hidden bg-white shadow-sm transition-all duration-300 hover:shadow-xl ${accent.bg} hover:-translate-y-0.5 cursor-pointer`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_0.8fr]">
                  {/* Part 1: Image + race status */}
                  <div className="relative h-[250px] lg:h-auto overflow-hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                      style={{ backgroundImage: `url(${courseImage})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                    {/* Race status banner */}
                    <div className="absolute bottom-0 left-0 right-0">
                      <div className={`px-4 py-2.5 text-center text-sm font-bold text-white uppercase tracking-wide ${
                        race.status === 'live'
                          ? 'bg-emerald-600'
                          : race.status === 'completed'
                            ? 'bg-red-700'
                            : 'bg-slate-600'
                      }`}>
                        {race.status === 'live' && (
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            ĐANG DIỄN RA
                          </span>
                        )}
                        {race.status === 'completed' && (
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            RACE FINISHED
                          </span>
                        )}
                        {race.status === 'upcoming' && 'SẮP DIỄN RA'}
                      </div>
                      {courseStatsMap[course.id] && (courseStatsMap[course.id]?.starters ?? 0) > 0 && (
                        <div className="flex items-center justify-center gap-6 px-4 py-2 bg-slate-800 text-white text-xs">
                          <span>STARTERS <strong className="text-base ml-1">{courseStatsMap[course.id]?.starters}</strong></span>
                          {(courseStatsMap[course.id]?.finishers ?? 0) > 0 && (
                            <span>FINISHERS <strong className="text-base ml-1">{courseStatsMap[course.id]?.finishers}</strong></span>
                          )}
                          {(courseStatsMap[course.id]?.dnf ?? 0) > 0 && (
                            <span>DNF <strong className="text-base ml-1">{courseStatsMap[course.id]?.dnf}</strong></span>
                          )}
                          {(courseStatsMap[course.id]?.nationalityCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1">🌍 <strong className="text-base ml-0.5">{courseStatsMap[course.id]?.nationalityCount}</strong> {t('common.country')}</span>
                          )}
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
                          <p className="text-[11px] text-slate-400 uppercase tracking-wide">{t('race.startTime')}</p>
                          <p className="text-lg font-bold text-slate-900">{course.startTime || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400 uppercase tracking-wide">COT</p>
                          <p className="text-lg font-bold text-slate-900">{course.cutOffTime || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-400 uppercase tracking-wide">{t('race.elevation')}</p>
                          <p className="text-lg font-bold text-slate-900">{course.elevation || '-'}</p>
                        </div>
                      </div>

                      {/* Completion rate bar — only show when race has results */}
                      {(() => {
                        const s = courseStatsMap[course.id];
                        if (!s || s.starters === 0) return null;
                        const rate = Math.round((s.finishers / s.starters) * 100);
                        const color = rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-400' : 'bg-red-400';
                        return (
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">{t('race.completionRate')}</span>
                              <span className="text-sm font-black text-slate-800">{rate}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${color} rounded-full transition-all duration-700`}
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] text-slate-400">{s.finishers} {t('race.finishers')}</span>
                              <span className="text-[10px] text-slate-400">{s.starters} {t('race.starters')}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* GPX Map */}
                    {course.gpxUrl && (
                      <div className="mt-4 rounded-lg overflow-hidden border border-slate-200">
                        <GpxMap gpxUrl={course.gpxUrl} className="h-[200px]" />
                      </div>
                    )}

                    {/* CTA */}
                    <div className="mt-5">
                      <span
                        className="group/cta inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 border border-slate-300 rounded-full group-hover:bg-slate-50 transition-all"
                      >
                        {race.status === 'upcoming' ? t('race.viewDetails') : t('race.rankingAndStats')}
                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>

                  {/* Part 3: Top 3 (for live/completed) or Course info (for upcoming) */}
                  {(race.status === 'upcoming' || race.status === 'live' || (men.length > 0 || women.length > 0)) && (
                  <div className="p-5 md:p-6 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50">
                    {(race.status === 'upcoming' || race.status === 'live') ? (
                      /* ── Upcoming: show course details ── */
                      <div className="space-y-4">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('race.courseInfo')}</p>
                        {course.startTime && (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <Clock className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase">{t('race.startTime')}</p>
                              <p className="text-sm font-bold text-slate-800">{course.startTime}</p>
                            </div>
                          </div>
                        )}
                        {course.cutOffTime && (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                              <Timer className="w-4 h-4 text-orange-600" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase">{t('race.cutOffTime')}</p>
                              <p className="text-sm font-bold text-slate-800">{course.cutOffTime}</p>
                            </div>
                          </div>
                        )}
                        {course.elevation && (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                              <Mountain className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase">{t('race.elevation')}</p>
                              <p className="text-sm font-bold text-slate-800">{course.elevation}</p>
                            </div>
                          </div>
                        )}
                        {course.startLocation && (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                              <MapPin className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase">{t('race.startLocation')}</p>
                              <p className="text-sm font-bold text-slate-800">{course.startLocation}</p>
                            </div>
                          </div>
                        )}
                        {!course.startTime && !course.cutOffTime && !course.elevation && !course.startLocation && (
                          <div className="flex items-center justify-center py-6">
                            <div className="text-center">
                              <Route className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-xs text-slate-400">{t('race.courseInfoPending')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── Live/Completed: show top 3 ── */
                      <>
                        <div className="mb-5">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('race.top3Women')}</p>
                          <div className="space-y-2">
                            {women.length > 0 ? women.map((r, i) => (
                              <div key={r.Bib} className="flex items-center gap-2.5 group/athlete">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                  {r.Nation ? <span className="text-base leading-none">{r.Nation}</span> : r.Name.charAt(0)}
                                </div>
                                <span className="text-sm font-bold text-slate-700 w-4">{i + 1}</span>
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/races/${slug}/${r.Bib}`); }}
                                  className="text-sm text-slate-700 flex-1 truncate text-left hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                                >
                                  {r.Name}
                                </button>
                              </div>
                            )) : (
                              <p className="text-xs text-slate-400">{t('race.noData')}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('race.top3Men')}</p>
                          <div className="space-y-2">
                            {men.length > 0 ? men.map((r, i) => (
                              <div key={r.Bib} className="flex items-center gap-2.5 group/athlete">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                  {r.Nation ? <span className="text-base leading-none">{r.Nation}</span> : r.Name.charAt(0)}
                                </div>
                                <span className="text-sm font-bold text-slate-700 w-4">{i + 1}</span>
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/races/${slug}/${r.Bib}`); }}
                                  className="text-sm text-slate-700 flex-1 truncate text-left hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                                >
                                  {r.Name}
                                </button>
                              </div>
                            )) : (
                              <p className="text-xs text-slate-400">{t('race.noData')}</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}

function RaceDescription({ description, organizer }: { description?: string; organizer?: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-8 p-4 md:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
      {organizer && (
        <p className="text-sm text-blue-600 font-semibold mb-1">{t('race.organizer', { name: organizer })}</p>
      )}
      {description && (
        <div>
          <p className={`text-sm text-slate-600 leading-relaxed ${!expanded ? 'line-clamp-1 md:line-clamp-none' : ''}`}>
            {description}
          </p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="md:hidden mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            {expanded ? t('race.collapse') : t('race.readMore')}
          </button>
        </div>
      )}
    </div>
  );
}

function SubHeader({ race, slug }: { race: RaceInfo; slug: string }) {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [currentSponsor, setCurrentSponsor] = useState(0);
  const { data: sponsorsRaw } = useSponsors();

  const sponsors = useMemo(() => {
    const list = ((sponsorsRaw as any)?.data ?? sponsorsRaw ?? []) as Array<{
      _id: string; name: string; logoUrl: string; level: string; order: number; website?: string;
    }>;
    if (!Array.isArray(list) || list.length === 0) return [];
    const priority: Record<string, number> = { diamond: 0, gold: 1, silver: 2 };
    return [...list].sort((a, b) => (priority[a.level] ?? 9) - (priority[b.level] ?? 9) || a.order - b.order);
  }, [sponsorsRaw]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const id = setInterval(() => setCurrentSponsor(c => (c + 1) % sponsors.length), 3000);
    return () => clearInterval(id);
  }, [sponsors.length]);

  const subBg = scrolled ? 'bg-white border-b border-slate-200 shadow-sm' : 'bg-transparent border-b border-white/10';
  const textColor = scrolled ? 'text-slate-900' : 'text-white';
  const linkColor = scrolled ? 'text-slate-600 hover:text-blue-700' : 'text-white/80 hover:text-white';

  return (
    <div className={`fixed top-14 left-0 right-0 z-40 transition-all duration-300 overflow-visible ${subBg}`}>
      {/* Nav row — 65px */}
      <div className="flex items-center pr-[240px]" style={{ height: 65 }}>
        {/* Race logo + name */}
        <div className="flex items-center gap-3 px-4 sm:px-6 flex-1 min-w-0">
          {race.logoUrl && (
            <img src={race.logoUrl} alt="" className="h-10 w-auto object-contain shrink-0" />
          )}
          <span className={`text-sm font-bold hidden sm:inline truncate max-w-[220px] lg:max-w-[380px] transition-colors duration-300 ${textColor}`}>
            {race.name || ''}
          </span>
        </div>

        {/* Nav actions */}
        <div className="hidden md:flex items-center gap-1 px-4">
          <Link href={`/races/${slug}?search=`} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded transition-colors duration-300 ${linkColor}`}>
            <User className="w-4 h-4" />
            {t('race.myAthletes')}
          </Link>
          <Link href={`/races/${slug}?search=`} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded transition-colors duration-300 ${linkColor}`}>
            <Search className="w-4 h-4" />
            {t('race.findAthletes')}
          </Link>
        </div>
      </div>

      {/* Sponsor tile — same width + angle as MY 5BIB tile to form one unified right block */}
      {sponsors.length > 0 && (
        <div
          className="hidden md:block absolute top-0 right-0"
          style={{
            width: 240,
            height: 65,
            clipPath: 'polygon(14% 0%, 100% 0%, 100% 100%, 0% 100%)',
            background: '#f1f5f9',
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center" style={{ paddingLeft: 36, paddingRight: 12 }}>
            {sponsors.map((s, i) => (
              <div
                key={s._id || s.name}
                className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                  i === currentSponsor ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
              >
                {s.logoUrl ? (
                  <img
                    src={s.logoUrl}
                    alt={s.name}
                    className="w-auto h-auto object-contain"
                    style={{ maxWidth: 130, maxHeight: 48 }}
                    draggable={false}
                  />
                ) : (
                  <span className="text-sm font-bold text-white tracking-wide">{s.name}</span>
                )}
              </div>
            ))}
          </div>
          {sponsors.length > 1 && (
            <div className="absolute bottom-2 right-3 flex gap-1">
              {sponsors.map((_, i) => (
                <span key={i} className={`block rounded-full transition-all duration-300 ${i === currentSponsor ? 'w-3 h-1 bg-slate-500' : 'w-1 h-1 bg-slate-300'}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
