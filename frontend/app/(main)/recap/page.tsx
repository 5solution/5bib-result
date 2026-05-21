/**
 * FEATURE-056 scope expansion 2026-05-21 — /recap/ index landing.
 *
 * Listing of all ended races với recap page available. Linked from main nav
 * "Recap" item. Server Component, ISR 1h cache. Order ended races by endDate DESC.
 *
 * Per Danny mandate "đừng có override" — raw race.title displayed as-is.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllRaces } from '@/lib/seo-api';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Race Recap — Tổng kết các giải chạy đã kết thúc | 5BIB',
  description:
    'Magazine recap mỗi giải chạy đã kết thúc — podium, phân bố pace, negative split, age group breakdown, editorial insight từ 5BIB.',
  alternates: { canonical: 'https://5bib.com/recap' },
  openGraph: {
    title: 'Race Recap | 5BIB',
    description: 'Tổng kết từng giải chạy với podium, pace và editorial insight.',
    url: 'https://5bib.com/recap',
    type: 'website',
  },
};

function formatVN(d: string | undefined | null): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${date.getFullYear()}`;
}

export default async function RecapIndexPage() {
  const allRaces = await getAllRaces();
  const endedRaces = allRaces
    .filter((r) => r.status === 'ended' && !!r.slug)
    .sort((a, b) => {
      const da = a.endDate ? new Date(a.endDate).getTime() : 0;
      const db = b.endDate ? new Date(b.endDate).getTime() : 0;
      return db - da;
    });

  return (
    <div className="bg-stone-50 min-h-screen">
      {/* ─── Header strip ─── */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          background: 'linear-gradient(135deg, #1B2238 0%, #2A3354 100%)',
          minHeight: 280,
        }}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8 pt-24 pb-12 md:pt-28 md:pb-16">
          <div
            className="inline-flex items-center px-3 py-1 rounded-sm font-mono font-extrabold uppercase text-[10px] tracking-[0.2em] mb-4"
            style={{ background: '#FF0E65', color: '#fff' }}
          >
            5BIB RECAP
          </div>
          <h1
            className="font-heading font-black uppercase m-0"
            style={{
              fontSize: 'clamp(32px, 5vw, 64px)',
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
            }}
          >
            Race{' '}
            <span style={{ color: '#FB923C', fontStyle: 'italic' }}>recap</span>
          </h1>
          <p
            className="mt-4 font-body italic"
            style={{ maxWidth: 600, fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.82)' }}
          >
            Tổng kết magazine cho mỗi giải chạy đã kết thúc — podium, phân bố
            pace, negative split, age group breakdown và editorial insight từ
            5BIB.
          </p>
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

      {/* ─── List ─── */}
      <main className="max-w-7xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <header className="mb-7 md:mb-9">
          <div className="font-mono font-bold uppercase text-[11px] tracking-[0.2em] text-stone-500 mb-2">
            01 · Đã kết thúc
          </div>
          <h2
            className="font-heading font-black uppercase m-0"
            style={{
              fontSize: 'clamp(22px, 2.8vw, 36px)',
              letterSpacing: '-0.02em',
            }}
          >
            {endedRaces.length.toLocaleString('vi-VN')} giải có recap
          </h2>
        </header>

        {endedRaces.length === 0 ? (
          <p className="text-stone-500 italic">
            Chưa có giải nào kết thúc. Quay lại sau.
          </p>
        ) : (
          <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {endedRaces.map((r) => {
              const bannerUrl = r.bannerUrl ?? r.imageUrl ?? null;
              return (
                <Link
                  key={r.slug}
                  href={`/giai-chay/${r.slug}/recap`}
                  className="group relative bg-white border border-stone-200 rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ boxShadow: 'var(--shadow-xs)' }}
                >
                  {/* Banner */}
                  <div
                    className="relative w-full aspect-[16/9] overflow-hidden"
                    style={{
                      background: bannerUrl
                        ? undefined
                        : 'linear-gradient(135deg, #1B2238, #2A3354)',
                    }}
                  >
                    {bannerUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bannerUrl}
                        alt={r.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(11,27,59,0.15) 0%, rgba(11,27,59,0.7) 100%)',
                      }}
                    />
                    <div
                      className="absolute top-3 left-3 inline-flex items-center px-2 py-0.5 rounded-sm font-mono font-extrabold uppercase text-[9px] tracking-[0.18em]"
                      style={{ background: '#FF0E65', color: '#fff' }}
                    >
                      RECAP
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 md:p-5">
                    <div
                      className="font-mono font-semibold uppercase text-[10px] tracking-[0.16em] text-stone-500"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatVN(r.endDate)}
                      {r.location ? ` · ${r.location}` : ''}
                    </div>
                    <h3
                      className="font-heading font-bold mt-1.5 text-stone-900 group-hover:text-blue-700 transition-colors"
                      style={{
                        fontSize: 17,
                        lineHeight: 1.25,
                        letterSpacing: '-0.01em',
                        overflowWrap: 'break-word',
                      }}
                      title={r.title}
                    >
                      {r.title}
                    </h3>
                    <div className="mt-3 font-mono font-bold uppercase text-[11px] tracking-wider text-blue-700 inline-flex items-center gap-1">
                      Xem recap
                      <span aria-hidden>→</span>
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
