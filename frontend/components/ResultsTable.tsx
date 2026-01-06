'use client';

import { RaceResult } from '@/lib/api';

interface ResultsTableProps {
  results: RaceResult[];
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const getRankBadgeColor = (rank: string) => {
    const numRank = parseInt(rank);
    if (isNaN(numRank)) return 'bg-gray-500'; // DSQ, DNF, etc.
    if (numRank === 1) return 'bg-yellow-500';
    if (numRank === 2) return 'bg-gray-400';
    if (numRank === 3) return 'bg-orange-600';
    return 'bg-[#0000FF]';
  };

  const getGenderBadgeColor = (gender: string) => {
    return gender === 'Male' ? 'bg-blue-500' : 'bg-pink-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow border border-gray-200 overflow-hidden">
      {/* Mobile Card View */}
      <div className="block md:hidden">
        {results.map((result) => (
          <div
            key={`${result.race_id}-${result.Bib}`}
            className="border-b border-gray-200 p-4 hover:bg-blue-50 transition-colors"
          >
            <div className="flex items-start gap-3 mb-3">
              {/* Rank Badge */}
              <span
                className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${getRankBadgeColor(result.OverallRank)} text-white font-black text-lg shadow-md flex-shrink-0`}
              >
                {result.OverallRank}
              </span>

              <div className="flex-1 min-w-0">
                {/* BIB Number */}
                <div className="text-xl font-black text-[#0000FF] mb-1">
                  #{result.Bib}
                </div>
                {/* Athlete Name */}
                <div className="font-bold text-gray-900 truncate">{result.Name}</div>
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
                  <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-[#FF0000] text-white rounded-full">
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
          <thead className="bg-gradient-to-r from-[#0000FF] to-blue-600 text-white">
            <tr>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold uppercase tracking-wider">Rank</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold uppercase tracking-wider">BIB</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold uppercase tracking-wider">Athlete</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold uppercase tracking-wider">Gender</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold uppercase tracking-wider hidden xl:table-cell">Category</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold uppercase tracking-wider">Distance</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold uppercase tracking-wider">Time</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold uppercase tracking-wider hidden lg:table-cell">Pace</th>
              <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs font-bold uppercase tracking-wider hidden lg:table-cell">Gap</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((result) => (
              <tr key={`${result.race_id}-${result.Bib}`} className="hover:bg-blue-50 transition-colors">
                {/* Overall Rank */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center justify-center w-10 h-10 lg:w-12 lg:h-12 rounded-full ${getRankBadgeColor(result.OverallRank)} text-white font-black text-base lg:text-lg shadow-md`}
                  >
                    {result.OverallRank}
                  </span>
                </td>

                {/* BIB */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                  <div className="text-xl lg:text-2xl font-black text-[#0000FF]">
                    #{result.Bib}
                  </div>
                </td>

                {/* Athlete Name */}
                <td className="px-4 lg:px-6 py-3 lg:py-4">
                  <div className="font-bold text-gray-900 text-sm lg:text-lg">{result.Name}</div>
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
                  <span className="inline-flex px-2 lg:px-3 py-1 text-xs lg:text-sm font-bold bg-[#FF0000] text-white rounded-full">
                    {result.distance}
                  </span>
                </td>

                {/* Chip Time */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                  <div className="text-base lg:text-lg font-bold text-gray-900 font-mono">
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
