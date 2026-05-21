/**
 * FEATURE-056 scope expansion 2026-05-21 — /runners/ index landing page.
 *
 * Public discover page for athletes. Linked from main nav "VĐV" item.
 * Server Component, ISR 30min cache. Lists 60 most-recently active athletes
 * sorted by lastRaceDate DESC.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const revalidate = 1800;

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

export const metadata: Metadata = {
  title: 'Vận động viên — Profile & thành tích | 5BIB',
  description:
    'Khám phá profile các vận động viên Việt Nam — thành tích Personal Records, lịch sử race, badge thành tựu. Cập nhật từ giải chạy chính thức.',
  alternates: { canonical: 'https://5bib.com/runners' },
  openGraph: {
    title: 'Vận động viên 5BIB',
    description: 'Profile + thành tích VĐV trên các giải chạy Việt Nam.',
    url: 'https://5bib.com/runners',
    type: 'website',
  },
};

interface AthleteSummary {
  slug: string;
  canonicalName: string;
  primaryBib: string;
  gender?: 'male' | 'female' | 'other' | null;
  nationality?: string;
  totalRaces: number;
  totalFinished: number;
  lastRaceDate?: string;
  avatarUrl?: string;
}

async function getAthletes(): Promise<AthleteSummary[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/race-results/athletes`, {
      next: {
        revalidate: 1800,
        tags: ['runners:index'],
      },
    });
    if (!res.ok) return [];
    return (await res.json()) as AthleteSummary[];
  } catch {
    return [];
  }
}

function formatVN(d?: string): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${date.getFullYear()}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (
    (parts[0][0]?.toUpperCase() ?? '') +
    (parts[parts.length - 1][0]?.toUpperCase() ?? '')
  );
}

export default async function RunnersIndexPage() {
  const athletes = await getAthletes();

  return (
    <div className="bg-stone-50 min-h-screen">
      {/* ─── Header strip ─── */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
          minHeight: 280,
        }}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8 pt-24 pb-12 md:pt-28 md:pb-16">
          <div
            className="inline-flex items-center px-3 py-1 rounded-sm font-mono font-extrabold uppercase text-[10px] tracking-[0.2em] mb-4"
            style={{ background: '#FF0E65', color: '#fff' }}
          >
            5BIB ATHLETES
          </div>
          <h1
            className="font-heading font-black uppercase m-0"
            style={{
              fontSize: 'clamp(32px, 5vw, 64px)',
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
            }}
          >
            Vận động{' '}
            <span style={{ color: '#FB923C', fontStyle: 'italic' }}>viên</span>
          </h1>
          <p
            className="mt-4 font-body italic"
            style={{
              maxWidth: 600,
              fontSize: 16,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.82)',
            }}
          >
            Khám phá profile các vận động viên Việt Nam — thành tích Personal
            Records, lịch sử race và badge thành tựu.
          </p>

          {/* Quick action: search link */}
          <div className="mt-6">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-blue-700 font-body font-bold text-[13px] hover:bg-stone-100 transition-colors"
            >
              <span aria-hidden>🔎</span>
              Tìm theo BIB / tên VĐV
            </Link>
          </div>
        </div>
        {/* Accent strip */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: 6,
            background:
              'linear-gradient(90deg, var(--5bib-energy, #ea580c), #1d4ed8 60%, #FB923C)',
          }}
        />
      </section>

      {/* ─── Grid ─── */}
      <main className="max-w-7xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <header className="mb-7 md:mb-9">
          <div className="font-mono font-bold uppercase text-[11px] tracking-[0.2em] text-stone-500 mb-2">
            01 · Hoạt động gần nhất
          </div>
          <h2
            className="font-heading font-black uppercase m-0"
            style={{
              fontSize: 'clamp(22px, 2.8vw, 36px)',
              letterSpacing: '-0.02em',
            }}
          >
            {athletes.length.toLocaleString('vi-VN')} VĐV gần đây
          </h2>
        </header>

        {athletes.length === 0 ? (
          <p className="text-stone-500 italic">
            Chưa có dữ liệu VĐV. Quay lại sau khi giải chạy đầu tiên kết thúc.
          </p>
        ) : (
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {athletes.map((a) => {
              const genderLabel =
                a.gender === 'female'
                  ? 'Nữ'
                  : a.gender === 'male'
                    ? 'Nam'
                    : null;
              const genderColor =
                a.gender === 'female' ? '#ea580c' : '#1d4ed8';
              return (
                <Link
                  key={a.slug}
                  href={`/runners/${a.slug}`}
                  className="group relative bg-white border border-stone-200 rounded-2xl overflow-hidden p-4 md:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ boxShadow: 'var(--shadow-xs)' }}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar circle */}
                    {a.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.avatarUrl}
                        alt={a.canonicalName}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-stone-200"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center font-heading font-black text-white text-[18px] shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${genderColor}, ${genderColor}cc)`,
                        }}
                      >
                        {getInitials(a.canonicalName)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="font-mono font-bold text-[10px] uppercase tracking-wider text-stone-500"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          BIB {a.primaryBib}
                        </span>
                        {genderLabel ? (
                          <span
                            className="font-mono font-bold text-[10px] uppercase tracking-wider"
                            style={{ color: genderColor }}
                          >
                            · {genderLabel}
                          </span>
                        ) : null}
                      </div>
                      <h3
                        className="font-heading font-bold text-stone-900 group-hover:text-blue-700 transition-colors truncate"
                        style={{
                          fontSize: 16,
                          lineHeight: 1.25,
                          letterSpacing: '-0.005em',
                        }}
                        title={a.canonicalName}
                      >
                        {a.canonicalName}
                      </h3>
                      <div
                        className="font-mono text-[11px] text-stone-500 mt-1"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        <strong className="text-stone-900">
                          {a.totalFinished}
                        </strong>
                        /{a.totalRaces} giải · cuối {formatVN(a.lastRaceDate)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
