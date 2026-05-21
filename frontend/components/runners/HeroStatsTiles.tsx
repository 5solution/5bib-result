/**
 * Hero section: dark navy gradient + eyebrow + title + lede + 2×2 stat tile grid.
 * RSC. Renders real counts from /athletes-stats endpoint.
 */

import type { AthletesStats } from './types';

interface Props {
  stats: AthletesStats;
}

interface Tile {
  label: string;
  value: number;
}

function fmt(n: number): string {
  return n.toLocaleString('vi-VN');
}

export default function HeroStatsTiles({ stats }: Props) {
  const tiles: Tile[] = [
    { label: 'VĐV ACTIVE', value: stats.totalAthletes },
    { label: 'GIẢI', value: stats.totalRaces },
    { label: 'TỈNH', value: stats.totalProvinces },
    { label: 'CHIP TIMES', value: stats.totalChipTimes },
  ];

  return (
    <section
      className="relative overflow-hidden text-white"
      style={{
        background: 'linear-gradient(135deg, #1B2238 0%, #2A3354 100%)',
      }}
    >
      {/* Subtle topo-line texture overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 56px), repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 56px)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 md:px-8 pt-24 pb-20 md:pt-28 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* LEFT — title block */}
          <div className="lg:col-span-7">
            <div
              className="inline-flex items-center px-3 py-1 rounded-sm font-mono font-extrabold uppercase text-[10px] tracking-[0.22em] mb-5"
              style={{ background: '#FF0E65', color: '#fff' }}
            >
              5BIB · CỘNG ĐỒNG VĐV
            </div>
            <h1
              className="font-heading font-black uppercase m-0"
              style={{
                fontSize: 'clamp(48px, 7vw, 96px)',
                lineHeight: 0.92,
                letterSpacing: '-0.035em',
              }}
            >
              <span className="block">VẬN ĐỘNG VIÊN</span>
              <span
                className="block italic"
                style={{ color: '#ea580c', letterSpacing: '-0.04em' }}
              >
                5BIB
              </span>
            </h1>
            <p
              className="mt-6 font-body"
              style={{
                maxWidth: 560,
                fontSize: 17,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.78)',
              }}
            >
              Khám phá hồ sơ thi đấu của hơn{' '}
              <strong className="text-white">{fmt(stats.totalAthletes)}</strong>{' '}
              VĐV đã được 5BIB ghi nhận từ 2019 đến nay — trên{' '}
              <strong className="text-white">{stats.totalProvinces}</strong> tỉnh
              thành, <strong className="text-white">{fmt(stats.totalRaces)}</strong>{' '}
              giải chạy,{' '}
              <strong className="text-white">{fmt(stats.totalChipTimes)}</strong>{' '}
              chip times.
            </p>
          </div>

          {/* RIGHT — 2×2 white stat tiles */}
          <div className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {tiles.map((t) => (
                <div
                  key={t.label}
                  className="bg-white rounded-2xl p-5 md:p-6 text-stone-900"
                  style={{ boxShadow: 'var(--shadow-sm)' }}
                >
                  <div
                    className="font-heading font-black"
                    style={{
                      fontSize: 'clamp(28px, 3.4vw, 44px)',
                      lineHeight: 1,
                      letterSpacing: '-0.025em',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt(t.value)}
                  </div>
                  <div
                    className="font-mono font-bold uppercase text-[10px] tracking-[0.18em] text-stone-500 mt-2"
                  >
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent strip */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: 4,
          background:
            'linear-gradient(90deg, #ea580c 0%, #1d4ed8 50%, #FF0E65 100%)',
        }}
      />
    </section>
  );
}
