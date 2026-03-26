'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { raceResultsApi, RaceResult, RaceResultsParams } from '@/lib/api';
import SearchBar from '@/components/SearchBar';
import FilterPanel from '@/components/FilterPanel';
import ResultsTable from '@/components/ResultsTable';
import Pagination from '@/components/Pagination';
import RaceDistanceTabs from '@/components/RaceDistanceTabs';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Home() {
  const { t } = useTranslation();
  const [results, setResults] = useState<RaceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState<RaceResultsParams>({
    pageNo: 1,
    pageSize: 20,
    sortField: 'OverallRank',
    sortDirection: 'ASC',
  });

  useEffect(() => {
    fetchResults();
  }, [filters]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await raceResultsApi.getResults(filters);
      setResults(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(t('error.loadFailed'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({ ...prev, name: searchTerm || undefined, pageNo: 1 }));
  };

  const handleFilterChange = (newFilters: Partial<RaceResultsParams>) => {
    setFilters(prev => ({ ...prev, ...newFilters, pageNo: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, pageNo: page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDistanceChange = (courseId: string) => {
    setFilters(prev => ({ ...prev, course_id: courseId, pageNo: 1 }));
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      {/* Premium Hero Header */}
      <div className="bg-gradient-to-r from-[#2563EB] via-[#1d4ed8] to-[#FF0E65] text-white relative overflow-hidden">
        {/* Animated background effect */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6bTAgNmMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0LTEuNzkgNC00IDQtNC0xLjc5LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')]"></div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link href="/landing">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter uppercase hover:text-[#FF0E65] transition-colors duration-300 cursor-pointer">
                    {t('header.title')}
                  </h1>
                </Link>
                <span className="inline-flex items-center px-2 py-1 bg-[#FF0E65] text-white text-xs font-black uppercase tracking-wider rounded-full pulse-live shadow-lg">
                  {t('header.live')}
                </span>
              </div>
              <p className="text-sm sm:text-base md:text-lg font-bold opacity-95 tracking-wide">
                {t('header.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/landing">
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 font-semibold backdrop-blur-sm border border-white/20 text-sm">
                  Home
                </button>
              </Link>
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* Race Distance Tabs */}
        <div className="mb-6 md:mb-8">
          <RaceDistanceTabs
            selectedDistance={filters.course_id || null}
            onDistanceChange={handleDistanceChange}
          />
        </div>

        {/* Search and Filters */}
        <div className="mb-6 md:mb-10 space-y-5">
          <SearchBar onSearch={handleSearch} />
          <FilterPanel
            filters={filters}
            onFilterChange={handleFilterChange}
            totalResults={total}
          />
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border-l-4 border-[#FF0E65] text-red-900 p-5 md:p-6 rounded-xl mb-6 shadow-lg">
            <p className="font-black text-lg mb-1">⚠️ {t('common.error')}</p>
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-[#2563EB] border-t-transparent"></div>
            <p className="mt-6 text-[#1E293B] font-black text-lg uppercase tracking-wider">{t('common.loading')}</p>
          </div>
        )}

        {/* Results Table */}
        {!loading && !error && (
          <>
            <ResultsTable results={results} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 md:mt-10">
                <Pagination
                  currentPage={filters.pageNo || 1}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}

        {/* No Results */}
        {!loading && !error && results.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl shadow-lg border-2 border-gray-200">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-2xl md:text-3xl font-black text-[#1E293B] mb-2 uppercase tracking-wide">{t('noResults.title')}</p>
            <p className="text-base md:text-lg text-gray-600 font-semibold">{t('noResults.message')}</p>
          </div>
        )}
      </div>
    </main>
  );
}
