"use client";

/**
 * FEATURE-038 — Contracts List Client (P&L per row).
 *
 * State machine:
 *   1. Read URL searchParams → init filter state
 *   2. useEffect on filter change → fetch + setData/setLoading/setError
 *   3. On filter mutation → setState + router.replace(?...) (debounced 400ms
 *      for search input via inner useEffect → reduce history spam)
 *   4. URL change (browser back) → useSearchParams hook re-fires → filter
 *      restored
 *
 * Empty / loading / error / data states đầy đủ. Toast Sonner on error.
 *
 * Search input has 2-level debounce:
 *   - Typing → local state immediate (UX)
 *   - 400ms inactive → URL push + fetch trigger
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, Search, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getContractsList,
  FinanceApiError,
  type DashboardPeriod,
  type ContractsListSortBy,
  type SortDir,
  type ContractsListPageSize,
  type PnLContractsListResponse,
  CONTRACTS_LIST_PAGE_SIZES,
} from "@/lib/finance-api";
import { PeriodFilter } from "../../_components/period-filter";
import { MarginLegendBanner } from "./margin-legend-banner";
import { ContractsListTable } from "./contracts-list-table";
import { ContractsListFooterSummary } from "./contracts-list-footer-summary";
import { ContractsListEmptyState } from "./contracts-list-empty-state";

const DEFAULT_PERIOD: DashboardPeriod = "last_3_months";
const DEFAULT_LIMIT: ContractsListPageSize = 20;
const DEFAULT_SORT_BY: ContractsListSortBy = "anchorMonth";
const DEFAULT_SORT_DIR: SortDir = "desc";

function parsePeriod(v: string | null): DashboardPeriod {
  if (
    v === "current_month" ||
    v === "last_3_months" ||
    v === "last_6_months" ||
    v === "last_12_months" ||
    v === "ytd" ||
    v === "custom"
  ) {
    return v;
  }
  return DEFAULT_PERIOD;
}

function parseSortBy(v: string | null): ContractsListSortBy {
  if (
    v === "anchorMonth" ||
    v === "profit" ||
    v === "revenue" ||
    v === "margin" ||
    v === "contractNumber"
  ) {
    return v;
  }
  return DEFAULT_SORT_BY;
}

function parseSortDir(v: string | null): SortDir {
  return v === "asc" ? "asc" : DEFAULT_SORT_DIR;
}

function parseLimit(v: string | null): ContractsListPageSize {
  const n = Number(v);
  if ((CONTRACTS_LIST_PAGE_SIZES as readonly number[]).includes(n)) {
    return n as ContractsListPageSize;
  }
  return DEFAULT_LIMIT;
}

function parsePage(v: string | null): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 9999) return 1;
  return Math.floor(n);
}

export function ContractsListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state initialized from URL
  const [period, setPeriod] = useState<DashboardPeriod>(() =>
    parsePeriod(searchParams.get("period")),
  );
  const [dateFrom, setDateFrom] = useState<string>(
    () => searchParams.get("dateFrom") ?? "",
  );
  const [dateTo, setDateTo] = useState<string>(
    () => searchParams.get("dateTo") ?? "",
  );
  const [sortBy, setSortBy] = useState<ContractsListSortBy>(() =>
    parseSortBy(searchParams.get("sortBy")),
  );
  const [sortDir, setSortDir] = useState<SortDir>(() =>
    parseSortDir(searchParams.get("sortDir")),
  );
  const [limit, setLimit] = useState<ContractsListPageSize>(() =>
    parseLimit(searchParams.get("limit")),
  );
  const [page, setPage] = useState<number>(() =>
    parsePage(searchParams.get("page")),
  );

  // Search: local input + debounced applied value
  const [searchInput, setSearchInput] = useState<string>(
    () => searchParams.get("q") ?? "",
  );
  const [appliedQ, setAppliedQ] = useState<string>(
    () => searchParams.get("q") ?? "",
  );
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setAppliedQ(searchInput.trim());
      // Reset page to 1 when search keyword changes
      setPage(1);
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchInput]);

  // Sync URL with filter state (skips initial sync to avoid loop)
  const isFirstSync = useRef(true);
  useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    const usp = new URLSearchParams();
    if (period !== DEFAULT_PERIOD) usp.set("period", period);
    if (period === "custom") {
      if (dateFrom) usp.set("dateFrom", dateFrom);
      if (dateTo) usp.set("dateTo", dateTo);
    }
    if (sortBy !== DEFAULT_SORT_BY) usp.set("sortBy", sortBy);
    if (sortDir !== DEFAULT_SORT_DIR) usp.set("sortDir", sortDir);
    if (limit !== DEFAULT_LIMIT) usp.set("limit", String(limit));
    if (page !== 1) usp.set("page", String(page));
    if (appliedQ) usp.set("q", appliedQ);
    const qs = usp.toString();
    router.replace(qs ? `/finance/contracts?${qs}` : `/finance/contracts`, {
      scroll: false,
    });
  }, [
    router,
    period,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
    limit,
    page,
    appliedQ,
  ]);

  // Data fetch
  const [data, setData] = useState<PnLContractsListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getContractsList({
        period,
        dateFrom: period === "custom" ? dateFrom : undefined,
        dateTo: period === "custom" ? dateTo : undefined,
        page,
        limit,
        sortBy,
        sortDir,
        q: appliedQ || undefined,
      });
      setData(res);
    } catch (e) {
      const msg =
        e instanceof FinanceApiError
          ? `${e.status}: ${e.message}`
          : (e as Error).message;
      setError(msg);
      toast.error("Lỗi tải danh sách. Hãy thử lại.", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo, page, limit, sortBy, sortDir, appliedQ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sortable column toggle
  const handleSort = useCallback(
    (col: ContractsListSortBy) => {
      if (sortBy === col) {
        setSortDir(sortDir === "asc" ? "desc" : "asc");
      } else {
        setSortBy(col);
        setSortDir("desc");
      }
      setPage(1);
    },
    [sortBy, sortDir],
  );

  // Reset all filters back to defaults
  const handleResetFilter = useCallback(() => {
    setPeriod(DEFAULT_PERIOD);
    setDateFrom("");
    setDateTo("");
    setSortBy(DEFAULT_SORT_BY);
    setSortDir(DEFAULT_SORT_DIR);
    setLimit(DEFAULT_LIMIT);
    setPage(1);
    setSearchInput("");
    setAppliedQ("");
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setAppliedQ("");
    setPage(1);
  }, []);

  const items = data?.items ?? [];
  const hasFilterApplied = useMemo(() => {
    return (
      appliedQ.length > 0 ||
      period !== DEFAULT_PERIOD ||
      sortBy !== DEFAULT_SORT_BY ||
      sortDir !== DEFAULT_SORT_DIR
    );
  }, [appliedQ, period, sortBy, sortDir]);

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="size-6 text-blue-700" aria-hidden />
          <h1 className="text-xl font-bold text-stone-900">
            P&amp;L theo Hợp đồng
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            aria-label="Tải lại danh sách"
          >
            <RefreshCw
              className={`size-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden
            />
          </Button>
          <PeriodFilter
            period={period}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(p) => {
              setPeriod(p.period);
              setDateFrom(p.dateFrom);
              setDateTo(p.dateTo);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Margin legend */}
      <MarginLegendBanner />

      {/* Search row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Tìm theo số HĐ / đối tác / giải"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 pr-8"
            maxLength={100}
            aria-label="Tìm kiếm hợp đồng"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Xoá tìm kiếm"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        {data ? (
          <div className="text-xs text-stone-500">
            {data.total > 0
              ? `Hiển thị ${(data.page - 1) * data.limit + 1}-${Math.min(
                  data.page * data.limit,
                  data.total,
                )} / ${data.total}`
              : null}
          </div>
        ) : null}
      </div>

      {/* Body */}
      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error && !data ? (
        <ContractsListEmptyState variant="error" onRetry={fetchData} />
      ) : data && data.items.length === 0 ? (
        <ContractsListEmptyState
          variant={hasFilterApplied ? "filtered-empty" : "empty"}
          searchKeyword={appliedQ || undefined}
          onResetFilter={hasFilterApplied ? handleResetFilter : undefined}
        />
      ) : data ? (
        <>
          <ContractsListTable
            items={items}
            page={data.page}
            limit={data.limit}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <ContractsListFooterSummary
            totals={data.totals}
            page={data.page}
            totalPages={data.totalPages}
            limit={data.limit as ContractsListPageSize}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
