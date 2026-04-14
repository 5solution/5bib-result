'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSponsors } from '@/lib/api-hooks';
import LanguageSwitcher from '@/components/LanguageSwitcher';

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
  const { t } = useTranslation();
  const { data: sponsorsRaw } = useSponsors();

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/calendar', label: t('nav.calendar') },
  ];

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
          <Link href="/" className="relative flex items-center group overflow-hidden px-5 shrink-0">
            <Image src="/logo_5BIB_white.png" alt="5BIB" width={120} height={36} className="h-9 w-auto" priority />
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

          {/* Language + Mobile menu */}
          <div className="flex items-center ml-auto">
            <LanguageSwitcher />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden px-3 text-blue-100 hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Sponsor tile — far right, full-height card, desktop only */}
          {sponsors.length > 0 && (
            <div className="hidden md:flex items-stretch self-stretch shrink-0">
              <SponsorCarousel sponsors={sponsors} />
            </div>
          )}
        </div>
      </div>

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

  const sponsor = sponsors[current];

  return (
    <div
      className="relative flex items-center bg-white cursor-grab active:cursor-grabbing select-none overflow-hidden"
      style={{ width: 180, clipPath: 'polygon(12% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => { setIsDragging(false); resume(); }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {/* Slide area */}
      <div className="relative w-full h-full overflow-hidden" style={{ paddingLeft: 28 }}>
        {sponsors.map((s, i) => (
          <div
            key={s._id || s.name}
            className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
              i === current ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            {s.logoUrl ? (
              <img
                src={s.logoUrl}
                alt={s.name}
                className="h-8 w-auto max-w-[120px] object-contain pointer-events-none"
                draggable={false}
              />
            ) : (
              <span className="text-xs font-bold text-slate-700 tracking-wide px-2">{s.name}</span>
            )}
          </div>
        ))}
      </div>

      {/* Dot indicators — only if multiple sponsors */}
      {sponsors.length > 1 && (
        <div className="absolute bottom-1.5 right-2 flex gap-1">
          {sponsors.map((_, i) => (
            <span
              key={i}
              className={`block rounded-full transition-all duration-300 ${
                i === current ? 'w-3 h-1 bg-blue-600' : 'w-1 h-1 bg-slate-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
