'use client';

/**
 * 90-day featured athletes carousel.
 * Client component — CSS scroll-snap + button onClick scrollTo (no external lib).
 * Shows 5 cards per slide, 2 dots for 10-item list, ← → arrow nav.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type AthleteSummary,
  type AthletesFeatured90d,
  getInitials,
  SPECIALTY_LABEL,
} from './types';

interface Props {
  featured: AthletesFeatured90d;
}

const CARDS_PER_SLIDE = 5;

export default function Featured90dCarousel({ featured }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const totalSlides = Math.max(1, Math.ceil(featured.items.length / CARDS_PER_SLIDE));

  const scrollTo = useCallback((idx: number) => {
    const t = trackRef.current;
    if (!t) return;
    const slot = t.children[idx * CARDS_PER_SLIDE] as HTMLElement | undefined;
    if (slot) {
      t.scrollTo({ left: slot.offsetLeft - t.offsetLeft, behavior: 'smooth' });
    }
  }, []);

  // Track scroll position → derive current slide index
  useEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const slotWidth = (t.scrollWidth / Math.max(1, t.children.length)) * CARDS_PER_SLIDE;
        const idx = Math.round(t.scrollLeft / Math.max(1, slotWidth));
        setSlideIdx(Math.max(0, Math.min(totalSlides - 1, idx)));
      });
    };
    t.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      t.removeEventListener('scroll', onScroll);
    };
  }, [totalSlides]);

  const onPrev = () => scrollTo(Math.max(0, slideIdx - 1));
  const onNext = () => scrollTo(Math.min(totalSlides - 1, slideIdx + 1));

  if (featured.items.length === 0) {
    return (
      <section className="bg-white py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <Header onPrev={onPrev} onNext={onNext} canPrev={false} canNext={false} />
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-10 text-center">
            <p className="font-body italic text-stone-500">
              Chưa có VĐV nổi bật 90 ngày qua — vài giải nữa sẽ thấy gương mặt
              top.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white py-14 md:py-20">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <Header
          onPrev={onPrev}
          onNext={onNext}
          canPrev={slideIdx > 0}
          canNext={slideIdx < totalSlides - 1}
        />

        <div
          ref={trackRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-2 px-2 py-2"
          style={{ scrollPaddingLeft: 8, scrollPaddingRight: 8 }}
        >
          {featured.items.map((a, i) => (
            <FeaturedCard key={a.slug} athlete={a} rank={i + 1} />
          ))}
        </div>

        {/* Dots */}
        {totalSlides > 1 ? (
          <div className="flex items-center justify-center gap-2 mt-6">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Đi tới slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === slideIdx
                    ? 'bg-blue-700 w-8'
                    : 'bg-stone-300 w-2 hover:bg-stone-400'
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface HeaderProps {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}

function Header({ onPrev, onNext, canPrev, canNext }: HeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4 mb-8 flex-wrap">
      <div className="flex-1 min-w-[280px]">
        <div className="font-mono font-bold uppercase text-[11px] tracking-[0.2em] text-orange-600 mb-2">
          Featured athletes · 90 ngày qua
        </div>
        <h2
          className="font-heading font-black uppercase text-stone-900"
          style={{
            fontSize: 'clamp(32px, 4vw, 56px)',
            lineHeight: 0.95,
            letterSpacing: '-0.025em',
          }}
        >
          VĐV nổi bật
        </h2>
        <p className="font-body text-stone-500 mt-3 max-w-2xl">
          Top 10 VĐV theo số race hoàn thành trong 90 ngày qua · cập nhật 1h/lần.
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/runners"
          className="hidden md:inline font-mono font-bold uppercase text-[12px] tracking-[0.15em] text-blue-700 hover:text-blue-800"
        >
          Xem tất cả VĐV →
        </Link>
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Slide trước"
          className="w-10 h-10 rounded-full border-2 border-stone-300 text-stone-700 hover:border-blue-700 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-heading font-black"
        >
          ←
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Slide sau"
          className="w-10 h-10 rounded-full border-2 border-stone-300 text-stone-700 hover:border-blue-700 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-heading font-black"
        >
          →
        </button>
      </div>
    </header>
  );
}

interface FeaturedCardProps {
  athlete: AthleteSummary;
  rank: number;
}

function FeaturedCard({ athlete: a, rank }: FeaturedCardProps) {
  const isTop1 = rank === 1;
  const genderColor = a.gender === 'female' ? '#ea580c' : '#1d4ed8';
  const subtitle = buildSubtitle(a, rank);

  return (
    <Link
      href={`/runners/${a.slug}`}
      className="group relative snap-start shrink-0 w-[calc((100%-4*1rem)/5)] min-w-[200px] max-w-[260px] bg-white border border-stone-200 rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-stone-300"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      {/* rank badge */}
      <div
        className={`absolute -top-2 -left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md font-mono font-extrabold text-[11px] uppercase tracking-wider ${
          isTop1
            ? 'bg-orange-500 text-white shadow-md'
            : 'bg-stone-900 text-white'
        }`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {isTop1 ? <span aria-hidden>🏆</span> : null}#{rank}
      </div>

      {/* avatar */}
      <div className="flex justify-center mt-2 mb-4">
        {a.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.avatarUrl}
            alt={a.canonicalName}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-stone-200"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center font-heading font-black text-white text-[24px]"
            style={{
              background: `linear-gradient(135deg, ${genderColor}, ${genderColor}cc)`,
            }}
          >
            {getInitials(a.canonicalName)}
          </div>
        )}
      </div>

      <div className="text-center mb-3">
        <div className="font-mono font-bold uppercase text-[10px] tracking-[0.15em] text-stone-500 mb-1">
          BIB · <span className="text-stone-900">{a.primaryBib}</span>
        </div>
        <h3
          className="font-heading font-black uppercase text-stone-900 group-hover:text-blue-700 transition-colors line-clamp-2"
          style={{ fontSize: 15, lineHeight: 1.2, letterSpacing: '-0.005em' }}
          title={a.canonicalName}
        >
          {a.canonicalName}
        </h3>
      </div>

      <div className="flex flex-col items-center gap-2">
        {a.specialty ? (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold uppercase text-[10px] tracking-wider"
            style={{ background: '#FEF3C7', color: '#92400E' }}
          >
            {SPECIALTY_LABEL[a.specialty]}
          </span>
        ) : null}
        <p className="font-body text-[12px] text-stone-500 text-center line-clamp-2">
          {subtitle}
        </p>
      </div>
    </Link>
  );
}

function buildSubtitle(a: AthleteSummary, rank: number): string {
  const races = a.totalFinished;
  if (rank === 1) return `+${races} giải · trong 90 ngày`;
  if (a.specialty === 'trail' || a.specialty === 'ultra')
    return `Active trail · ${races} giải`;
  if (a.nationality && a.nationality.trim() !== '')
    return `Cụ ${a.nationality.trim()} · ${races} giải`;
  return `${races} giải hoàn thành Q1/26`;
}
