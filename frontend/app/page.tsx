'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Calendar as CalendarIcon,
  ChevronRight,
  Hash,
  Loader2,
  Search,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  useEndedRacesPage,
  useHomepageSearch,
  useHomepageSummary,
} from '@/lib/api-hooks';
import type {
  BibSearchItemDto,
  PaginatedRaceDto,
  RaceCardDto,
  RaceSearchItemDto,
} from '@/lib/api-generated';

// ---------------------------------------------------------------------------
// Constants (PRD §Assets Hero Video)
// ---------------------------------------------------------------------------

const HERO_VIDEO_DESKTOP =
  'https://5sport-media.s3.ap-southeast-1.amazonaws.com/videos/hero-5bib.mp4';
const HERO_VIDEO_MOBILE =
  'https://5sport-media.s3.ap-southeast-1.amazonaws.com/videos/hero-5bib-mobile.mp4';
const HERO_POSTER =
  'https://5sport-media.s3.ap-southeast-1.amazonaws.com/videos/hero-5bib-poster.jpg';
const HERO_FALLBACK_BG =
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1920&q=80';
const RACE_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;
const ENDED_PAGE_SIZE = 9;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateVN(iso: string | undefined, fallback = 'Chưa xác định'): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getCoverImage(url: string | undefined): string {
  return url && url.trim() ? url : RACE_FALLBACK_IMAGE;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { data: summaryResp, isLoading, isError } = useHomepageSummary();
  const summary = summaryResp?.data;

  const liveRaces = summary?.liveRaces ?? [];
  const upcomingRaces = summary?.upcomingRaces ?? [];
  const endedPage1: PaginatedRaceDto = summary?.endedRaces ?? {
    items: [],
    total: 0,
    page: 1,
    limit: ENDED_PAGE_SIZE,
  };

  return (
    <div className="min-h-screen">
      <HeroSection
        liveCount={liveRaces.length}
        stats={{
          totalRaces: summary?.totalRaces ?? 0,
          totalAthletes: summary?.totalAthletes ?? 0,
          totalResults: summary?.totalResults ?? 0,
        }}
        statsLoading={isLoading}
        statsError={isError}
      />

      {/* LIVE — only render when there are live races (BR-01, PRD §Screen 2) */}
      {liveRaces.length > 0 && <LiveRacesSection races={liveRaces} />}

      {/* UPCOMING — only render when populated (PRD §Screen 3) */}
      {upcomingRaces.length > 0 && (
        <UpcomingRacesSection races={upcomingRaces} />
      )}

      {/* ENDED — grid + Xem thêm (PRD §Screen 4, BR-02) */}
      <EndedRacesSection initialPage={endedPage1} />

      {/* Race Alert moved to end (BR-06) */}
      <RaceAlertSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero Section — video background + search + stats
// ---------------------------------------------------------------------------

interface StatsProps {
  totalRaces: number;
  totalAthletes: number;
  totalResults: number;
}

function HeroSection({
  liveCount,
  stats,
  statsLoading,
  statsError,
}: {
  liveCount: number;
  stats: StatsProps;
  statsLoading: boolean;
  statsError: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section className="relative pt-14 overflow-hidden">
      {/* Video background — PRD §Screen 1 */}
      <div className="absolute inset-0 -z-10">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_POSTER}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            // Graceful degradation: hide broken video so poster/fallback shows
            (e.currentTarget as HTMLVideoElement).style.display = 'none';
          }}
        >
          <source media="(min-width: 768px)" src={HERO_VIDEO_DESKTOP} type="video/mp4" />
          <source src={HERO_VIDEO_MOBILE} type="video/mp4" />
        </video>
        {/* Fallback background when video can't load (e.g. S3 ACL still private) */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat -z-10"
          style={{ backgroundImage: `url(${HERO_FALLBACK_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-900/95" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 md:pt-24 pb-16 md:pb-20">
        <div className="max-w-3xl mx-auto text-center md:text-left md:mx-0">
          {/* LIVE badge — clickable anchor to #live-section (hidden when 0 live) */}
          {liveCount > 0 && (
            <a
              href="#live-section"
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-600/20 border border-red-500/30 rounded-full mb-6 hover:bg-red-600/30 transition-colors"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-red-300 text-sm font-semibold">
                {t('home.liveRaces', { count: liveCount })}
              </span>
            </a>
          )}

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-5 leading-[1.08] uppercase">
            {t('home.headline').split('\n').map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}{' '}
            <span className="text-blue-400">{t('home.headlineLive')}</span>
          </h1>

          <p className="text-base md:text-lg text-white/70 mb-8 max-w-xl leading-relaxed">
            {t('home.tagline')}
          </p>

          <HeroSearchBar />

          {/* Stats bar — hidden on error (PRD: trang không crash) */}
          {!statsError && (
            <div className="flex flex-wrap gap-6 md:gap-8 mt-8">
              {[
                {
                  value: statsLoading ? null : stats.totalRaces,
                  label: t('home.statsRaces'),
                  icon: <CalendarIcon className="w-4 h-4 text-blue-400" />,
                },
                {
                  value: statsLoading ? null : stats.totalResults,
                  label: t('home.statsResults'),
                  icon: <Trophy className="w-4 h-4 text-blue-400" />,
                },
                {
                  value: statsLoading ? null : stats.totalAthletes,
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
                      {stat.value === null ? (
                        <span className="inline-block h-6 w-16 rounded bg-white/10 animate-pulse" />
                      ) : (
                        stat.value.toLocaleString('vi-VN')
                      )}
                    </div>
                    <div className="text-xs text-white/50 font-medium mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Search Bar + Dropdown (debounced)
// ---------------------------------------------------------------------------

function HeroSearchBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce input — PRD §Search behavior (300ms)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value]);

  // Auto-detect search type: digits → bib, else race
  const searchType = useMemo<'race' | 'bib' | undefined>(() => {
    if (!debounced) return undefined;
    return /^\d+$/.test(debounced) ? 'bib' : 'race';
  }, [debounced]);

  const { data: searchResp, isFetching } = useHomepageSearch(
    debounced,
    searchType,
    { enabled: debounced.length >= SEARCH_MIN_CHARS },
  );

  const races = searchResp?.data?.races ?? [];
  const bibs = searchResp?.data?.bibs ?? [];
  const hasResults = races.length + bibs.length > 0;
  const showDropdown =
    open && debounced.length >= SEARCH_MIN_CHARS;

  // Close on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showDropdown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    // Fallback: if no dropdown match, take user to search page
    if (!hasResults) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative max-w-xl">
      <form onSubmit={handleSubmit}>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            inputMode="search"
            placeholder={t('home.searchPlaceholder')}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full pl-12 pr-24 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:bg-white/15 transition-all text-base"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue('');
                setOpen(false);
              }}
              aria-label="Clear"
              className="absolute right-[92px] top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-sm"
          >
            {t('common.search')}
          </button>
        </div>
      </form>

      {showDropdown && (
        <SearchDropdown
          races={races}
          bibs={bibs}
          isFetching={isFetching}
          onSelect={() => {
            setOpen(false);
            setValue('');
          }}
        />
      )}
    </div>
  );
}

function SearchDropdown({
  races,
  bibs,
  isFetching,
  onSelect,
}: {
  races: RaceSearchItemDto[];
  bibs: BibSearchItemDto[];
  isFetching: boolean;
  onSelect: () => void;
}) {
  const hasResults = races.length + bibs.length > 0;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 z-30 max-h-[70vh] overflow-y-auto">
      {isFetching && (
        <div className="flex items-center justify-center gap-2 p-4 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang tìm…
        </div>
      )}

      {!isFetching && !hasResults && (
        <div className="p-4 text-sm text-slate-500 text-center">
          Không tìm thấy kết quả nào.
        </div>
      )}

      {bibs.length > 0 && (
        <div>
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-100">
            Tìm thấy BIB ({bibs.length})
          </div>
          <ul>
            {bibs.map((item, i) => (
              <li key={`${item.raceSlug}-${item.bib}-${i}`}>
                <Link
                  href={`/races/${item.raceSlug}/${item.bib}`}
                  onClick={onSelect}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                >
                  <div className="mt-0.5 w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Hash className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {item.raceName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      BIB <strong className="text-slate-700">{item.bib}</strong>
                      {item.athleteName && (
                        <>
                          {' '}— {item.athleteName.trim()}
                        </>
                      )}
                      {item.course && (
                        <>
                          {' '}· <span className="text-slate-600">{item.course}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {races.length > 0 && (
        <div>
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-100">
            Giải đấu ({races.length})
          </div>
          <ul>
            {races.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/races/${item.slug}`}
                  onClick={onSelect}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                >
                  <div className="mt-0.5 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{formatDateVN(item.eventDate)}</span>
                      <StatusChip status={item.status} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: 'live' | 'upcoming' | 'ended' }) {
  if (status === 'live') {
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 uppercase">
        LIVE
      </span>
    );
  }
  if (status === 'upcoming') {
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 uppercase">
        Sắp diễn ra
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-600 uppercase">
      Đã kết thúc
    </span>
  );
}

