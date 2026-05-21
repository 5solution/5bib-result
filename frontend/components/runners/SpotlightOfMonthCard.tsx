/**
 * Section: VĐV của tháng. Two-column block — big spotlight card LEFT (dark
 * navy + topo overlay), 5-item top-5 sidebar list RIGHT.
 *
 * Empty-state ready: when spotlight.topOne is null + topFive empty, renders
 * "Chưa có dữ liệu tháng này" placeholder.
 */

import Link from 'next/link';

import {
  type AthletesSpotlight,
  formatMonthVN,
  getInitials,
  SPECIALTY_LABEL,
} from './types';

interface Props {
  spotlight: AthletesSpotlight;
}

export default function SpotlightOfMonthCard({ spotlight }: Props) {
  const { topOne, topFive, month } = spotlight;
  const monthVN = formatMonthVN(month);

  if (!topOne && topFive.length === 0) {
    return (
      <section className="bg-stone-50 py-14 md:py-20 border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="font-mono font-bold uppercase text-[11px] tracking-[0.2em] text-orange-600 mb-2">
            VĐV của tháng
          </div>
          <h2 className="font-heading font-black uppercase text-stone-900 text-[28px] md:text-[40px] tracking-tight mb-6">
            VĐV nổi bật · {monthVN}
          </h2>
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <p className="font-body italic text-stone-500">
              Chưa có dữ liệu tháng này — vài giải nữa sẽ thấy đề cử.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-stone-50 py-14 md:py-20 border-y border-stone-200">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="font-mono font-bold uppercase text-[11px] tracking-[0.2em] text-orange-600 mb-2">
          VĐV của tháng
        </div>
        <h2 className="font-heading font-black uppercase text-stone-900 text-[28px] md:text-[40px] tracking-tight mb-8">
          VĐV nổi bật · {monthVN}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — big spotlight card */}
          {topOne ? <BigSpotlight athlete={topOne} /> : <SpotlightPlaceholder />}

          {/* RIGHT — top 2-6 list */}
          <div className="flex flex-col gap-3">
            {topFive.slice(0, 5).map((a, i) => (
              <SidebarItem key={a.slug} athlete={a} rank={i + 2} />
            ))}
            {topFive.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center text-stone-400 font-mono text-[12px]">
                Chưa có top 5 tháng này
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function BigSpotlight({ athlete: a }: { athlete: NonNullable<AthletesSpotlight['topOne']> }) {
  const ag = a.ageGroup && a.ageGroup.trim() !== '' ? a.ageGroup.trim() : null;
  const nationality =
    a.nationality && a.nationality.trim() !== '' ? a.nationality.trim() : null;

  return (
    <Link
      href={`/runners/${a.slug}`}
      className="relative overflow-hidden rounded-3xl p-7 md:p-9 text-white block group"
      style={{
        background: 'linear-gradient(135deg, #1B2238 0%, #2A3354 100%)',
      }}
    >
      {/* topo overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.6) 0, transparent 50%), repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 36px)',
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-5">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-sm font-mono font-extrabold uppercase text-[10px] tracking-[0.2em]"
            style={{ background: '#FF0E65', color: '#fff' }}
          >
            Spotlight · Người của tháng
          </span>
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm font-mono font-extrabold uppercase text-[10px] tracking-[0.2em]"
            style={{ background: '#ea580c', color: '#fff' }}
          >
            ★ Top #1
          </span>
        </div>

        <div className="flex items-center gap-5 mb-5">
          {a.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.avatarUrl}
              alt={a.canonicalName}
              className="w-20 h-20 rounded-full object-cover shrink-0"
              style={{ boxShadow: '0 0 0 4px #ea580c' }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-heading font-black text-white text-[26px] shrink-0"
              style={{
                background: 'linear-gradient(135deg, #ea580c, #c2410c)',
                boxShadow: '0 0 0 4px rgba(234,88,12,0.3)',
              }}
            >
              {getInitials(a.canonicalName)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-mono font-bold text-[11px] uppercase tracking-[0.18em] text-white/60 mb-1">
              BIB · <span className="text-white">{a.primaryBib}</span>
            </div>
            <h3
              className="font-heading font-black uppercase group-hover:text-orange-300 transition-colors"
              style={{
                fontSize: 'clamp(26px, 3vw, 36px)',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
              }}
            >
              {a.canonicalName}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {ag ? (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-md font-mono font-bold uppercase text-[10px] tracking-wider"
              style={{ background: '#FEF3C7', color: '#92400E' }}
            >
              {a.gender === 'female' ? 'Nữ' : 'Nam'} {ag}
            </span>
          ) : null}
          {nationality ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/15 text-white font-mono font-bold uppercase text-[10px] tracking-wider backdrop-blur-sm">
              {nationality}
            </span>
          ) : null}
          {a.specialty ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-orange-500/30 text-orange-100 font-mono font-bold uppercase text-[10px] tracking-wider border border-orange-300/30">
              {SPECIALTY_LABEL[a.specialty]}
            </span>
          ) : null}
        </div>

        <p
          className="font-body italic text-white/80 mb-6"
          style={{ fontSize: 14, lineHeight: 1.55 }}
        >
          “Chạy {a.totalFinished} giải, tích luỹ kỷ niệm khắp Việt Nam. Hồ sơ đầy
          đặn — luôn là cảm hứng cho cộng đồng VĐV 5BIB.”
        </p>

        <div className="grid grid-cols-3 gap-3 pt-5 border-t border-white/15">
          <Stat label="Giải hoàn thành" value={a.totalFinished} />
          <Stat label="Race tham gia" value={a.totalRaces} />
          <Stat
            label="Specialty"
            valueText={a.specialty ? SPECIALTY_LABEL[a.specialty] : '—'}
          />
        </div>
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  valueText,
}: {
  label: string;
  value?: number;
  valueText?: string;
}) {
  return (
    <div>
      <div
        className="font-heading font-black text-white"
        style={{
          fontSize: 22,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valueText ?? (value ?? 0).toLocaleString('vi-VN')}
      </div>
      <div className="font-mono font-bold uppercase text-[9px] tracking-[0.18em] text-white/60 mt-1">
        {label}
      </div>
    </div>
  );
}

function SpotlightPlaceholder() {
  return (
    <div
      className="rounded-3xl p-10 text-center flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1B2238 0%, #2A3354 100%)',
        minHeight: 380,
      }}
    >
      <p className="font-body italic text-white/60">
        Chưa có VĐV của tháng — đề cử sẽ xuất hiện khi đủ dữ liệu race.
      </p>
    </div>
  );
}

function SidebarItem({ athlete: a, rank }: { athlete: NonNullable<AthletesSpotlight['topOne']>; rank: number }) {
  return (
    <Link
      href={`/runners/${a.slug}`}
      className="group bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4 transition-all hover:border-stone-300 hover:shadow-md"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-heading font-black text-stone-900 text-[13px] shrink-0 border border-stone-200 bg-stone-50"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        #{rank}
      </div>
      {a.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.avatarUrl}
          alt={a.canonicalName}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-stone-200 shrink-0"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-heading font-black text-white text-[12px] shrink-0"
          style={{
            background:
              a.gender === 'female'
                ? 'linear-gradient(135deg, #ea580c, #c2410c)'
                : 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
          }}
        >
          {getInitials(a.canonicalName)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-mono font-bold uppercase text-[10px] tracking-[0.15em] text-stone-500">
          BIB · <span className="text-stone-900">{a.primaryBib}</span>
        </div>
        <div
          className="font-heading font-black uppercase text-stone-900 group-hover:text-blue-700 truncate"
          style={{ fontSize: 14, letterSpacing: '-0.005em' }}
        >
          {a.canonicalName}
        </div>
      </div>
      <span
        className="inline-flex items-center px-2 py-1 rounded-md bg-stone-100 text-stone-700 font-mono font-bold text-[10px] uppercase tracking-wider shrink-0"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {a.totalFinished} giải
      </span>
    </Link>
  );
}
