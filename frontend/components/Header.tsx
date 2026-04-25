'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Menu, X, ChevronRight, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import WatchlistButton from '@/components/WatchlistButton';
import { useUser } from '@/lib/hooks/use-user';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslation();

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/calendar', label: t('nav.calendar') },
  ];

  if (pathname?.startsWith('/timing')) return null;

  return (
    <header data-site-header className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-blue-700">
        <div className="flex items-stretch h-14">

          {/* Logo — flush left */}
          <Link href="/" className="relative flex items-center group overflow-hidden px-5 shrink-0">
            <Image src="/logo_5BIB_white.png" alt="5BIB" width={120} height={36} className="h-9 w-auto" priority />
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          </Link>

          {/* Desktop Nav — centered */}
          <nav className="hidden md:flex items-stretch flex-1 justify-center">
            {navLinks.map((link) => {
              const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href.split('?')[0]);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center px-5 text-sm font-semibold transition-colors duration-200 group/nav ${isActive ? 'text-white' : 'text-blue-200 hover:text-white'
                    }`}
                >
                  {link.label}
                  <span className={`absolute bottom-0 left-0 h-[3px] bg-white transition-all duration-300 ${isActive ? 'w-full' : 'w-0 group-hover/nav:w-full'}`} />
                </Link>
              );
            })}
          </nav>

          {/* Watchlist + Language — right side, before account tile */}
          <div className="hidden md:flex items-center gap-1 ml-auto pr-2">
            <WatchlistButton variant="light" />
            <LanguageSwitcher />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center ml-auto px-4 text-blue-100 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* 5BIB Account tile — cyan accent, angled left edge */}
          <AccountTile />

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
                  className={`block px-4 py-3 text-sm font-semibold transition-all duration-200 ${isActive ? 'text-white border-l-2 border-white' : 'text-blue-100 hover:text-white hover:border-l-2 hover:border-white/50'
                    }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-1 pb-1">
              <LanguageSwitcher />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ─── Account tile — custom UserButton replacement ─── */

function AccountTile() {
  const { isAuthenticated, isLoading, displayName, imageUrl } = useUser();

  // Common cyan tile style
  const tileStyle = {
    width: 200,
    clipPath: 'polygon(14% 0%, 100% 0%, 100% 100%, 0% 100%)',
  } as React.CSSProperties;

  if (isLoading) {
    // Placeholder tile during session check
    return (
      <div
        className="hidden md:flex items-center shrink-0 bg-cyan-400/40 animate-pulse"
        style={tileStyle}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <a
        href="/api/logto/sign-in"
        className="hidden md:flex items-center gap-2.5 shrink-0 bg-cyan-400 hover:bg-cyan-300 transition-colors duration-200 text-slate-900 font-bold text-sm select-none"
        style={{ ...tileStyle, paddingLeft: 36, paddingRight: 16 }}
      >
        <span className="tracking-wide uppercase text-xs font-extrabold leading-tight">
          Đăng nhập / Sign in
        </span>
        <ChevronRight className="w-4 h-4 ml-auto shrink-0" strokeWidth={2.5} />
      </a>
    );
  }

  // Signed in — link to /account + compact avatar with sign-out affordance
  return (
    <div
      className="hidden md:flex items-center gap-2.5 shrink-0 bg-cyan-400 hover:bg-cyan-300 transition-colors duration-200 text-slate-900 font-bold text-sm select-none"
      style={{ ...tileStyle, paddingLeft: 32, paddingRight: 10 }}
    >
      <Link
        href="/account"
        className="flex-1 tracking-wide uppercase text-xs font-extrabold leading-tight hover:opacity-80 truncate"
        title={displayName ?? undefined}
      >
        {displayName ? displayName.split(' ')[0] : 'TÀI KHOẢN'}
      </Link>
      {imageUrl ? (
        <Link href="/account" className="shrink-0" aria-label="Tài khoản">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={displayName ?? 'avatar'}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-900/20"
          />
        </Link>
      ) : (
        <Link
          href="/account"
          className="w-8 h-8 shrink-0 rounded-full bg-slate-900/15 flex items-center justify-center text-slate-900 text-xs font-black"
        >
          {displayName?.[0]?.toUpperCase() ?? '?'}
        </Link>
      )}
      <a
        href="/api/logto/sign-out"
        className="shrink-0 p-1 rounded text-slate-900/70 hover:text-slate-900"
        title="Đăng xuất"
        aria-label="Đăng xuất"
      >
        <LogOut className="w-4 h-4" />
      </a>
    </div>
  );
}
