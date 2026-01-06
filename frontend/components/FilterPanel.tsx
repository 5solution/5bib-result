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
    <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-gray-200 p-5 md:p-7">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {/* Distance Filter */}
          <div>
            <label className="block text-xs md:text-sm font-black text-[#1E293B] mb-2 md:mb-3 uppercase tracking-widest">
              Distance
            </label>
            <select
              value={filters.course_id || ''}
              onChange={(e) => onFilterChange({ course_id: e.target.value || undefined })}
              className="w-full px-4 md:px-5 py-3 md:py-4 text-sm md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#2563EB] transition-all duration-300 font-semibold text-[#1E293B] bg-[#F8FAFC] hover:bg-white cursor-pointer"
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
            <label className="block text-xs md:text-sm font-black text-[#1E293B] mb-2 md:mb-3 uppercase tracking-widest">
              Gender
            </label>
            <select
              value={filters.gender || ''}
              onChange={(e) => onFilterChange({ gender: e.target.value || undefined })}
              className="w-full px-4 md:px-5 py-3 md:py-4 text-sm md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#2563EB] transition-all duration-300 font-semibold text-[#1E293B] bg-[#F8FAFC] hover:bg-white cursor-pointer"
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
            <label className="block text-xs md:text-sm font-black text-[#1E293B] mb-2 md:mb-3 uppercase tracking-widest">
              Per Page
            </label>
            <select
              value={filters.pageSize || 20}
              onChange={(e) => onFilterChange({ pageSize: Number(e.target.value) })}
              className="w-full px-4 md:px-5 py-3 md:py-4 text-sm md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#2563EB] transition-all duration-300 font-semibold text-[#1E293B] bg-[#F8FAFC] hover:bg-white cursor-pointer"
            >
              <option value={10}>10 results</option>
              <option value={20}>20 results</option>
              <option value={50}>50 results</option>
              <option value={100}>100 results</option>
            </select>
          </div>
        </div>

        {/* Results Count */}

      </div>
    </div>
  );
}
