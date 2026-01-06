'use client';

import { RaceResult } from '@/lib/api';

interface ResultsTableProps {
  results: RaceResult[];
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const formatRank = (rank: string) => {
    if (rank === '-1' || rank === null || rank === undefined) {
      return '🏃';
    }
    return rank;
  };

  const getRankBadgeColor = (rank: string) => {
    if (rank === '-1' || rank === null || rank === undefined) {
      return 'bg-gradient-to-br from-orange-500 to-orange-700'; // Racing/In Progress
    }
    const numRank = parseInt(rank);
    if (isNaN(numRank)) return 'bg-gray-500'; // DSQ, DNF, etc.
    if (numRank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600';
    if (numRank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500';
    if (numRank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-600';
    return 'bg-[#2563EB]';
  };

  const getGenderBadgeColor = (gender: string) => {
    return gender === 'Male' ? 'bg-[#2563EB]' : 'bg-[#FF0E65]';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-gray-200 overflow-hidden">
      {/* Mobile Card View */}
      <div className="block md:hidden">
        {results.map((result, index) => (
          <div
            key={`${result.race_id}-${result.Bib}`}
            className={`border-b border-gray-200 p-5 lift-effect ${
              index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              {/* Rank Badge */}
              <span
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${getRankBadgeColor(result.OverallRank)} text-white font-black text-lg shadow-md flex-shrink-0`}
              >
                {formatRank(result.OverallRank)}
              </span>

              <div className="flex-1 min-w-0">
                {/* BIB Number */}
                <div className="text-xl font-black text-[#2563EB] mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
                  #{result.Bib}
                </div>
                {/* Athlete Name */}
                <div className="font-bold text-[#1E293B] truncate">{result.Name}</div>
                {result.Nationality && (
                  <div className="text-xs text-gray-500">
                    {result.Nation && <span>{result.Nation} </span>}
                    <span>{result.Nationality}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Gender:</span>
                <div>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-bold text-white rounded-full ${getGenderBadgeColor(result.Gender)}`}>
                    {result.Gender}
                  </span>
                  <span className="text-gray-500 ml-1 text-xs">#{result.GenderRank}</span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 text-xs">Distance:</span>
                <div>
                  <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-[#FF0E65] text-white rounded-full">
                    {result.distance}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 text-xs">Time:</span>
                <div className="font-bold text-gray-900 font-mono">{result.ChipTime}</div>
              </div>

              <div>
                <span className="text-gray-500 text-xs">Pace:</span>
                <div className="font-semibold text-gray-700 font-mono">{result.Pace}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="glass-effect sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8]">
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white">Rank</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white">BIB</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white">Athlete</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white">Gender</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white hidden xl:table-cell">Category</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white">Distance</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white">Time</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white hidden lg:table-cell">Pace</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white hidden lg:table-cell">Gap</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((result, index) => (
              <tr
                key={`${result.race_id}-${result.Bib}`}
                className={`lift-effect cursor-pointer ${
                  index % 2 === 0 ? 'bg-white' : 'bg-[#F1F5F9]'
                }`}
              >
                {/* Overall Rank */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center justify-center w-10 h-10 lg:w-12 lg:h-12 rounded-full ${getRankBadgeColor(result.OverallRank)} text-white font-black text-base lg:text-lg shadow-md`}
                  >
                    {formatRank(result.OverallRank)}
                  </span>
                </td>

                {/* BIB */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                  <div className="text-xl lg:text-2xl font-black text-[#2563EB]" style={{ fontFamily: 'var(--font-mono)' }}>
                    #{result.Bib}
                  </div>
                </td>

                {/* Athlete Name */}
                <td className="px-4 lg:px-6 py-3 lg:py-4">
                  <div className="font-bold text-[#1E293B] text-sm lg:text-lg">{result.Name}</div>
                  {result.Nationality && (
                    <div className="text-xs lg:text-sm text-gray-500 flex items-center gap-1">
                      {result.Nation && <span>{result.Nation}</span>}
                      <span>{result.Nationality}</span>
                    </div>
                  )}
                </td>

                {/* Gender */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 lg:px-3 py-1 text-xs font-bold text-white rounded-full ${getGenderBadgeColor(result.Gender)}`}
                  >
                    {result.Gender}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">
                    Rank: {result.GenderRank}
                  </div>
                </td>

                {/* Category */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 hidden xl:table-cell">
                  <div className="text-xs lg:text-sm font-semibold text-gray-700">
                    {result.Category}
                  </div>
                  <div className="text-xs text-gray-500">
                    Cat Rank: {result.CatRank}
                  </div>
                </td>

                {/* Distance */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 lg:px-3 py-1 text-xs lg:text-sm font-bold bg-[#FF0E65] text-white rounded-full shadow-md">
                    {result.distance}
                  </span>
                </td>

                {/* Chip Time */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                  <div className="text-base lg:text-lg font-bold text-[#1E293B]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {result.ChipTime}
                  </div>
                  {result.GunTime && result.GunTime !== result.ChipTime && (
                    <div className="text-xs text-gray-500">
                      Gun: {result.GunTime}
                    </div>
                  )}
                </td>

                {/* Pace */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap hidden lg:table-cell">
                  <div className="text-sm font-semibold text-gray-700 font-mono">
                    {result.Pace}
                  </div>
                </td>

                {/* Gap */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap hidden lg:table-cell">
                  <div className="text-sm text-gray-600">
                    {result.Gap || '-'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
