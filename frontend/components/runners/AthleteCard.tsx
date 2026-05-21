/**
 * Single athlete card. RSC, pure presentational.
 *
 * Layout per design:
 *   BIB · 5114                   [avatar 40px]
 *   NGHIÊM THỊ ANH THƯ
 *   [Nữ 30-39]  [Hà Nội]
 *   ─────────────────────────────────
 *   SỐ GIẢI · 4         BEST · [Trail 50K]
 */

import Link from 'next/link';

import {
  type AthleteSummary,
  SPECIALTY_LABEL,
  SPECIALTY_PILL_CLASS,
  getInitials,
} from './types';

interface Props {
  athlete: AthleteSummary;
}

function genderBadgeLabel(a: AthleteSummary): string | null {
  const g = a.gender === 'female' ? 'Nữ' : a.gender === 'male' ? 'Nam' : null;
  const ag = a.ageGroup && a.ageGroup.trim() !== '' ? a.ageGroup.trim() : null;
  if (g && ag) return `${g} ${ag}`;
  if (g) return g;
  return null;
}

export default function AthleteCard({ athlete: a }: Props) {
  const genderColor = a.gender === 'female' ? '#ea580c' : '#1d4ed8';
  const genderBadge = genderBadgeLabel(a);
  const nationality =
    a.nationality && a.nationality.trim() !== '' ? a.nationality.trim() : null;
  const specialtyKey = a.specialty;

  return (
    <Link
      href={`/runners/${a.slug}`}
      className="group block bg-white border border-stone-200 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-stone-300"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      {/* Top row: BIB + avatar */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className="font-mono font-bold text-[11px] uppercase tracking-[0.15em] text-stone-500"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          BIB · <span className="text-stone-900">{a.primaryBib}</span>
        </span>
        {a.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.avatarUrl}
            alt={a.canonicalName}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-stone-200 shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-heading font-black text-white text-[13px] shrink-0"
            style={{
              background: `linear-gradient(135deg, ${genderColor}, ${genderColor}cc)`,
            }}
          >
            {getInitials(a.canonicalName)}
          </div>
        )}
      </div>

      {/* Big athlete name */}
      <h3
        className="font-heading font-black uppercase text-stone-900 group-hover:text-blue-700 transition-colors mb-3 line-clamp-2"
        style={{
          fontSize: 17,
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          minHeight: 42,
        }}
        title={a.canonicalName}
      >
        {a.canonicalName}
      </h3>

      {/* Badge row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {genderBadge ? (
          <span
            className="inline-flex items-center px-2 py-1 rounded-md font-mono font-bold uppercase text-[10px] tracking-wider"
            style={{ background: '#FEF3C7', color: '#92400E' }}
          >
            {genderBadge}
          </span>
        ) : null}
        {nationality ? (
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-stone-100 text-stone-700 font-mono font-bold uppercase text-[10px] tracking-wider">
            {nationality}
          </span>
        ) : null}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-stone-100">
        <div>
          <div className="font-mono font-bold uppercase text-[9px] tracking-[0.18em] text-stone-400 mb-0.5">
            Số giải
          </div>
          <div
            className="font-heading font-black text-stone-900"
            style={{
              fontSize: 20,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {a.totalFinished}
            {a.totalRaces > a.totalFinished ? (
              <span className="text-stone-400 font-mono text-[12px] font-bold">
                /{a.totalRaces}
              </span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="font-mono font-bold uppercase text-[9px] tracking-[0.18em] text-stone-400 mb-0.5">
            Best
          </div>
          {specialtyKey ? (
            <span
              className={`inline-flex items-center px-2 py-1 rounded-md border font-mono font-bold uppercase text-[10px] tracking-wider ${SPECIALTY_PILL_CLASS[specialtyKey]}`}
            >
              {SPECIALTY_LABEL[specialtyKey]}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-stone-400">—</span>
          )}
        </div>
      </div>
    </Link>
  );
}
