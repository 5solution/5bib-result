'use client';

import { useState } from 'react';
import { RaceResult } from '@/lib/api';
import CertificateModal from './CertificateModal';

interface ResultsTableProps {
  results: RaceResult[];
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<{ url: string; name: string } | null>(null);

  const openCertificateModal = (certificateUrl: string, athleteName: string) => {
    setSelectedCertificate({ url: certificateUrl, name: athleteName });
    setModalOpen(true);
  };

  const closeCertificateModal = () => {
    setModalOpen(false);
    setSelectedCertificate(null);
  };

  const formatRank = (rank: string) => {
    if (rank === '-1' || rank === null || rank === undefined) {
      return '🏃';
    }
    const numRank = parseInt(rank);
    if (numRank === 1) return '🥇'; // Gold medal
    if (numRank === 2) return '🥈'; // Silver medal
    if (numRank === 3) return '🥉'; // Bronze medal
    return rank;
  };

  const getRankBadgeColor = (rank: string) => {
    if (rank === '-1' || rank === null || rank === undefined) {
      return 'bg-gradient-to-br from-orange-500 to-orange-700'; // Racing/In Progress
    }
    const numRank = parseInt(rank);
    if (isNaN(numRank)) return 'bg-gray-500'; // DSQ, DNF, etc.
    // Top 3 get no background - just the medal emoji
    if (numRank === 1 || numRank === 2 || numRank === 3) return 'bg-transparent';
    return 'bg-[#2563EB]';
  };

  const getGenderBadgeColor = (gender: string) => {
    return gender === 'Male' ? 'bg-[#2563EB]' : 'bg-[#FF0E65]';
  };

  const getRankBadgeStyle = (rank: string) => {
    const numRank = parseInt(rank);
    // Top 3 medals display larger without container styling
    if (numRank === 1 || numRank === 2 || numRank === 3) {
      return 'inline-flex items-center justify-center text-4xl'; // Smaller medal emoji, centered
    }
    return 'inline-flex items-center justify-center w-10 h-10 lg:w-11 lg:h-11 rounded-full text-white font-bold text-base shadow-md';
  };

  const formatName = (name: string) => {
    // Convert to title case (first letter of each word uppercase)
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
                className={`${getRankBadgeStyle(result.OverallRank)} ${getRankBadgeColor(result.OverallRank)} flex-shrink-0`}
              >
                {formatRank(result.OverallRank)}
              </span>

              <div className="flex-1 min-w-0">
                {/* Athlete Name */}
                <div className="font-bold text-[#1E293B] truncate mb-1">{formatName(result.Name)}</div>
                {/* BIB Number and Gender */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-black text-[#2563EB]" style={{ fontFamily: 'var(--font-mono)' }}>
                    #{result.Bib}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-bold text-white rounded-full ${getGenderBadgeColor(result.Gender)}`}>
                    {result.Gender === 'Male' ? '♂' : '♀'}
                  </span>
                </div>
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
                <span className="text-gray-500 text-xs">Time:</span>
                <div className="font-bold text-gray-900 font-mono">{result.ChipTime}</div>
              </div>

              <div>
                <span className="text-gray-500 text-xs">Pace:</span>
                <div className="font-semibold text-gray-700 font-mono">{result.Pace}</div>
              </div>
            </div>

            {/* Certificate Button for Mobile */}
            {result.Certificate && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => openCertificateModal(result.Certificate!, result.Name)}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md text-sm"
                >
                  <span>🏆</span>
                  <span>View Certificate</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="glass-effect sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8]">
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white">Rank</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white">Athlete</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white hidden xl:table-cell">Category</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white">Time</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white hidden lg:table-cell">Pace</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-left text-xs lg:text-sm font-black uppercase tracking-widest text-white hidden lg:table-cell">Gap</th>
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-center text-xs lg:text-sm font-black uppercase tracking-widest text-white hidden xl:table-cell">Certificate</th>
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
                    className={`${getRankBadgeStyle(result.OverallRank)} ${getRankBadgeColor(result.OverallRank)}`}
                  >
                    {formatRank(result.OverallRank)}
                  </span>
                </td>

                {/* Athlete Name, BIB, and Gender */}
                <td className="px-4 lg:px-6 py-3 lg:py-4">
                  <div className="font-bold text-[#1E293B] text-sm lg:text-lg mb-1">{formatName(result.Name)}</div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black text-[#2563EB]" style={{ fontFamily: 'var(--font-mono)' }}>
                      #{result.Bib}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-bold text-white rounded-full ${getGenderBadgeColor(result.Gender)}`}>
                      {result.Gender === 'Male' ? '♂' : '♀'}
                    </span>
                    <span className="text-xs text-gray-500">
                      Rank: {result.GenderRank}
                    </span>
                  </div>
                  {result.Nationality && (
                    <div className="text-xs lg:text-sm text-gray-500 flex items-center gap-1">
                      {result.Nation && <span>{result.Nation}</span>}
                      <span>{result.Nationality}</span>
                    </div>
                  )}
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

                {/* Certificate */}
                <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap hidden xl:table-cell text-center">
                  {result.Certificate ? (
                    <button
                      onClick={() => openCertificateModal(result.Certificate!, result.Name)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-xl text-xs"
                    >
                      <span>🏆</span>
                      <span>View</span>
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Certificate Modal */}
      {selectedCertificate && (
        <CertificateModal
          isOpen={modalOpen}
          onClose={closeCertificateModal}
          certificateUrl={selectedCertificate.url}
          athleteName={selectedCertificate.name}
        />
      )}
    </div>
  );
}
