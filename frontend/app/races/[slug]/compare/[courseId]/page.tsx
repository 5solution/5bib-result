'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trophy, Clock, TrendingUp, Users, Loader2 } from 'lucide-react';

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
  Chiptimes: string;
  Paces: string;
  race_id: string;
  course_id: string;
  distance: string;
}

interface CheckpointConfig {
  key: string;
  name: string;
  distance?: string;
}

interface SplitTime {
  key: string;
  name: string;
  distance: string;
  times: (string | null)[];
  paces: (string | null)[];
}

function parseSplits(chiptimesStr: string, pacesStr: string): { keys: string[]; times: Record<string, string>; paces: Record<string, string> } {
  try {
    const times: Record<string, string> = chiptimesStr ? JSON.parse(chiptimesStr) : {};
    const paces: Record<string, string> = pacesStr ? JSON.parse(pacesStr) : {};
    const keys = Object.keys(times).filter(k => times[k] !== '');
    return { keys, times, paces };
  } catch {
    return { keys: [], times: {}, paces: {} };
  }
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 pt-14 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}

function CompareContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const courseId = params.courseId as string;
  const bibsParam = searchParams.get('bibs') || '';

  const [athletes, setAthletes] = useState<AthleteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [raceName, setRaceName] = useState('');
  const [raceId, setRaceId] = useState('');
  const [checkpoints, setCheckpoints] = useState<CheckpointConfig[]>([]);

  const bibs = bibsParam.split(',').filter(Boolean);

  const fetchData = useCallback(async () => {
    if (bibs.length < 2) { setLoading(false); return; }

    try {
      // Fetch race info first to get raceId
      const raceRes = await fetch(`/api/races/slug/${slug}`);
      if (!raceRes.ok) { setLoading(false); return; }
      const raceBody = await raceRes.json();
      const race = raceBody?.data ?? raceBody;
      const id = race?._id || race?.id;
      setRaceId(id);
      setRaceName(race?.title || '');

      // Get checkpoints from course
      const course = (race?.courses || []).find((c: any) => (c.courseId || c.id) === courseId);
      if (course?.checkpoints) setCheckpoints(course.checkpoints);

      // Fetch compare data
      const compareRes = await fetch(`/api/race-results/compare/${id}?bibs=${bibs.join(',')}`);
      if (compareRes.ok) {
        const body = await compareRes.json();
        setAthletes(body?.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [slug, courseId, bibsParam]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatName = (name: string) =>
    name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // Build split comparison table
  const buildSplits = (): SplitTime[] => {
    if (athletes.length === 0) return [];

    // Collect all checkpoint keys from all athletes
    const allParsed = athletes.map(a => parseSplits(a.Chiptimes, a.Paces));
    const allKeys = new Set<string>();
    allParsed.forEach(p => p.keys.forEach(k => allKeys.add(k)));

    // Build checkpoint map
    const cpMap = new Map<string, CheckpointConfig>();
    checkpoints.forEach(cp => cpMap.set(cp.key, cp));

    const orderedKeys = Array.from(allKeys);

    return orderedKeys.map(key => {
      const cp = cpMap.get(key);
      const name = cp?.name || (key === 'Start' ? 'Xuat phat' : key === 'Finish' ? 'Ve dich' : key);
      return {
        key,
        name,
        distance: cp?.distance || '',
        times: allParsed.map(p => p.times[key] || null),
        paces: allParsed.map(p => p.paces[key] || null),
      };
    });
  };

  const splits = buildSplits();

  // Find fastest time at each split
  const getFastestIdx = (times: (string | null)[]) => {
    let bestIdx = -1;
    let bestSeconds = Infinity;
    times.forEach((t, i) => {
      if (!t) return;
      const parts = t.split(':').map(Number);
      const secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
      if (secs > 0 && secs < bestSeconds) {
        bestSeconds = secs;
        bestIdx = i;
      }
    });
    return bestIdx;
  };

  // Colors for athletes
  const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600', 'bg-rose-600'];
  const lightColors = ['bg-blue-50', 'bg-emerald-50', 'bg-amber-50', 'bg-purple-50', 'bg-rose-50'];
  const textColors = ['text-blue-600', 'text-emerald-600', 'text-amber-600', 'text-purple-600', 'text-rose-600'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-14 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (athletes.length < 2) {
    return (
      <div className="min-h-screen bg-gray-50 pt-14">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-700 mb-1">Can chon it nhat 2 VDV de so sanh</h3>
          <Link href={`/races/${slug}/ranking/${courseId}`} className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Quay lai bang xep hang
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-14">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <Link href={`/races/${slug}/ranking/${courseId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600 transition-colors mb-3">
            <ChevronLeft className="w-4 h-4" /> Bang xep hang
          </Link>
          <h1 className="text-xl font-black text-gray-900">So sanh van dong vien</h1>
          {raceName && <p className="text-sm text-gray-500 mt-1">{raceName} &middot; {athletes[0]?.distance}</p>}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Athlete cards */}
        <div className={`grid gap-4 mb-8 ${athletes.length === 2 ? 'grid-cols-2' : athletes.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {athletes.map((a, i) => (
            <Link key={a.Bib} href={`/races/${slug}/${a.Bib}`} className={`${lightColors[i]} rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full ${colors[i]} text-white flex items-center justify-center text-sm font-bold`}>
                  {a.Name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{formatName(a.Name)}</p>
                  <p className="text-xs text-gray-500">BIB {a.Bib} &middot; {a.Gender === 'Female' ? 'Nu' : 'Nam'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Hang</p>
                  <p className="font-bold text-gray-900 text-sm">#{a.OverallRank}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Thoi gian</p>
                  <p className="font-mono font-bold text-gray-900 text-sm">{a.ChipTime}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Pace</p>
                  <p className="font-mono text-gray-700 text-sm">{a.Pace}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Category</p>
                  <p className="text-gray-700 text-sm">{a.Category}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Split times comparison */}
        {splits.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="font-bold text-gray-900 text-sm">So sanh theo checkpoint</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Checkpoint</th>
                    {athletes.map((a, i) => (
                      <th key={a.Bib} className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                        <span className={textColors[i]}>{formatName(a.Name)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {splits.map((split) => {
                    const fastestIdx = getFastestIdx(split.times);
                    return (
                      <tr key={split.key} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{split.name}</p>
                          {split.distance && <p className="text-xs text-gray-400">{split.distance}</p>}
                        </td>
                        {split.times.map((time, i) => (
                          <td key={i} className="px-4 py-3 text-center">
                            <p className={`font-mono text-sm font-bold ${i === fastestIdx ? 'text-emerald-600' : 'text-gray-900'}`}>
                              {time || '-'}
                            </p>
                            {split.paces[i] && (
                              <p className="text-xs text-gray-400 font-mono">{split.paces[i]}/km</p>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Overall comparison summary */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gray-400" />
            <h2 className="font-bold text-gray-900 text-sm">Tong hop</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Chi so</th>
                  {athletes.map((a, i) => (
                    <th key={a.Bib} className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                      <span className={textColors[i]}>{formatName(a.Name)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Hang tong</td>
                  {athletes.map((a, i) => (
                    <td key={a.Bib} className="px-4 py-3 text-center font-bold text-sm">#{a.OverallRank}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Hang gioi tinh</td>
                  {athletes.map(a => (
                    <td key={a.Bib} className="px-4 py-3 text-center text-sm">#{a.GenderRank}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Hang nhom tuoi</td>
                  {athletes.map(a => (
                    <td key={a.Bib} className="px-4 py-3 text-center text-sm">#{a.CatRank}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Chip Time</td>
                  {athletes.map((a, i) => {
                    const fastest = getFastestIdx(athletes.map(x => x.ChipTime));
                    return (
                      <td key={a.Bib} className={`px-4 py-3 text-center font-mono font-bold text-sm ${i === fastest ? 'text-emerald-600' : ''}`}>
                        {a.ChipTime}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Gun Time</td>
                  {athletes.map(a => (
                    <td key={a.Bib} className="px-4 py-3 text-center font-mono text-sm">{a.GunTime}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Pace</td>
                  {athletes.map(a => (
                    <td key={a.Bib} className="px-4 py-3 text-center font-mono text-sm">{a.Pace}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
