'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useSponsors } from '@/lib/api-hooks';

const navLinks = [
  { href: '/', label: 'Trang chủ' },
  { href: '/calendar', label: 'Lịch sự kiện' },
];

interface Sponsor {
  _id: string;
  name: string;
  logoUrl: string;
  website?: string;
  level: 'silver' | 'gold' | 'diamond';
  order: number;
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: sponsorsRaw } = useSponsors();

  const sponsors = useMemo(() => {
    const list: Sponsor[] = (sponsorsRaw as any)?.data ?? sponsorsRaw ?? [];
    if (!Array.isArray(list) || list.length === 0) return [];
    const priority: Record<string, number> = { diamond: 0, gold: 1, silver: 2 };
    return [...list].sort(
      (a, b) => (priority[a.level] ?? 9) - (priority[b.level] ?? 9) || a.order - b.order,
    );
  }, [sponsorsRaw]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Single row: Logo left — Nav + Sponsor right */}
      <div className="bg-blue-700">
        <div className="flex items-stretch h-14">
          {/* Logo — flush left */}
          <Link href="/" className="relative flex items-center gap-2.5 group overflow-hidden px-5 shrink-0">
            <div className="w-9 h-9 bg-white flex items-center justify-center font-black text-blue-700 text-sm tracking-tighter">
              5B
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[17px] font-black tracking-tight text-white">5BIB</span>
              <span className="text-[9px] font-semibold text-blue-200/70 tracking-[0.15em] uppercase">Race Results</span>
            </div>
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          </Link>

          {/* Desktop Nav — centered, underline hover */}
          <nav className="hidden md:flex items-stretch flex-1 justify-center">
            {navLinks.map((link) => {
              const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href.split('?')[0]);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center px-5 text-sm font-semibold transition-colors duration-200 group/nav ${
                    isActive ? 'text-white' : 'text-blue-200 hover:text-white'
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute bottom-0 left-0 h-[3px] bg-white transition-all duration-300 ${
                      isActive ? 'w-full' : 'w-0 group-hover/nav:w-full'
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden ml-auto px-4 text-blue-100 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sponsor trapezoid — absolute, top-right, extends below header */}
      {sponsors.length > 0 && (
        <div className="hidden md:block absolute top-0 right-0 z-50" style={{ height: 80 }}>
          <SponsorCarousel sponsors={sponsors} />
        </div>
      )}

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-blue-700 border-t border-blue-600">
          <nav className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href.split('?')[0]);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'text-white border-l-2 border-white'
                      : 'text-blue-100 hover:text-white hover:border-l-2 hover:border-white/50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

function SponsorCarousel({ sponsors }: { sponsors: Sponsor[] }) {
  const [current, setCurrent] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % sponsors.length);
  }, [sponsors.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + sponsors.length) % sponsors.length);
  }, [sponsors.length]);

  useEffect(() => {
    intervalRef.current = setInterval(next, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [next]);

  const pause = () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  const resume = () => { pause(); intervalRef.current = setInterval(next, 3000); };

  const onDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    pause();
  };
  const onUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const diff = e.clientX - startX;
    if (Math.abs(diff) > 30) { diff < 0 ? next() : prev(); }
    resume();
  };

  return (
    <div
      className="h-full cursor-grab active:cursor-grabbing select-none"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => { setIsDragging(false); resume(); }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div
        className="bg-white h-full flex items-center justify-center shadow-lg"
        style={{
          width: 220,
          clipPath: 'polygon(16% 0%, 100% 0%, 100% 100%, 0% 100%)',
          paddingLeft: 36,
        }}
      >
        <div className="relative w-full h-full overflow-hidden">
          {sponsors.map((s, i) => (
            <div
              key={s._id || s.name}
              className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                i === current ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
              }`}
            >
              {s.logoUrl ? (
                <img
                  src={s.logoUrl}
                  alt={s.name}
                  className="h-9 w-auto max-w-[140px] object-contain pointer-events-none"
                  draggable={false}
                />
              ) : (
                <span className="text-xs font-bold text-slate-500 tracking-wide">{s.name}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
