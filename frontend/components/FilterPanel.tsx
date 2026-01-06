'use client';

import { RaceResultsParams } from '@/lib/api';

interface FilterPanelProps {
  filters: RaceResultsParams;
  onFilterChange: (filters: Partial<RaceResultsParams>) => void;
  totalResults: number;
}

const DISTANCES = [
  { value: '', label: 'All Distances' },
  { value: '100km', label: '100km Ultra' },
  { value: '70km', label: '70km' },
  { value: '42km', label: 'Marathon (42km)' },
  { value: '25km', label: '25km' },
  { value: '10km', label: '10km' },
];

const GENDERS = [
  { value: '', label: 'All Genders' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];

export default function FilterPanel({ filters, onFilterChange, totalResults }: FilterPanelProps) {
  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow border border-gray-200 p-4 md:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {/* Distance Filter */}
          <div>
            <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1 md:mb-2 uppercase tracking-wide">
              Distance
            </label>
            <select
              value={filters.course_id || ''}
              onChange={(e) => onFilterChange({ course_id: e.target.value || undefined })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0000FF] transition-colors"
            >
              {DISTANCES.map((distance) => (
                <option key={distance.value} value={distance.value}>
                  {distance.label}
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1 md:mb-2 uppercase tracking-wide">
              Gender
            </label>
            <select
              value={filters.gender || ''}
              onChange={(e) => onFilterChange({ gender: e.target.value || undefined })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0000FF] transition-colors"
            >
              {GENDERS.map((gender) => (
                <option key={gender.value} value={gender.value}>
                  {gender.label}
                </option>
              ))}
            </select>
          </div>

          {/* Page Size */}
          <div>
            <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1 md:mb-2 uppercase tracking-wide">
              Per Page
            </label>
            <select
              value={filters.pageSize || 20}
              onChange={(e) => onFilterChange({ pageSize: Number(e.target.value) })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0000FF] transition-colors"
            >
              <option value={10}>10 results</option>
              <option value={20}>20 results</option>
              <option value={50}>50 results</option>
              <option value={100}>100 results</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-center lg:text-right">
          <div className="inline-block bg-gradient-to-r from-[#0000FF] to-blue-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg">
            <div className="text-xs md:text-sm font-bold uppercase tracking-wide">Total Athletes</div>
            <div className="text-2xl md:text-3xl font-black">{totalResults.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
