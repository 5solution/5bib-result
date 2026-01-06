'use client';

import { useState, useEffect } from 'react';
import { raceResultsApi, RaceResult, RaceResultsParams } from '@/lib/api';
import SearchBar from '@/components/SearchBar';
import FilterPanel from '@/components/FilterPanel';
import ResultsTable from '@/components/ResultsTable';
import Pagination from '@/components/Pagination';

export default function Home() {
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
      setError('Failed to load race results. Please try again.');
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

  return (
    <main className="min-h-screen">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#0000FF] via-blue-600 to-[#FF0000] text-white">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-2">
            5BIB RACE RESULTS
          </h1>
          <p className="text-base sm:text-lg md:text-xl font-semibold opacity-90">
            Real-Time Leaderboard · Elite Athletes · Live Updates
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8">
        {/* Search and Filters */}
        <div className="mb-6 md:mb-8 space-y-4">
          <SearchBar onSearch={handleSearch} />
          <FilterPanel
            filters={filters}
            onFilterChange={handleFilterChange}
            totalResults={total}
          />
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border-l-4 border-[#FF0000] text-red-900 p-4 rounded-lg mb-6">
            <p className="font-bold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#0000FF] border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-semibold">Loading results...</p>
          </div>
        )}

        {/* Results Table */}
        {!loading && !error && (
          <>
            <ResultsTable results={results} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 md:mt-8">
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
          <div className="text-center py-12">
            <p className="text-xl md:text-2xl font-bold text-gray-400 mb-2">No Results Found</p>
            <p className="text-sm md:text-base text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </main>
  );
}
