/**
 * Filter sidebar — server-rendered HTML form submitting GET to /runners.
 * RSC, no client state. All filter state lives in URL search params.
 *
 * Sections: tỉnh thành / giới tính / AG bracket / specialty / số giải.
 * Submit button "Áp dụng (N)" + "Xoá tất cả" reset link.
 */

import Link from 'next/link';

import type { RunnersSearchParams } from './types';

interface Props {
  searchParams: RunnersSearchParams;
}

// MVP option lists — when /provinces aggregation endpoint exists, swap to dynamic.
const PROVINCES = [
  { value: 'ha-noi', label: 'Hà Nội' },
  { value: 'tphcm', label: 'TP.HCM' },
  { value: 'da-nang', label: 'Đà Nẵng' },
  { value: 'hue', label: 'Huế' },
];

const GENDERS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
];

const AGE_GROUPS = [
  { value: 'M20-29', label: 'Nam 20-29' },
  { value: 'M30-39', label: 'Nam 30-39' },
  { value: 'M40-49', label: 'Nam 40-49' },
  { value: 'F30-39', label: 'Nữ 30-39' },
];

const SPECIALTIES = [
  { value: 'road', label: 'Road' },
  { value: 'trail', label: 'Trail' },
  { value: 'ultra', label: 'Ultra 50K+' },
  { value: 'marathon', label: 'Marathon' },
];

/** Count active filters for "Áp dụng (N)" button label */
function countActiveFilters(sp: RunnersSearchParams): number {
  let n = 0;
  if (sp.province) n += sp.province.split(',').filter(Boolean).length;
  if (sp.gender) n += sp.gender.split(',').filter(Boolean).length;
  if (sp.ageGroup) n += sp.ageGroup.split(',').filter(Boolean).length;
  if (sp.specialty) n += sp.specialty.split(',').filter(Boolean).length;
  if (sp.minRaces || sp.maxRaces) n += 1;
  return n;
}

/** Check if a multi-value filter contains a given value */
function isChecked(val: string | undefined, target: string): boolean {
  if (!val) return false;
  return val.split(',').includes(target);
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="border-b border-stone-200 pb-5 mb-5 last:border-b-0 last:pb-0 last:mb-0">
      <h3 className="font-mono font-bold uppercase text-[11px] tracking-[0.18em] text-stone-500 mb-3">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface CheckboxProps {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}

function Checkbox({ name, value, label, defaultChecked }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="w-4 h-4 rounded border-stone-300 text-blue-700 focus:ring-2 focus:ring-blue-700 focus:ring-offset-0"
      />
      <span className="font-body text-[14px] text-stone-700 group-hover:text-stone-900">
        {label}
      </span>
    </label>
  );
}

export default function FilterSidebar({ searchParams }: Props) {
  const activeCount = countActiveFilters(searchParams);

  return (
    <aside className="w-full lg:w-[250px] shrink-0">
      <div className="lg:sticky lg:top-24">
        <form action="/runners" method="get" className="bg-white border border-stone-200 rounded-2xl p-5 md:p-6">
          {/* preserve letter + sort when applying filters */}
          {searchParams.letter ? (
            <input type="hidden" name="letter" value={searchParams.letter} />
          ) : null}
          {searchParams.sort ? (
            <input type="hidden" name="sort" value={searchParams.sort} />
          ) : null}
          {/* reset page=1 on apply */}
          <input type="hidden" name="page" value="1" />

          <div className="flex items-center gap-2 mb-5">
            <span aria-hidden className="text-stone-700">
              ⌄
            </span>
            <h2 className="font-heading font-black uppercase text-stone-900 text-[15px] tracking-tight">
              Lọc
            </h2>
          </div>

          <Section title="Tỉnh thành">
            {PROVINCES.map((p) => (
              <Checkbox
                key={p.value}
                name="province"
                value={p.value}
                label={p.label}
                defaultChecked={isChecked(searchParams.province, p.value)}
              />
            ))}
            <button
              type="button"
              className="font-mono text-[11px] uppercase tracking-wider text-blue-700 hover:text-blue-800 mt-2"
            >
              + xem thêm
            </button>
          </Section>

          <Section title="Giới tính">
            {GENDERS.map((g) => (
              <Checkbox
                key={g.value}
                name="gender"
                value={g.value}
                label={g.label}
                defaultChecked={isChecked(searchParams.gender, g.value)}
              />
            ))}
          </Section>

          <Section title="AG bracket">
            {AGE_GROUPS.map((a) => (
              <Checkbox
                key={a.value}
                name="ageGroup"
                value={a.value}
                label={a.label}
                defaultChecked={isChecked(searchParams.ageGroup, a.value)}
              />
            ))}
            <button
              type="button"
              className="font-mono text-[11px] uppercase tracking-wider text-blue-700 hover:text-blue-800 mt-2"
            >
              + 8 nữa
            </button>
          </Section>

          <Section title="Specialty">
            {SPECIALTIES.map((s) => (
              <Checkbox
                key={s.value}
                name="specialty"
                value={s.value}
                label={s.label}
                defaultChecked={isChecked(searchParams.specialty, s.value)}
              />
            ))}
          </Section>

          <Section title="Số giải đã hoàn thành">
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="minRaces"
                min={0}
                max={500}
                defaultValue={searchParams.minRaces || ''}
                placeholder="3"
                className="w-full px-3 py-2 border border-stone-300 rounded-md font-mono text-[13px] focus:border-blue-700 focus:ring-1 focus:ring-blue-700 outline-none"
              />
              <span className="font-mono text-stone-400">→</span>
              <input
                type="number"
                name="maxRaces"
                min={0}
                max={500}
                defaultValue={searchParams.maxRaces || ''}
                placeholder="30+"
                className="w-full px-3 py-2 border border-stone-300 rounded-md font-mono text-[13px] focus:border-blue-700 focus:ring-1 focus:ring-blue-700 outline-none"
              />
            </div>
            <p className="font-mono text-[10px] text-stone-400 mt-2">
              Giới hạn: 3+ → 30+ giải
            </p>
          </Section>

          <div className="mt-6 space-y-2">
            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-700 hover:bg-blue-800 text-white font-heading font-bold uppercase text-[13px] tracking-wider rounded-lg transition-colors"
            >
              Áp dụng{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
            <Link
              href="/runners"
              className="block w-full text-center px-4 py-2 text-stone-600 hover:text-stone-900 font-mono text-[12px] uppercase tracking-wider"
            >
              Xoá tất cả
            </Link>
          </div>
        </form>
      </div>
    </aside>
  );
}
