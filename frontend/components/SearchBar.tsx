'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 p-6 md:p-8 ${isFocused ? 'border-[#2563EB] scale-[1.01]' : 'border-gray-200'
        }`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex-1">
          <label htmlFor="search" className="block text-sm md:text-base font-black text-[#1E293B] mb-3 uppercase tracking-widest">
            🔍 BIB Search
          </label>
          <div className="relative">
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Enter BIB number or athlete name..."
              className="w-full px-12 md:px-14 py-4 md:py-5 text-base md:text-lg font-semibold border-2 border-gray-300 rounded-lg focus:outline-none search-glow focus:border-[#2563EB] transition-all duration-300"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <svg
              className="absolute left-4 md:left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 md:h-6 md:w-6 text-[#2563EB]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <button
            type="submit"
            className="flex-1 sm:flex-none bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-black py-4 md:py-5 px-6 md:px-8 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-lg text-sm md:text-base uppercase tracking-wider"
          >
            Search
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 sm:flex-none px-6 md:px-8 py-4 md:py-5 border-2 border-[#FF0E65] text-[#FF0E65] rounded-lg hover:bg-[#FF0E65] hover:text-white transition-all duration-300 font-black text-sm md:text-base uppercase tracking-wider"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
