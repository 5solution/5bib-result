'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Menu, X, User, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslation();

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/calendar', label: t('nav.calendar') },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
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
                  className={`relative flex items-center px-5 text-sm font-semibold transition-colors duration-200 group/nav ${
                    isActive ? 'text-white' : 'text-blue-200 hover:text-white'
                  }`}
                >
                  {link.label}
                  <span className={`absolute bottom-0 left-0 h-[3px] bg-white transition-all duration-300 ${isActive ? 'w-full' : 'w-0 group-hover/nav:w-full'}`} />
                </Link>
              );
            })}
          </nav>

          {/* Language switcher — right side, before account tile */}
          <div className="hidden md:flex items-center ml-auto pr-1">
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

          {/* MY 5BIB — cyan accent tile, far right, angled left edge (like UTMB "MY UTMB") */}
          <Link
            href="/account"
            className="hidden md:flex items-center gap-2.5 shrink-0 bg-cyan-400 hover:bg-cyan-300 transition-colors duration-200 text-slate-900 font-bold text-sm select-none"
            style={{ width: 200, clipPath: 'polygon(14% 0%, 100% 0%, 100% 100%, 0% 100%)', paddingLeft: 36, paddingRight: 16 }}
          >
            <User className="w-5 h-5 shrink-0" strokeWidth={2.5} />
            <span className="tracking-wide uppercase text-xs font-extrabold leading-tight">MY 5BIB</span>
            <ChevronRight className="w-4 h-4 ml-auto shrink-0" strokeWidth={2.5} />
          </Link>

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
                    isActive ? 'text-white border-l-2 border-white' : 'text-blue-100 hover:text-white hover:border-l-2 hover:border-white/50'
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
