'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
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
    <div className="flex flex-wrap items-center justify-center gap-2">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 md:px-4 py-2 text-sm md:text-base border-2 border-gray-300 rounded-lg font-bold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <span className="hidden sm:inline">« Prev</span>
        <span className="sm:hidden">«</span>
      </button>

      {/* Page Numbers */}
      <div className="flex gap-1 md:gap-2">
        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...'}
            className={`w-9 h-9 md:w-12 md:h-12 text-sm md:text-base rounded-lg font-bold transition-all ${
              page === currentPage
                ? 'bg-gradient-to-r from-[#0000FF] to-blue-600 text-white shadow-lg scale-110'
                : page === '...'
                ? 'cursor-default text-gray-400'
                : 'border-2 border-gray-300 hover:bg-gray-100'
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
        className="px-3 md:px-4 py-2 text-sm md:text-base border-2 border-gray-300 rounded-lg font-bold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <span className="hidden sm:inline">Next »</span>
        <span className="sm:hidden">»</span>
      </button>
    </div>
  );
}
