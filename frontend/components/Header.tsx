'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, MapPin, Calendar } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Trang chủ' },
  { href: '/calendar', label: 'Lịch sự kiện' },
  { href: '/calendar?search=', label: 'Tìm VĐV' },
];

const sponsors = [
  { name: 'Suunto', logo: 'https://placehold.co/120x40/ffffff/333333?text=SUUNTO' },
  { name: 'Hoka', logo: 'https://placehold.co/120x40/ffffff/333333?text=HOKA' },
  { name: 'GU Energy', logo: 'https://placehold.co/120x40/ffffff/333333?text=GU+Energy' },
  { name: 'Garmin', logo: 'https://placehold.co/120x40/ffffff/333333?text=GARMIN' },
  { name: 'The North Face', logo: 'https://placehold.co/120x40/ffffff/333333?text=TNF' },
];

const mockUpcoming = [
  { name: 'Dalat Ultra Trail 2026', date: '28/03', location: 'Đà Lạt', live: true },
  { name: 'VnExpress Marathon Hà Nội', date: '12/04', location: 'Hà Nội', live: false },
  { name: 'Halong Bay Heritage Marathon', date: '26/04', location: 'Quảng Ninh', live: false },
  { name: 'Vietnam Mountain Marathon', date: '20/09', location: 'Sa Pa', live: false },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Main nav bar */}
      <div className="bg-blue-700 border-b border-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo — UTMB style with shine effect */}
            <Link href="/" className="relative flex items-center gap-2.5 group overflow-hidden px-3 py-1.5 -ml-3 rounded-lg">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center font-black text-blue-700 text-sm tracking-tighter transition-transform group-hover:scale-105 shadow-sm">
                5B
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[17px] font-black tracking-tight text-white">
                  5BIB
                </span>
                <span className="text-[9px] font-semibold text-blue-200/70 tracking-[0.15em] uppercase">
                  Race Results
                </span>
              </div>
              {/* Shine sweep on hover */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href.split('?')[0]);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'text-white bg-white/20'
                        : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-blue-100 hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Sponsor trapezoid — right corner, below nav */}
      <div className="hidden md:block absolute top-14 right-0 z-50">
        <SponsorCarousel />
      </div>

      {/* Upcoming events ticker */}
      <div className="bg-blue-800/90 backdrop-blur-sm border-b border-blue-700/50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 h-9 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider shrink-0">Sắp diễn ra</span>
            <div className="flex items-center gap-5">
              {mockUpcoming.map((event, i) => (
                <Link
                  key={i}
                  href="/calendar"
                  className="flex items-center gap-2 text-xs text-blue-100 hover:text-white transition-colors shrink-0"
                >
                  {event.live && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500 rounded text-[10px] font-bold text-white uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Live
                    </span>
                  )}
                  <span className="font-semibold">{event.name}</span>
                  <span className="text-blue-300/70">·</span>
                  <span className="flex items-center gap-0.5 text-blue-300">
                    <Calendar className="w-3 h-3" />
                    {event.date}
                  </span>
                  <span className="flex items-center gap-0.5 text-blue-300">
                    <MapPin className="w-3 h-3" />
                    {event.location}
                  </span>
                  {i < mockUpcoming.length - 1 && (
                    <span className="text-blue-600 ml-1">|</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
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
                  className={`block px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'text-white bg-white/20'
                      : 'text-blue-100 hover:text-white hover:bg-white/10'
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

function SponsorCarousel() {
  const [current, setCurrent] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % sponsors.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + sponsors.length) % sponsors.length);
  }, []);

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
      className="relative cursor-grab active:cursor-grabbing select-none"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={() => { setIsDragging(false); resume(); }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {/* Trapezoid shape: slanted left edge, flat right edge flush to screen */}
      <div
        className="bg-white shadow-lg flex items-center justify-center"
        style={{
          width: 160,
          height: 52,
          clipPath: 'polygon(20% 0%, 100% 0%, 100% 100%, 0% 100%)',
          paddingLeft: 24,
        }}
      >
        <div className="relative w-full h-full overflow-hidden">
          {sponsors.map((s, i) => (
            <div
              key={s.name}
              className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
                i === current
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-90'
              }`}
            >
              <img
                src={s.logo}
                alt={s.name}
                className="h-7 w-auto object-contain pointer-events-none"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
