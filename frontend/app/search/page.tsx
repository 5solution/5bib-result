'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronLeft, Trophy, Calendar, Loader2 } from 'lucide-react';
import { countryToFlag } from '@/lib/country-flags';

interface SearchResult {
  Bib: number;
  Name: string;
  OverallRank: string;
  Gender: string;
  Category: string;
  ChipTime: string;
  Pace: string;
  Nationality: string;
  Nation: string;
  race_id: string;
  course_id: string;
  distance: string;
  race_name: string;
  race_slug: string;
  race_date: string;
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 pt-14 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/race-results/search?q=${encodeURIComponent(q.trim())}&limit=50`);
      if (res.ok) {
        const body = await res.json();
        setResults(body?.data ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
  }, [initialQuery, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.replace(`/search?q=${encodeURIComponent(query.trim())}`, { scroll: false });
      doSearch(query.trim());
    }
  };

  const formatName = (name: string) =>
    name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const formatDate = (d: string) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return d; }
  };

  // Group results by race
  const grouped = results.reduce<Record<string, { race_name: string; race_slug: string; race_date: string; items: SearchResult[] }>>((acc, r) => {
    const key = r.race_slug || r.race_id;
    if (!acc[key]) {
      acc[key] = { race_name: r.race_name, race_slug: r.race_slug, race_date: r.race_date, items: [] };
    }
    acc[key].items.push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 pt-14">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600 transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" /> Trang chu
          </Link>

          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhap ten van dong vien hoac so BIB..."
                autoFocus
                className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Tim kiem'}
            </button>
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-gray-400">Dang tim kiem...</p>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-700 mb-1">Khong tim thay ket qua</h3>
            <p className="text-sm text-gray-400">Thu tim kiem voi ten hoac so BIB khac</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-6">
              Tim thay <strong className="text-gray-900">{results.length}</strong> ket qua cho &ldquo;<strong>{initialQuery}</strong>&rdquo;
            </p>

            <div className="space-y-8">
              {Object.entries(grouped).map(([key, group]) => (
                <div key={key}>
                  {/* Race header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <Link href={`/races/${group.race_slug}`} className="font-bold text-gray-900 hover:text-blue-600 transition-colors">
                        {group.race_name || key}
                      </Link>
                      {group.race_date && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(group.race_date)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Athletes in this race */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                    {group.items.map((r, i) => (
                      <Link
                        key={`${r.Bib}-${r.course_id}-${i}`}
                        href={`/races/${group.race_slug}/${r.Bib}`}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-blue-50/50 transition-colors"
                      >
                        {/* Rank */}
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                          {r.OverallRank && r.OverallRank !== '' ? `#${r.OverallRank}` : '-'}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{formatName(r.Name)}</p>
                          <p className="text-xs text-gray-400">
                            BIB {r.Bib} &middot; {r.distance} &middot; {r.Gender === 'Female' ? 'Nu' : 'Nam'} &middot; {r.Category}
                            {r.Nationality && r.Nationality !== 'undefined' ? ` · ${countryToFlag(r.Nationality) || countryToFlag(r.Nation) || r.Nation}` : ''}
                          </p>
                        </div>
                        {/* Time */}
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-gray-900 text-sm">{r.ChipTime || '-'}</p>
                          {r.Pace && <p className="text-xs text-gray-400">{r.Pace}/km</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !searched && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-700 mb-1">Tim kiem van dong vien</h3>
            <p className="text-sm text-gray-400">Nhap ten hoac so BIB de tim ket qua thi dau</p>
          </div>
        )}
      </div>
    </div>
  );
}
