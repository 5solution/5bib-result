'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Clock,
  Link2,
  Check,
  Timer,
  TrendingUp,
  Award,
  Users,
  Tag,
  Trophy,
  Download,
  Gauge,
  ArrowUpDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface AthleteResult {
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
  splits?: SplitTime[];
  race_name?: string;
}

interface SplitTime {
  name: string;
  distance: string;
  time: string;
  pace: string;
}

export default function AthleteDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const bib = params.bib as string;

  const [athlete, setAthlete] = useState<AthleteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchAthlete = useCallback(async () => {
    try {
      setLoading(true);
      const raceRes = await fetch(`/api/races/slug/${slug}`);
      if (!raceRes.ok) {
        setAthlete(null);
        return;
      }
      const raceBody = await raceRes.json();
      const raceData = raceBody?.data ?? raceBody;
      const raceId = raceData?._id;
      if (!raceId) {
        setAthlete(null);
        return;
      }

      const res = await fetch(`/api/race-results/athlete/${raceId}/${bib}`);
      if (res.ok) {
        const body = await res.json();
        const data = body?.data ?? body;
        if (data) {
          setAthlete({
            ...data,
            race_name:
              raceData.title ||
              slug
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase()),
          });
        } else {
          setAthlete(null);
        }
      } else {
        setAthlete(null);
      }
    } catch {
      setAthlete(null);
    } finally {
      setLoading(false);
    }
  }, [slug, bib]);

  useEffect(() => {
    fetchAthlete();
  }, [fetchAthlete]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      toast.success('Copied link!');
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handleShareFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      athlete
        ? `${athlete.Name} - BIB ${athlete.Bib} - ${athlete.distance} - Chip Time: ${athlete.ChipTime}`
        : ''
    );
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
      '_blank',
      'width=600,height=400'
    );
  };

  const getPaceInSeconds = (paceStr: string): number => {
    if (!paceStr || paceStr === '-') return 0;
    const parts = paceStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0');
  };

  const formatName = (name: string) => {
    return name
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatRank = (rank: string) => {
    const num = parseInt(rank);
    if (isNaN(num)) return rank;
    if (num === 1) return '1st';
    if (num === 2) return '2nd';
    if (num === 3) return '3rd';
    return `${num}th`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-medium text-sm">Loading results...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!athlete) {
    return (
      <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Athlete not found
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            BIB #{bib} does not exist in this race.
          </p>
          <Link
            href={`/races/${slug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-lg font-semibold text-sm hover:bg-cyan-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to results
          </Link>
        </div>
      </div>
    );
  }

  const splits = athlete.splits ?? [];
  const hasSplits = splits.length > 0;
  const paces = splits
    .filter((s) => s.pace !== '-')
    .map((s) => getPaceInSeconds(s.pace));
  const maxPace = paces.length > 0 ? Math.max(...paces) : 0;
  const minPace = paces.length > 0 ? Math.min(...paces) : 0;

  const genderLabel =
    athlete.Gender === 'Male' || athlete.Gender === 'M' ? 'Male' : 'Female';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== HEADER / HERO ===== */}
      <div className="bg-slate-900">
        {/* Top nav */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-3">
          <div className="flex items-center justify-between">
            <Link
              href={`/races/${slug}`}
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to results</span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareFacebook}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors border border-slate-700"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Share
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors border border-slate-700"
              >
                {linkCopied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
                {linkCopied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>

        {/* Athlete identity */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 pt-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tight">
                {getInitials(athlete.Name)}
              </span>
            </div>

            <div className="text-center sm:text-left">
              {/* Name */}
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
                {formatName(athlete.Name)}
              </h1>

              {/* Metadata row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1.5 text-sm">
                <span className="font-mono font-bold text-cyan-400">
                  BIB {athlete.Bib}
                </span>
                <span className="text-slate-600">|</span>
                {athlete.Nationality && (
                  <>
                    <span className="text-slate-300">
                      {athlete.Nation} {athlete.Nationality}
                    </span>
                    <span className="text-slate-600">|</span>
                  </>
                )}
                <span className="text-slate-300">{genderLabel}</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300">{athlete.Category}</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300">{athlete.distance}</span>
              </div>

              {/* Race name subtitle */}
              {athlete.race_name && (
                <p className="text-slate-500 text-sm mt-2">
                  {athlete.race_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* === PRIMARY STATS DASHBOARD === */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Race time - large display */}
          <div className="text-center py-8 md:py-10 px-6">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold mb-3">
              Race Time
            </div>
            <div
              className="text-5xl sm:text-6xl md:text-7xl font-black text-slate-900 tracking-tighter mb-4"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {athlete.ChipTime || '--:--:--'}
            </div>

            {/* Pace & Gap row */}
            <div className="flex items-center justify-center gap-5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-slate-400" />
                Pace:{' '}
                <span className="font-mono font-bold text-slate-700">
                  {athlete.Pace || '-'} /km
                </span>
              </span>
              {athlete.GunTime && (
                <>
                  <span className="w-px h-4 bg-slate-200" />
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Gun:{' '}
                    <span className="font-mono font-bold text-slate-700">
                      {athlete.GunTime}
                    </span>
                  </span>
                </>
              )}
              {athlete.Gap && athlete.Gap !== '-' && (
                <>
                  <span className="w-px h-4 bg-slate-200 hidden sm:block" />
                  <span className="hidden sm:flex items-center gap-1.5">
                    <ArrowUpDown className="w-4 h-4 text-slate-400" />
                    Gap:{' '}
                    <span className="font-mono font-bold text-slate-700">
                      {athlete.Gap}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 3 ranking cards */}
          <div className="grid grid-cols-3 border-t border-slate-200">
            {[
              {
                label: 'Overall',
                rank: athlete.OverallRank,
                icon: <Trophy className="w-5 h-5" />,
              },
              {
                label: genderLabel,
                rank: athlete.GenderRank,
                icon: <Users className="w-5 h-5" />,
              },
              {
                label: athlete.Category || 'Category',
                rank: athlete.CatRank,
                icon: <Tag className="w-5 h-5" />,
              },
            ].map((item, idx) => (
              <div
                key={item.label}
                className={`py-6 text-center ${idx < 2 ? 'border-r border-slate-200' : ''}`}
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 mb-2">
                  {item.icon}
                </div>
                <div className="text-2xl md:text-3xl font-black text-slate-900 font-mono">
                  {item.rank ? `#${item.rank}` : '-'}
                </div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === SPLIT TIMES TABLE === */}
        {hasSplits && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <Timer className="w-5 h-5 text-cyan-600" />
              <h2 className="text-base font-bold text-slate-900">
                Timing Points
              </h2>
            </div>

            {/* Mobile card layout */}
            <div className="block md:hidden divide-y divide-slate-100">
              {splits.map((split, i) => {
                const paceSeconds = getPaceInSeconds(split.pace);
                const isFastest =
                  split.pace !== '-' && paces.length > 1 && paceSeconds === minPace;
                const isSlowest =
                  split.pace !== '-' && paces.length > 1 && paceSeconds === maxPace;

                return (
                  <div
                    key={i}
                    className={`px-4 py-3.5 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-900 text-sm">
                          {split.name}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {split.distance}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pl-8">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {split.time}
                      </span>
                      <div className="flex items-center gap-2">
                        {isFastest && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            FASTEST
                          </span>
                        )}
                        {isSlowest && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            SLOWEST
                          </span>
                        )}
                        {split.pace !== '-' && (
                          <span className="font-mono text-xs text-slate-500">
                            {split.pace} /km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-10">
                      #
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                      Checkpoint
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                      Distance
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                      Time
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider">
                      Pace
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider w-24" />
                  </tr>
                </thead>
                <tbody>
                  {splits.map((split, i) => {
                    const paceSeconds = getPaceInSeconds(split.pace);
                    const isFastest =
                      split.pace !== '-' &&
                      paces.length > 1 &&
                      paceSeconds === minPace;
                    const isSlowest =
                      split.pace !== '-' &&
                      paces.length > 1 &&
                      paceSeconds === maxPace;

                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 transition-colors ${
                          i % 2 === 1
                            ? 'bg-slate-50/50 hover:bg-slate-100/60'
                            : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="px-5 py-3">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {split.name}
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-500">
                          {split.distance}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                          {split.time}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-slate-600">
                          {split.pace !== '-' ? `${split.pace} /km` : '-'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {isFastest && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              FASTEST
                            </span>
                          )}
                          {isSlowest && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              SLOWEST
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === PACE CHART === */}
        {hasSplits && paces.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-cyan-600" />
              <h2 className="text-base font-bold text-slate-900">
                Pace Analysis
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-2.5">
                {splits
                  .filter((s) => s.pace !== '-')
                  .map((split, i) => {
                    const paceSeconds = getPaceInSeconds(split.pace);
                    const range = maxPace - minPace || 1;
                    const percentage =
                      maxPace > 0
                        ? Math.max(30, 100 - ((paceSeconds - minPace) / range) * 50)
                        : 70;
                    const isFastest = paces.length > 1 && paceSeconds === minPace;
                    const isSlowest = paces.length > 1 && paceSeconds === maxPace;

                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-24 md:w-32 text-right shrink-0">
                          <span className="text-xs font-medium text-slate-500 truncate block">
                            {split.name}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="relative h-7 bg-slate-100 rounded overflow-hidden">
                            <div
                              className={`absolute left-0 top-0 h-full rounded transition-all duration-700 ease-out flex items-center justify-end px-3 ${
                                isFastest
                                  ? 'bg-emerald-500'
                                  : isSlowest
                                    ? 'bg-amber-500'
                                    : 'bg-cyan-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            >
                              <span className="text-[11px] font-bold text-white font-mono whitespace-nowrap">
                                {split.pace} /km
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-slate-100 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Fastest
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  Slowest
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />
                  Normal
                </span>
              </div>
            </div>
          </div>
        )}

        {/* === CERTIFICATE === */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
            <Award className="w-5 h-5 text-cyan-600" />
            <h2 className="text-base font-bold text-slate-900">
              Certificate of Completion
            </h2>
          </div>
          <div className="p-6 md:p-8">
            {/* Certificate card */}
            <div className="relative bg-slate-50 border border-slate-200 rounded-xl p-8 md:p-10 text-center overflow-hidden">
              {/* Decorative corners */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-cyan-300 rounded-tl" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-cyan-300 rounded-tr" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-cyan-300 rounded-bl" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-cyan-300 rounded-br" />

              <div className="relative">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-cyan-600 flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-semibold mb-3">
                  Certificate of Completion
                </div>
                <div className="text-2xl md:text-3xl font-black text-slate-900 mb-1">
                  {formatName(athlete.Name)}
                </div>
                <div className="text-sm text-slate-400 mb-5">
                  BIB #{athlete.Bib}
                </div>
                <div
                  className="text-4xl md:text-5xl font-black text-cyan-600 mb-2"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {athlete.ChipTime || '--:--:--'}
                </div>
                <div className="text-sm text-slate-500">
                  {athlete.distance} &middot;{' '}
                  {athlete.race_name || slug.replace(/-/g, ' ')}
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => {
                  if (athlete.Certificate) {
                    window.open(athlete.Certificate, '_blank');
                  } else {
                    toast.info(
                      'Certificate not available yet. Please try again later.'
                    );
                  }
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Download Certificate
              </button>
            </div>
          </div>
        </div>

        {/* === BOTTOM NAV === */}
        <div className="text-center py-4">
          <Link
            href={`/races/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-600 transition-colors font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to race results
          </Link>
        </div>
      </div>
    </div>
  );
}
