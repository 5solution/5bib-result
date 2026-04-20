'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';

type ViewMode = 'sport' | 'model';

export default function LandingPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ViewMode>('sport');

  const isSportMode = mode === 'sport';

  return (
    <div className={`min-h-screen transition-all duration-500 ${isSportMode
      ? 'bg-gradient-to-br from-[#FF0E65] via-[#2563EB] to-[#1E293B]'
      : 'bg-gradient-to-br from-[#F8FAFC] via-[#FFFFFF] to-[#2563EB]/10'
      }`}>
      {/* Mode Switcher & Language */}
      <div className="fixed top-6 right-6 z-50 flex gap-4">
        <div className="flex gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20">
          <button
            onClick={() => setMode('sport')}
            className={`px-4 py-2 rounded-md text-sm font-black uppercase tracking-wider transition-all duration-300 ${isSportMode
              ? 'bg-[#FF0E65] text-white shadow-lg'
              : 'text-white/70 hover:text-white'
              }`}
          >
            Sport
          </button>
          <button
            onClick={() => setMode('model')}
            className={`px-4 py-2 rounded-md text-sm font-black uppercase tracking-wider transition-all duration-300 ${!isSportMode
              ? 'bg-[#2563EB] text-white shadow-lg'
              : 'text-white/70 hover:text-white'
              }`}
          >
            Model
          </button>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 md:px-6 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse ${isSportMode ? 'bg-[#FF0E65] top-20 left-20' : 'bg-[#2563EB] top-40 right-20'
            }`} />
          <div className={`absolute w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse delay-1000 ${isSportMode ? 'bg-[#2563EB] bottom-20 right-20' : 'bg-[#FF0E65] bottom-40 left-20'
            }`} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto text-center">
          {/* Main Heading */}
          <h1 className={`text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter mb-6 transition-all duration-500 ${isSportMode
            ? 'text-white drop-shadow-2xl'
            : 'text-[#1E293B]'
            }`}>
            <span className={`inline-block ${isSportMode ? 'animate-bounce' : ''}`}>5BIB</span>
            <br />
            <span className={`${isSportMode ? 'text-[#FF0E65]' : 'text-[#2563EB]'}`}>
              Race Results
            </span>
          </h1>

          {/* Subtitle */}
          <p className={`text-xl md:text-2xl lg:text-3xl font-semibold mb-12 max-w-3xl mx-auto transition-all duration-500 ${isSportMode
            ? 'text-white/90'
            : 'text-[#1E293B]/70'
            }`}>
            {t('header.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center">
            <Link href="/">
              <button className={`group relative px-8 md:px-12 py-4 md:py-6 text-lg md:text-xl font-black uppercase tracking-wider rounded-lg transition-all duration-300 overflow-hidden ${isSportMode
                ? 'bg-[#FF0E65] text-white hover:bg-[#FF0E65]/90 shadow-2xl hover:shadow-[#FF0E65]/50'
                : 'bg-[#2563EB] text-white hover:bg-[#2563EB]/90 shadow-2xl hover:shadow-[#2563EB]/50'
                }`}>
                <span className="relative z-10 flex items-center gap-2">
                  {t('common.search')} Results
                  <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
            </Link>

            <button className={`px-8 md:px-12 py-4 md:py-6 text-lg md:text-xl font-black uppercase tracking-wider rounded-lg border-4 transition-all duration-300 hover:scale-105 ${isSportMode
              ? 'border-white text-white hover:bg-white hover:text-[#FF0E65]'
              : 'border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB] hover:text-white'
              }`}>
              Live Leaderboard
            </button>
          </div>

          {/* Stats Bar */}
          <div className="mt-16 md:mt-24 grid grid-cols-3 gap-4 md:gap-8 max-w-4xl mx-auto">
            {[
              { value: '100K+', label: 'Athletes' },
              { value: '500+', label: 'Races' },
              { value: 'Live', label: 'Real-time' },
            ].map((stat, index) => (
              <div
                key={index}
                className={`group p-6 md:p-8 rounded-xl transition-all duration-300 hover:scale-105 cursor-pointer ${isSportMode
                  ? 'bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20'
                  : 'bg-white backdrop-blur-md border-2 border-gray-200 hover:border-[#2563EB] shadow-lg hover:shadow-2xl'
                  }`}
              >
                <div className={`text-3xl md:text-5xl font-black mb-2 ${isSportMode ? 'text-white' : 'text-[#2563EB]'
                  }`}>
                  {stat.value}
                </div>
                <div className={`text-sm md:text-base font-semibold uppercase tracking-widest ${isSportMode ? 'text-white/80' : 'text-[#1E293B]/60'
                  }`}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`py-20 md:py-32 px-4 md:px-6 ${isSportMode ? 'bg-[#1E293B]/30 backdrop-blur-sm' : 'bg-white/50 backdrop-blur-sm'
        }`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-4xl md:text-6xl font-black uppercase text-center mb-16 md:mb-24 ${isSportMode ? 'text-white' : 'text-[#1E293B]'
            }`}>
            Why Choose 5BIB
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: '🏃',
                title: 'Real-Time Results',
                description: 'Get instant access to live race results and leaderboards as athletes cross the finish line.',
              },
              {
                icon: '🔍',
                title: 'BIB Search',
                description: 'Quickly find any athlete\'s performance by their BIB number with our lightning-fast search.',
              },
              {
                icon: '📊',
                title: 'Advanced Filters',
                description: 'Filter by distance, gender, age group, and more to find exactly what you\'re looking for.',
              },
              {
                icon: '🏆',
                title: 'Global Leaderboard',
                description: 'Track top performers across all races and distances with our comprehensive rankings.',
              },
              {
                icon: '📱',
                title: 'Mobile Ready',
                description: 'Access results on any device with our fully responsive, mobile-optimized platform.',
              },
              {
                icon: '🌍',
                title: 'Multi-Language',
                description: 'Switch between Vietnamese and English with full translation support.',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className={`group p-6 md:p-8 rounded-xl transition-all duration-300 hover:scale-105 cursor-pointer ${isSportMode
                  ? 'bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:border-[#FF0E65]'
                  : 'bg-white backdrop-blur-md border-2 border-gray-200 hover:border-[#2563EB] shadow-lg hover:shadow-2xl'
                  }`}
              >
                <div className="text-5xl md:text-6xl mb-4">{feature.icon}</div>
                <h3 className={`text-xl md:text-2xl font-black uppercase mb-3 ${isSportMode ? 'text-white' : 'text-[#1E293B]'
                  }`}>
                  {feature.title}
                </h3>
                <p className={`text-sm md:text-base leading-relaxed ${isSportMode ? 'text-white/80' : 'text-[#1E293B]/70'
                  }`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 md:py-32 px-4 md:px-6 ${isSportMode
        ? 'bg-gradient-to-r from-[#FF0E65] to-[#2563EB]'
        : 'bg-gradient-to-r from-[#2563EB] to-[#1E293B]'
        }`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-black uppercase text-white mb-6">
            Ready to Check Your Results?
          </h2>
          <p className="text-xl md:text-2xl text-white/90 mb-12">
            Join thousands of athletes tracking their performance on 5BIB
          </p>
          <Link href="/">
            <button className="group px-12 md:px-16 py-5 md:py-7 text-xl md:text-2xl font-black uppercase tracking-wider bg-white text-[#1E293B] rounded-lg hover:bg-white/90 transition-all duration-300 shadow-2xl hover:shadow-white/50 hover:scale-105">
              <span className="flex items-center gap-3">
                Start Searching
                <svg className="w-7 h-7 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
