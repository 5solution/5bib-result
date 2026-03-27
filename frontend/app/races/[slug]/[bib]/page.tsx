'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trophy, Users, Tag, Clock, Share2, Download, Link2, Check } from 'lucide-react';
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

const DEMO_SPLITS: SplitTime[] = [
  { name: 'Xuất phát', distance: '0K', time: '00:00:00', pace: '-' },
  { name: 'CP1', distance: '5K', time: '00:27:35', pace: '5:31' },
  { name: 'CP2', distance: '10K', time: '00:56:12', pace: '5:43' },
  { name: 'CP3', distance: '15K', time: '01:25:48', pace: '5:55' },
  { name: 'Về đích', distance: '21K', time: '02:00:15', pace: '5:44' },
];

const DEMO_ATHLETE: AthleteResult = {
  Bib: 1001,
  Name: 'Nguyễn Văn An',
  OverallRank: '1',
  GenderRank: '1',
  CatRank: '1',
  Gender: 'M',
  Category: 'M20-29',
  ChipTime: '02:00:15',
  GunTime: '02:01:30',
  Pace: '5:44',
  Gap: '-',
  Nationality: 'VIE',
  Nation: '🇻🇳',
  Certificate: '',
  race_id: 2,
  course_id: 'DUT21',
  distance: '21K',
  splits: DEMO_SPLITS,
  race_name: 'Dalat Ultra Trail 2026',
};

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
      // Try to fetch from API
      const res = await fetch(`/api/race-results/athlete/${slug}/${bib}`);
      if (res.ok) {
        const data = await res.json();
        setAthlete(data);
      } else {
        // Fallback: try race-results endpoint
        const res2 = await fetch(`/api/race-results?name=&pageNo=1&pageSize=1&sortField=OverallRank&sortDirection=ASC`);
        if (res2.ok) {
          const data2 = await res2.json();
          const found = data2.data?.find((r: AthleteResult) => String(r.Bib) === bib);
          if (found) {
            setAthlete({ ...found, splits: DEMO_SPLITS, race_name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) });
          } else {
            setAthlete(DEMO_ATHLETE);
          }
        } else {
          setAthlete(DEMO_ATHLETE);
        }
      }
    } catch {
      setAthlete(DEMO_ATHLETE);
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
      toast.success('Đã sao chép liên kết!');
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handleShareFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      athlete ? `${athlete.Name} - BIB ${athlete.Bib} - ${athlete.distance} - Chip Time: ${athlete.ChipTime}` : ''
    );
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank', 'width=600,height=400');
  };

  // Calculate pace bar widths for the chart
  const getPaceInSeconds = (paceStr: string): number => {
    if (!paceStr || paceStr === '-') return 0;
    const parts = paceStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--5bib-bg)] pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--5bib-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--5bib-text-muted)]">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-[var(--5bib-bg)] pt-16 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Không tìm thấy vận động viên</h2>
          <Link href={`/races/${slug}`} className="text-[var(--5bib-accent)] hover:underline">Quay lại kết quả</Link>
        </div>
      </div>
    );
  }

  const splits = athlete.splits || DEMO_SPLITS;
  const paces = splits.filter((s) => s.pace !== '-').map((s) => getPaceInSeconds(s.pace));
  const maxPace = Math.max(...paces);
  const minPace = Math.min(...paces);

  const rankItems = [
    { label: 'Tổng', rank: athlete.OverallRank, icon: <Trophy className="w-5 h-5" />, color: 'text-[var(--5bib-gold)]' },
    { label: 'Giới tính', rank: athlete.GenderRank, icon: <Users className="w-5 h-5" />, color: 'text-[var(--5bib-accent)]' },
    { label: 'Nhóm tuổi', rank: athlete.CatRank, icon: <Tag className="w-5 h-5" />, color: 'text-[var(--5bib-success)]' },
  ];

  return (
    <div className="min-h-screen bg-[var(--5bib-bg)] pt-16">
      {/* Header */}
      <div className="bg-gradient-to-br from-[var(--5bib-surface)] via-[var(--5bib-surface-2)] to-[var(--5bib-surface)] border-b border-[var(--5bib-border)] diagonal-lines">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <Link href={`/races/${slug}`} className="inline-flex items-center gap-1 text-sm text-[var(--5bib-text-muted)] hover:text-[var(--5bib-accent)] mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Kết quả {athlete.distance}
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-black text-white">{athlete.Name}</h1>
                <span className="text-sm text-[var(--5bib-text-muted)]">{athlete.Nation}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--5bib-text-muted)]">
                <span className="px-2.5 py-1 bg-[var(--5bib-accent)]/10 text-[var(--5bib-accent)] rounded-full font-bold text-xs">BIB {athlete.Bib}</span>
                <span>{athlete.distance}</span>
                <span>&middot;</span>
                <span>{athlete.Gender === 'M' ? 'Nam' : 'Nữ'}</span>
                <span>&middot;</span>
                <span>{athlete.Category}</span>
              </div>
              {athlete.race_name && (
                <p className="text-sm text-[var(--5bib-text-muted)] mt-2">{athlete.race_name}</p>
              )}
            </div>

            {/* Share buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareFacebook}
                className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Chia sẻ
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--5bib-surface-2)] border border-[var(--5bib-border)] text-white hover:border-[var(--5bib-accent)] rounded-lg text-sm font-semibold transition-colors"
              >
                {linkCopied ? <Check className="w-4 h-4 text-[var(--5bib-success)]" /> : <Link2 className="w-4 h-4" />}
                {linkCopied ? 'Đã sao chép' : 'Sao chép link'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Main time display */}
        <div className="bg-[var(--5bib-surface)] border border-[var(--5bib-border)] rounded-xl p-6 md:p-8 text-center">
          <div className="text-xs uppercase tracking-wider text-[var(--5bib-text-muted)] font-bold mb-2">Net Time (Chip Time)</div>
          <div className="text-5xl md:text-6xl font-black text-[var(--5bib-accent)] font-mono tracking-tight mb-4">
            {athlete.ChipTime}
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-[var(--5bib-text-muted)]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Gun Time: <span className="font-mono font-semibold text-white">{athlete.GunTime}</span>
            </span>
            <span className="flex items-center gap-1.5">
              Pace: <span className="font-mono font-semibold text-white">{athlete.Pace} /km</span>
            </span>
          </div>

          {/* Rank badges */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            {rankItems.map((item) => (
              <div key={item.label} className="bg-[var(--5bib-surface-2)] border border-[var(--5bib-border)] rounded-xl p-4">
                <div className={`flex items-center justify-center gap-1.5 mb-1 ${item.color}`}>
                  {item.icon}
                </div>
                <div className="text-2xl md:text-3xl font-black text-white">#{item.rank}</div>
                <div className="text-xs text-[var(--5bib-text-muted)] font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Split Times */}
        <div className="bg-[var(--5bib-surface)] border border-[var(--5bib-border)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--5bib-border)]">
            <h2 className="text-lg font-bold text-white">Split Times</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--5bib-border)]">
                  <th className="text-left px-6 py-3 text-xs font-bold text-[var(--5bib-text-muted)] uppercase tracking-wider">Checkpoint</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-[var(--5bib-text-muted)] uppercase tracking-wider">Cự ly</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-[var(--5bib-text-muted)] uppercase tracking-wider">Thời gian</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-[var(--5bib-text-muted)] uppercase tracking-wider">Pace</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((split, i) => (
                  <tr key={i} className={`border-b border-[var(--5bib-border)]/50 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="px-6 py-3 font-semibold text-white">{split.name}</td>
                    <td className="px-6 py-3 text-[var(--5bib-text-muted)]">{split.distance}</td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-[var(--5bib-accent)]">{split.time}</td>
                    <td className="px-6 py-3 text-right font-mono text-[var(--5bib-text-muted)]">{split.pace}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pace Chart */}
        <div className="bg-[var(--5bib-surface)] border border-[var(--5bib-border)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--5bib-border)]">
            <h2 className="text-lg font-bold text-white">Biểu đồ pace</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {splits.filter((s) => s.pace !== '-').map((split, i) => {
                const paceSeconds = getPaceInSeconds(split.pace);
                // Invert: lower pace = wider bar (faster)
                const range = maxPace - minPace || 1;
                const percentage = maxPace > 0 ? Math.max(30, 100 - ((paceSeconds - minPace) / range) * 50) : 70;
                const isFastest = paceSeconds === minPace;
                const isSlowest = paceSeconds === maxPace;

                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-16 text-xs font-semibold text-[var(--5bib-text-muted)] text-right shrink-0">{split.name}</div>
                    <div className="flex-1">
                      <div className="relative h-8 bg-[var(--5bib-surface-2)] rounded-lg overflow-hidden">
                        <div
                          className={`absolute left-0 top-0 h-full rounded-lg transition-all duration-700 flex items-center px-3 ${
                            isFastest
                              ? 'bg-gradient-to-r from-[var(--5bib-accent)] to-[var(--5bib-accent-dim)]'
                              : isSlowest
                                ? 'bg-gradient-to-r from-orange-500/80 to-orange-600/80'
                                : 'bg-gradient-to-r from-[var(--5bib-accent)]/60 to-[var(--5bib-accent-dim)]/60'
                          }`}
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="text-xs font-bold text-white whitespace-nowrap">{split.pace} /km</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-[var(--5bib-text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[var(--5bib-accent)]" /> Fastest split
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-orange-500/80" /> Slowest split
              </span>
            </div>
          </div>
        </div>

        {/* E-Certificate */}
        <div className="bg-[var(--5bib-surface)] border border-[var(--5bib-border)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--5bib-border)]">
            <h2 className="text-lg font-bold text-white">Chứng nhận hoàn thành</h2>
          </div>
          <div className="p-6">
            <div className="relative bg-gradient-to-br from-[var(--5bib-surface-2)] to-[var(--5bib-bg)] border-2 border-[var(--5bib-accent)]/20 rounded-xl p-8 text-center">
              {/* Certificate content */}
              <div className="border border-[var(--5bib-border)] rounded-lg p-6 md:p-8">
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-[var(--5bib-accent)]/10 flex items-center justify-center">
                  <Award className="w-7 h-7 text-[var(--5bib-accent)]" />
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--5bib-text-muted)] font-bold mb-2">Certificate of Completion</div>
                <div className="text-xl md:text-2xl font-black text-white mb-1">{athlete.Name}</div>
                <div className="text-sm text-[var(--5bib-text-muted)] mb-4">BIB {athlete.Bib}</div>
                <div className="text-3xl font-black text-[var(--5bib-accent)] font-mono mb-2">{athlete.ChipTime}</div>
                <div className="text-sm text-[var(--5bib-text-muted)]">{athlete.distance} &middot; {athlete.race_name || slug.replace(/-/g, ' ')}</div>
              </div>

              <button
                onClick={() => {
                  if (athlete.Certificate) {
                    window.open(athlete.Certificate, '_blank');
                  } else {
                    toast.info('Chứng nhận chưa sẵn sàng. Vui lòng thử lại sau.');
                  }
                }}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[var(--5bib-accent)] hover:bg-[var(--5bib-accent-dim)] text-[var(--5bib-bg)] font-bold rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Tải chứng nhận
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Award({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}
