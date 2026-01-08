'use client';

import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 md:px-6 py-3 md:py-4 text-sm md:text-base border-2 border-[#2563EB] text-[#2563EB] rounded-lg font-black uppercase tracking-wider hover:bg-[#2563EB] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-xl"
      >
        <span className="hidden sm:inline">« {t('pagination.previous')}</span>
        <span className="sm:hidden">«</span>
      </button>

      {/* Page Numbers */}
      <div className="flex gap-2">
        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...'}
            className={`w-10 h-10 md:w-14 md:h-14 text-sm md:text-base rounded-lg font-black transition-all duration-300 ${
              page === currentPage
                ? 'bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] text-white shadow-xl scale-110'
                : page === '...'
                ? 'cursor-default text-gray-400 font-bold'
                : 'border-2 border-gray-300 text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#2563EB] hover:scale-105 shadow-md'
            }`}
          >
            {page}
          </button>
        ))}
      </div>

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 md:px-6 py-3 md:py-4 text-sm md:text-base border-2 border-[#2563EB] text-[#2563EB] rounded-lg font-black uppercase tracking-wider hover:bg-[#2563EB] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-xl"
      >
        <span className="hidden sm:inline">{t('pagination.next')} »</span>
        <span className="sm:hidden">»</span>
      </button>
    </div>
  );
}
