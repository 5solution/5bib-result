'use client';

/**
 * F-01 — Rank Progression Chart.
 *
 * Visualises how an athlete's overall rank moved across checkpoints.
 * Y-axis is inverted (rank 1 on top) so "going up" means climbing positions.
 * DNF checkpoints (no rank) are skipped rather than rendered as a gap line.
 *
 * v2 additions:
 *  - Pattern detection: 10 race patterns (dominant, comeback, early_fade,
 *    late_surge, steady_improve, volatile, steady, up, down, flat) with
 *    personalised insight text in VI/EN.
 *  - Stats mini-row: peak rank + checkpoint, best single-leg climb,
 *    hardest single-leg drop.
 *  - Start baseline dropped (OverallRanks.Start is always "1" — keeps
 *    every athlete falsely labelled "Tụt hạng").
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus, Trophy, Zap, AlertTriangle } from 'lucide-react';

export interface RankProgressionSplit {
  name: string;
  distance?: string;
  overallRank?: string;
  rankDelta?: number;
}

interface Props {
  splits: RankProgressionSplit[];
  finalRank?: string | null;
}

interface DataPoint {
  checkpoint: string;
  distance: string;
  rank: number;
  delta: number;
}

type RacePattern =
  | 'dominant'
  | 'late_surge'
  | 'comeback'
  | 'early_fade'
  | 'steady_improve'
  | 'volatile'
  | 'steady'
  | 'up'
  | 'down'
  | 'flat';

interface RaceAnalysis {
  pattern: RacePattern;
  insight: { vi: string; en: string };
  label: { vi: string; en: string };
  color: string; // Tailwind bg class for badge
  stats: {
    peakRank: number;
    peakAt: string;
    bestClimb: number;
    bestClimbAt: string;
    worstDrop: number;
    worstDropAt: string;
    netChange: number;
  };
}

const toNumeric = (r: string | undefined | null): number | null => {
  if (!r) return null;
  const n = parseInt(String(r).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function analyse(pts: DataPoint[], finalRank: number | null): RaceAnalysis {
  const n = pts.length;
  const firstRank = pts[0].rank;
  const lastRank = pts[n - 1].rank;

  const peakRank = pts.reduce((m, p) => Math.min(m, p.rank), firstRank);
  const peakPt = pts.find((p) => p.rank === peakRank) ?? pts[n - 1];
  const worstRank = pts.reduce((m, p) => Math.max(m, p.rank), firstRank);

  let bestClimb = 0, bestClimbAt = '';
  let worstDrop = 0, worstDropAt = '';
  for (let i = 1; i < n; i++) {
    const change = pts[i - 1].rank - pts[i].rank; // positive = climbed
    if (change > bestClimb) { bestClimb = change; bestClimbAt = pts[i].checkpoint; }
    if (-change > worstDrop) { worstDrop = -change; worstDropAt = pts[i].checkpoint; }
  }

  const netChange = firstRank - lastRank; // positive = climbed overall

  // Late-stage surge: what did the athlete gain in the final 2 legs?
  const lateGain = n >= 3 ? pts[n - 3].rank - pts[n - 1].rank : 0;

  // Volatile: count legs with a swing > 5 positions
  let bigSwings = 0;
  for (let i = 1; i < n; i++) {
    if (Math.abs(pts[i - 1].rank - pts[i].rank) >= 5) bigSwings++;
  }

  // ── Pattern Detection ─────────────────────────────────────────────
  let pattern: RacePattern;

  if (peakRank <= 3 && lastRank <= 5 && worstRank <= 8) {
    pattern = 'dominant';
  } else if (lateGain >= 6 || (bestClimb >= 6 && pts.indexOf(peakPt) >= Math.floor(n / 2))) {
    pattern = 'late_surge';
  } else if (worstDrop >= 8 && netChange >= 5) {
    pattern = 'comeback';
  } else if (firstRank <= 5 && lastRank >= firstRank + 8) {
    pattern = 'early_fade';
  } else if (bigSwings >= 2) {
    pattern = 'volatile';
  } else if (netChange >= 5 && lastRank < firstRank) {
    pattern = 'steady_improve';
  } else if (Math.abs(netChange) <= 2 && worstRank - peakRank <= 4) {
    pattern = 'steady';
  } else if (netChange > 0) {
    pattern = 'up';
  } else if (netChange < 0) {
    pattern = 'down';
  } else {
    pattern = 'flat';
  }

  // ── Labels per pattern ────────────────────────────────────────────
  const labels: Record<RacePattern, { vi: string; en: string; color: string }> = {
    dominant:       { vi: '💪 Thống trị',        en: '💪 Dominant',      color: 'bg-amber-100 text-amber-800' },
    late_surge:     { vi: '🚀 Bứt tốc cuối',     en: '🚀 Late Surge',    color: 'bg-blue-100 text-blue-800' },
    comeback:       { vi: '↩️ Lội ngược dòng',   en: '↩️ Comeback',      color: 'bg-purple-100 text-purple-800' },
    early_fade:     { vi: '😮 Sụt sức cuối',     en: '😮 Faded Late',    color: 'bg-orange-100 text-orange-800' },
    steady_improve: { vi: '📈 Leo đều đặn',       en: '📈 Steady Climb',  color: 'bg-green-100 text-green-800' },
    volatile:       { vi: '🌊 Thất thường',       en: '🌊 Volatile',      color: 'bg-slate-100 text-slate-700' },
    steady:         { vi: '➡️ Ổn định',           en: '➡️ Consistent',   color: 'bg-stone-100 text-stone-700' },
    up:             { vi: '↑ Leo hạng',           en: '↑ Climbed',        color: 'bg-green-100 text-green-800' },
    down:           { vi: '↓ Tụt hạng',           en: '↓ Dropped',        color: 'bg-red-100 text-red-700' },
    flat:           { vi: '— Giữ hạng',           en: '— Held Rank',      color: 'bg-stone-100 text-stone-700' },
  };

  // ── Personalised insight text ─────────────────────────────────────
  const insights: Record<RacePattern, { vi: string; en: string }> = {
    dominant: {
      vi: `${peakRank === 1 ? 'Dẫn đầu' : `Top ${peakRank}`} gần như toàn bộ hành trình — một màn trình diễn đỉnh cao. Đối thủ chưa lúc nào thực sự đe dọa được thứ hạng của bạn.`,
      en: `${peakRank === 1 ? 'Led the race' : `Stayed in the top ${peakRank}`} for almost the entire course — an elite, commanding performance.`,
    },
    late_surge: {
      vi: `Chiến thuật nén sức hoàn hảo! ${bestClimb >= 3 ? `Bứt tốc vượt ${bestClimb} người ở chặng ${bestClimbAt}` : 'Bứt tốc mạnh ở những chặng cuối'}, về đích hạng #${lastRank}. Điển hình của "negative split" thành công.`,
      en: `Textbook negative-split execution! ${bestClimb >= 3 ? `Passed ${bestClimb} runners in the ${bestClimbAt} segment` : 'Surged powerfully in the final legs'}, finishing #${lastRank}. This is what saving your legs looks like.`,
    },
    comeback: {
      vi: `Câu chuyện lội ngược dòng đáng nhớ! Chạm đáy hạng #${worstRank} rồi leo ngược lên #${lastRank}. Đây là thứ bản lĩnh tâm lý và sức mạnh cơ thể rất ít VĐV làm được.`,
      en: `One of those comeback stories! Dropped to #${worstRank} then clawed back to #${lastRank}. This kind of mental and physical resilience is rare.`,
    },
    early_fade: {
      vi: `Xuất phát mạnh mẽ ở hạng #${firstRank}${worstDrop >= 4 ? `, nhưng mất ${worstDrop} hạng chỉ trong chặng ${worstDropAt}` : ', nhưng mất sức ở những km cuối'}. Một bài học quý về quản lý năng lượng cho những giải tiếp theo.`,
      en: `Started fast at #${firstRank}${worstDrop >= 4 ? `, but gave back ${worstDrop} places in the ${worstDropAt} segment` : ', but couldn\'t hold on in the final legs'}. A valuable pacing lesson for the next race.`,
    },
    steady_improve: {
      vi: `Phong độ tăng dần qua từng chặng, leo tổng cộng ${Math.abs(netChange)} hạng từ đầu đến cuối${bestClimb >= 3 ? ` (ấn tượng nhất: +${bestClimb} tại ${bestClimbAt})` : ''}. Chiến lược đua kiên nhẫn, thể lực được bảo toàn tốt.`,
      en: `Steadily improved through the race, climbing ${Math.abs(netChange)} places overall${bestClimb >= 3 ? ` (biggest move: +${bestClimb} at ${bestClimbAt})` : ''}. Patient racing and smart energy management.`,
    },
    volatile: {
      vi: `Thứ hạng lên xuống thất thường — đỉnh cao #${peakRank}${peakPt.checkpoint ? ` tại ${peakPt.checkpoint}` : ''}, nhưng cũng có những chặng đuối nặng. ${bestClimb >= 5 ? `Chặng ${bestClimbAt} là điểm sáng với +${bestClimb} hạng.` : 'Phong độ thiếu nhất quán.'} `,
      en: `Rank swung wildly — peaked at #${peakRank}${peakPt.checkpoint ? ` at ${peakPt.checkpoint}` : ''} but struggled to maintain it. ${bestClimb >= 5 ? `The ${bestClimbAt} segment was a highlight (+${bestClimb} places).` : 'Inconsistent pacing throughout.'}`,
    },
    steady: {
      vi: `Cuộc đua kiên định và có kiểm soát. Thứ hạng dao động ít — dấu hiệu của VĐV có kế hoạch đua rõ ràng và tự tin vào tốc độ của mình.`,
      en: `Controlled and disciplined race. Minimal rank fluctuation — the hallmark of an athlete who races to their own plan.`,
    },
    up: {
      vi: `Leo ${Math.abs(netChange)} hạng từ đầu đến cuối cuộc đua${bestClimb >= 3 ? `, ấn tượng nhất là chặng ${bestClimbAt} với +${bestClimb} hạng` : ''}. Nỗ lực đáng ghi nhận.`,
      en: `Climbed ${Math.abs(netChange)} places from the opening checkpoint${bestClimb >= 3 ? `, with a standout +${bestClimb} move at ${bestClimbAt}` : ''}. A commendable effort.`,
    },
    down: {
      vi: `Tụt ${Math.abs(netChange)} hạng so với đầu cuộc đua${worstDrop >= 3 ? `. Chặng khó nhất là ${worstDropAt} với -${worstDrop} hạng` : ''}. Kết thúc ở hạng #${lastRank}${finalRank !== null && finalRank !== lastRank ? ` (chip time: #${finalRank})` : ''}.`,
      en: `Lost ${Math.abs(netChange)} places from the opening checkpoint${worstDrop >= 3 ? `. Toughest leg was ${worstDropAt} (−${worstDrop} places)` : ''}. Finished #${lastRank}.`,
    },
    flat: {
      vi: `Thứ hạng gần như không thay đổi từ đầu đến cuối — cuộc đua ổn định, bạn biết mình chạy ở mức nào và giữ đúng mức đó.`,
      en: `Rank barely changed from start to finish — a steady, self-aware race.`,
    },
  };

  return {
    pattern,
    insight: insights[pattern],
    label: { vi: labels[pattern].vi, en: labels[pattern].en },
    color: labels[pattern].color,
    stats: { peakRank, peakAt: peakPt.checkpoint, bestClimb, bestClimbAt, worstDrop, worstDropAt, netChange },
  };
}

export function RankProgressionChart({ splits, finalRank }: Props) {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language?.startsWith('vi');

  const { data, maxRank, analysis } = useMemo(() => {
    const pts: DataPoint[] = [];
    for (const s of splits) {
      const rank = toNumeric(s.overallRank);
      if (rank === null) continue;
      pts.push({
        checkpoint: s.name,
        distance: s.distance ?? '',
        rank,
        delta: s.rankDelta ?? 0,
      });
    }

    // Drop artificial Start baseline (OverallRanks.Start is always "1").
    if (pts.length >= 2 && pts[0].rank === 1) {
      pts.shift();
      if (pts.length > 0) pts[0] = { ...pts[0], delta: 0 };
    }

    // Override finish rank with authoritative chip-time rank.
    const finalNumeric = toNumeric(finalRank ?? undefined);
    if (finalNumeric !== null && pts.length > 0) {
      const last = pts[pts.length - 1];
      if (last.rank !== finalNumeric) {
        const prev = pts.length >= 2 ? pts[pts.length - 2].rank : last.rank;
        pts[pts.length - 1] = {
          ...last,
          rank: finalNumeric,
          delta: prev - finalNumeric,
        };
      }
    }

    const max = pts.reduce((m, p) => Math.max(m, p.rank), 0);
    const a = pts.length >= 2 ? analyse(pts, finalNumeric) : null;
    return { data: pts, maxRank: max, analysis: a };
  }, [splits, finalRank]);

  if (data.length < 2) return null;

  // ── Trend icon (simplified; pattern badge carries the real story) ──
  const netChange = analysis?.stats.netChange ?? 0;
  const trendIcon =
    netChange > 0 ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : netChange < 0 ? (
      <TrendingDown className="h-4 w-4 text-red-500" />
    ) : (
      <Minus className="h-4 w-4 text-stone-500" />
    );

  const labelText = analysis
    ? (isVi ? analysis.label.vi : analysis.label.en)
    : t(`athlete.rankProgression.trend.flat`);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-2">
        <h3 className="font-heading text-lg font-semibold text-stone-900">
          {t('athlete.rankProgression.title')}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            analysis?.color ?? 'bg-stone-100 text-stone-700'
          }`}
        >
          {trendIcon}
          {labelText}
        </span>
      </div>

      {/* Chart */}
      <div className="px-5 pb-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              dataKey="checkpoint"
              tick={{ fontSize: 10, fill: '#78716c' }}
              axisLine={{ stroke: '#d6d3d1' }}
              tickLine={false}
            />
            <YAxis
              reversed
              domain={[1, Math.max(maxRank, 10)]}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#78716c' }}
              axisLine={{ stroke: '#d6d3d1' }}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e7e5e4',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, _name, entry) => {
                const payload = entry?.payload as DataPoint | undefined;
                const delta = payload?.delta ?? 0;
                const suffix =
                  delta > 0
                    ? ` ↑${delta}`
                    : delta < 0
                    ? ` ↓${Math.abs(delta)}`
                    : '';
                return [
                  `#${value as number}${suffix}`,
                  t('athlete.rankProgression.rank'),
                ];
              }}
              labelFormatter={(label, payload) => {
                const d = (payload?.[0]?.payload as DataPoint | undefined)?.distance;
                return d ? `${String(label)} · ${d}` : String(label);
              }}
            />
            <ReferenceLine y={1} stroke="#ea580c" strokeDasharray="3 3" strokeOpacity={0.4} />
            <Line
              type="monotone"
              dataKey="rank"
              stroke="#1d4ed8"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 7 }}
            >
              <LabelList
                dataKey="rank"
                position="top"
                fontSize={10}
                fill="#1c1917"
                formatter={(label) => `#${label as number}`}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats mini-row */}
      {analysis && (
        <div className="mx-5 mb-4 grid grid-cols-3 divide-x divide-stone-100 rounded-xl bg-stone-50 border border-stone-100 text-center text-[11px]">
          <div className="px-2 py-2.5">
            <div className="flex items-center justify-center gap-1 text-amber-600 font-bold mb-0.5">
              <Trophy className="h-3 w-3" />
              {isVi ? 'Hạng tốt nhất' : 'Peak Rank'}
            </div>
            <div className="font-black text-stone-900 text-[13px]">#{analysis.stats.peakRank}</div>
            {analysis.stats.peakAt && (
              <div className="text-[10px] text-stone-400 truncate px-1">{analysis.stats.peakAt}</div>
            )}
          </div>
          <div className="px-2 py-2.5">
            <div className="flex items-center justify-center gap-1 text-green-600 font-bold mb-0.5">
              <Zap className="h-3 w-3" />
              {isVi ? 'Chặng bứt nhất' : 'Best Leg'}
            </div>
            {analysis.stats.bestClimb > 0 ? (
              <>
                <div className="font-black text-stone-900 text-[13px]">+{analysis.stats.bestClimb}</div>
                <div className="text-[10px] text-stone-400 truncate px-1">{analysis.stats.bestClimbAt}</div>
              </>
            ) : (
              <div className="font-black text-stone-400 text-[13px]">—</div>
            )}
          </div>
          <div className="px-2 py-2.5">
            <div className="flex items-center justify-center gap-1 text-orange-500 font-bold mb-0.5">
              <AlertTriangle className="h-3 w-3" />
              {isVi ? 'Chặng khó nhất' : 'Hardest Leg'}
            </div>
            {analysis.stats.worstDrop > 0 ? (
              <>
                <div className="font-black text-stone-900 text-[13px]">−{analysis.stats.worstDrop}</div>
                <div className="text-[10px] text-stone-400 truncate px-1">{analysis.stats.worstDropAt}</div>
              </>
            ) : (
              <div className="font-black text-stone-400 text-[13px]">—</div>
            )}
          </div>
        </div>
      )}

      {/* Insight text */}
      {analysis && (
        <div className="mx-5 mb-5 rounded-xl bg-blue-50/60 border border-blue-100/80 px-4 py-3 text-[12px] leading-relaxed text-stone-600">
          {isVi ? analysis.insight.vi : analysis.insight.en}
        </div>
      )}
    </div>
  );
}

export default RankProgressionChart;