// ---------------------------------------------------------------------------
// LIVE Section (PRD §Screen 2)
// ---------------------------------------------------------------------------

function LiveRacesSection({ races }: { races: RaceCardDto[] }) {
  return (
    <section id="live-section" className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Đang diễn ra
          </h2>
        </div>
        <p className="text-slate-500 mt-1">
          Kết quả cập nhật theo thời gian thực.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {races.map((r) => (
            <LiveRaceCard key={r.slug} race={r} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveRaceCard({ race }: { race: RaceCardDto }) {
  return (
    <Link
      href={`/races/${race.slug}`}
      className="group relative overflow-hidden rounded-xl shadow-md hover:shadow-2xl transition-shadow duration-500 block"
    >
      <div className="relative h-[260px] md:h-[280px]">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{ backgroundImage: `url(${getCoverImage(race.coverImageUrl)})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase tracking-wide shadow-lg shadow-red-600/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            TRỰC TIẾP
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className="font-bold text-base leading-tight mb-1 line-clamp-2">
            {race.name}
          </h3>
          <p className="text-white/80 text-xs">{formatDateVN(race.eventDate)}</p>
          {race.courses.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {race.courses.slice(0, 5).map((d, i) => (
                <span
                  key={`${d}-${i}`}
                  className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded text-[10px] font-bold"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold bg-red-600 hover:bg-red-500 transition-colors rounded px-3 py-1.5">
            Xem kết quả ngay <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// UPCOMING Section (PRD §Screen 3)
// ---------------------------------------------------------------------------

function UpcomingRacesSection({ races }: { races: RaceCardDto[] }) {
  const { t } = useTranslation();
  return (
    <section className="py-12 md:py-16 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
          {t('home.upcomingEvents')}
        </h2>
        <p className="text-slate-500 mt-1">
          Chuẩn bị theo dõi kết quả các giải sắp diễn ra.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {races.map((r) => (
            <UpcomingRaceCard key={r.slug} race={r} />
          ))}
        </div>
      </div>
    </section>
  );
}

function UpcomingRaceCard({ race }: { race: RaceCardDto }) {
  return (
    <Link
      href={`/races/${race.slug}`}
      className="group relative overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-shadow duration-500 block bg-white"
    >
      <div className="relative h-[200px]">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{ backgroundImage: `url(${getCoverImage(race.coverImageUrl)})` }}
        />
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 bg-blue-600 rounded text-xs font-bold text-white uppercase tracking-wide shadow">
            SẮP DIỄN RA
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-base leading-tight text-slate-900 mb-1 line-clamp-2">
          {race.name}
        </h3>
        <p className="text-slate-500 text-xs flex items-center gap-1 mb-2">
          <CalendarIcon className="w-3 h-3" />
          {formatDateVN(race.eventDate)}
        </p>
        {race.courses.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {race.courses.slice(0, 6).map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold"
              >
                {d}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700">
          Xem thông tin <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// ENDED Section — grid + load more (PRD §Screen 4, BR-02)
// ---------------------------------------------------------------------------

function EndedRacesSection({ initialPage }: { initialPage: PaginatedRaceDto }) {
  const { t } = useTranslation();
  const [pages, setPages] = useState<RaceCardDto[][]>(() => [initialPage.items]);
  const [nextPageToLoad, setNextPageToLoad] = useState<number>(1); // 1 = only initial loaded
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Keep pages state in sync when summary refetches
  useEffect(() => {
    setPages((prev) => {
      if (prev.length === 0) return [initialPage.items];
      const next = [...prev];
      next[0] = initialPage.items;
      return next;
    });
  }, [initialPage.items]);

  const total = initialPage.total ?? 0;
  const flat = useMemo(() => pages.flat(), [pages]);
  const canLoadMore = flat.length < total;

  // nextPageToLoad = page number waiting to be fetched (2, 3, 4...)
  // When user clicks "Xem thêm", we bump it and enable the query.
  const pageToFetch = nextPageToLoad >= 2 ? nextPageToLoad : 2;
  const { data: moreResp, isFetching, isError } = useEndedRacesPage(
    nextPageToLoad >= 2 ? pageToFetch : 1,
    ENDED_PAGE_SIZE,
  );

  // Append when a new page arrives
  useEffect(() => {
    if (nextPageToLoad < 2) return;
    if (isError) {
      setLoadMoreError('Không tải được thêm. Vui lòng thử lại.');
      return;
    }
    const incoming = moreResp?.data?.items;
    if (incoming && incoming.length > 0) {
      setPages((prev) => {
        // Avoid dup-append when page already exists
        if (prev[nextPageToLoad - 1]) return prev;
        const next = [...prev];
        next[nextPageToLoad - 1] = incoming;
        return next;
      });
      setLoadMoreError(null);
    }
  }, [moreResp, isError, nextPageToLoad]);

  const handleLoadMore = () => {
    setLoadMoreError(null);
    setNextPageToLoad((n) => (n < 2 ? 2 : n + 1));
  };

  // Empty state only when truly zero — BR-02
  if (total === 0) {
    return (
      <section className="py-16 md:py-20 bg-[var(--5bib-bg,#fafaf9)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500">
          <Trophy className="w-8 h-8 mx-auto mb-3 text-slate-400" />
          <p>Chưa có giải nào kết thúc.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-20 bg-[var(--5bib-bg,#fafaf9)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              {t('home.pastEvents')}
            </h2>
            <p className="text-slate-500 mt-1 max-w-xl">
              {t('home.pastEventsSubtitle')}
            </p>
          </div>
          <Link
            href="/calendar?status=completed"
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-full hover:bg-slate-100 transition-all"
          >
            Xem tất cả giải <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {flat.map((r) => (
            <EndedRaceCard key={r.slug} race={r} />
          ))}
        </div>

        {loadMoreError && (
          <div className="mt-6 text-center text-sm text-red-600">
            {loadMoreError}
          </div>
        )}

        {canLoadMore && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-full transition-colors"
            >
              {isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
              {isFetching ? 'Đang tải…' : 'Xem thêm'}
            </button>
            <p className="text-xs text-slate-500">
              Đã hiển thị <strong>{flat.length}</strong> / {total} giải
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function EndedRaceCard({ race }: { race: RaceCardDto }) {
  return (
    <Link
      href={`/races/${race.slug}`}
      className="group block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg border border-slate-200 transition-all duration-300"
    >
      <div className="relative h-[180px]">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${getCoverImage(race.coverImageUrl)})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-0.5 bg-slate-700/90 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-wide">
            Đã kết thúc
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-base leading-tight text-slate-900 mb-1 line-clamp-2">
          {race.name}
        </h3>
        <p className="text-slate-500 text-xs flex items-center gap-1 mb-2">
          <CalendarIcon className="w-3 h-3" />
          {formatDateVN(race.eventDate)}
        </p>
        {race.totalFinishers > 0 && (
          <p className="text-slate-700 text-xs font-semibold flex items-center gap-1 mb-2">
            <Users className="w-3 h-3" />
            {race.totalFinishers.toLocaleString('vi-VN')} VĐV
          </p>
        )}
        {race.courses.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {race.courses.slice(0, 6).map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold"
              >
                {d}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700">
          <Trophy className="w-3 h-3" />
          Xem kết quả <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Race Alert (BR-06: moved to end)
// ---------------------------------------------------------------------------

function RaceAlertSection() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800" />
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1920&q=60)',
        }}
      />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
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
  );
}
