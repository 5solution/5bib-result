'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow border border-gray-200 p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex-1">
          <label htmlFor="search" className="block text-xs md:text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
            Search by Name or BIB Number
          </label>
          <div className="relative">
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter athlete name or BIB number..."
              className="w-full px-10 md:px-12 py-2 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0000FF] transition-colors"
            />
            <svg
              className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <button
            type="submit"
            className="flex-1 sm:flex-none bg-[#0000FF] hover:bg-blue-700 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg text-sm md:text-base whitespace-nowrap"
          >
            🔍 Search
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 sm:flex-none px-4 md:px-6 py-2 md:py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-bold text-sm md:text-base"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
