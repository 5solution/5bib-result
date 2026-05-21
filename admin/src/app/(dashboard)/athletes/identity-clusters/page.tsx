/**
 * FEATURE-049 — Identity Cluster List page (humanized UX).
 *
 * Rewrites F-048 baseline với:
 *   - VN business-language labels (TIER / CONFIDENCE / ACTION)
 *   - Traffic-light Badge (green/amber/red/gray)
 *   - "Hiển thị thông tin kỹ thuật" toggle persisted localStorage
 *   - Race name + bib number enrichment (F-049 backend) shown ở detail page
 *   - Copy-to-clipboard cho cluster ID
 *
 * Backend: GET /api/admin/athletes/identity-clusters (F-048 controller)
 *          GET /api/admin/identity-coverage-stats (F-048 controller)
 */

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw, SearchX, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IdentityClusterTable } from "@/components/identity-clusters/IdentityClusterTable";
import type { ClusterListItem } from "@/components/identity-clusters/IdentityClusterTable";
import {
  TechModeToggle,
  useTechMode,
} from "@/components/identity-clusters/TechModeToggle";
import {
  TIER_FILTER_OPTIONS,
  type TierFilterValue,
  tierFilterToSourceParam,
} from "@/lib/identity-cluster-labels";

interface CoverageStats {
  totalClusters: number;
  byTier: {
    t1_email: number;
    t2_name_dob_gender: number;
    t3_name_gender: number;
    t4_anonymous: number;
  };
  reviewQueueDepth: number;
  avgRacesPerCluster: number;
  lastClusteringRun: string | null;
}

interface ClusterListResponse {
  items: ClusterListItem[];
  total: number;
}

const fetchStats = async (): Promise<CoverageStats> => {
  const res = await fetch("/api/admin/identity-coverage-stats", {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const fetchClusters = async (
  params: URLSearchParams,
): Promise<ClusterListResponse> => {
  const res = await fetch(
    `/api/admin/athletes/identity-clusters?${params.toString()}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const triggerClustering = async (): Promise<void> => {
  const res = await fetch(
    "/api/admin/athletes/identity-clusters/trigger-clustering",
    { method: "POST", credentials: "include" },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
};

const PAGE_SIZE = 20;

export default function IdentityClustersListPage() {
  const { techMode, setTechMode, hydrated } = useTechMode();

  const [tierFilter, setTierFilter] = useState<TierFilterValue>("all");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);

  const statsQuery = useQuery({
    queryKey: ["identity-coverage-stats"],
    queryFn: fetchStats,
  });

  const clustersQuery = useQuery({
    queryKey: ["identity-clusters", { tierFilter, searchText, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      const sourceParam = tierFilterToSourceParam(tierFilter);
      if (sourceParam) params.set("source", sourceParam);
      const trimmed = searchText.trim();
      if (trimmed.length >= 3) params.set("q", trimmed);
      return fetchClusters(params);
    },
  });

  const triggerMutation = useMutation({
    mutationFn: triggerClustering,
    onSuccess: () => {
      toast.success("Đã kích hoạt chạy lại phân cụm identity");
      statsQuery.refetch();
      clustersQuery.refetch();
    },
    onError: (err: Error) => {
      toast.error(`Lỗi kích hoạt: ${err.message}`);
    },
  });

  const totalPages = useMemo(() => {
    if (!clustersQuery.data) return 1;
    return Math.max(1, Math.ceil(clustersQuery.data.total / PAGE_SIZE));
  }, [clustersQuery.data]);

  const handleClearFilters = () => {
    setTierFilter("all");
    setSearchText("");
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-stone-500">
            Quản trị / Vận hành /{" "}
            <span className="text-stone-700">Hồ sơ identity</span>
          </nav>
          <h1 className="text-2xl font-bold text-stone-900">
            Hồ sơ identity vận động viên
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Quản lý và moderate các hồ sơ định danh xuyên giải. Hồ sơ identity
            được tạo tự động từ email / Tên + Năm sinh + Giới tính.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TechModeToggle
            techMode={techMode}
            onChange={setTechMode}
            hydrated={hydrated}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              statsQuery.refetch();
              clustersQuery.refetch();
            }}
            disabled={clustersQuery.isFetching}
            title="Tải lại danh sách"
          >
            <RefreshCw
              className={
                clustersQuery.isFetching
                  ? "size-3.5 animate-spin"
                  : "size-3.5"
              }
            />
            <span>Tải lại</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            title="Chạy lại quy trình phân cụm identity"
          >
            {triggerMutation.isPending ? "Đang chạy…" : "Chạy lại phân cụm"}
          </Button>
        </div>
      </header>

      {/* KPI cards */}
      {statsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-stone-100"
            />
          ))}
        </div>
      ) : statsQuery.data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Tổng hồ sơ"
            value={statsQuery.data.totalClusters}
            tone="default"
          />
          <KpiCard
            label="Tin cậy cao (T1)"
            value={statsQuery.data.byTier.t1_email}
            tone="success"
          />
          <KpiCard
            label="Cần xem xét"
            value={statsQuery.data.reviewQueueDepth}
            tone="warning"
            cta={
              <button
                type="button"
                onClick={() => {
                  setTierFilter("T3");
                  setPage(1);
                }}
                className="mt-2 text-xs font-medium text-stone-700 hover:text-stone-900"
              >
                Lọc xem queue →
              </button>
            }
          />
          <KpiCard
            label="Số giải trung bình/hồ sơ"
            value={statsQuery.data.avgRacesPerCluster}
            tone="default"
          />
        </div>
      ) : null}

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-3">
        <div className="min-w-[200px]">
          <Label htmlFor="tier-filter" className="text-xs">
            Mức độ tin cậy
          </Label>
          <Select
            value={tierFilter}
            onValueChange={(v) => {
              setTierFilter(v as TierFilterValue);
              setPage(1);
            }}
          >
            <SelectTrigger id="tier-filter" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIER_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <Label htmlFor="search-text" className="text-xs">
            Tìm theo tên (slug)
          </Label>
          <Input
            id="search-text"
            type="text"
            placeholder="vd: nguyen-binh-minh (tối thiểu 3 ký tự)"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(1);
            }}
            className="mt-1"
            maxLength={100}
          />
        </div>
      </div>

      {/* List body */}
      {clustersQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-md bg-stone-100"
            />
          ))}
        </div>
      ) : clustersQuery.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Lỗi tải dữ liệu — vui lòng thử lại
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => clustersQuery.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : clustersQuery.data && clustersQuery.data.items.length === 0 ? (
        <EmptyState
          filtered={tierFilter !== "all" || searchText.length > 0}
          onClearFilters={handleClearFilters}
        />
      ) : clustersQuery.data ? (
        <>
          <IdentityClusterTable
            items={clustersQuery.data.items}
            techMode={techMode}
          />

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
            <div className="text-stone-600">
              Trang {page} / {totalPages} —{" "}
              <span className="font-medium text-stone-800">
                {clustersQuery.data.total.toLocaleString("vi-VN")}
              </span>{" "}
              hồ sơ
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Trang trước
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Trang sau
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  cta,
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "warning";
  cta?: React.ReactNode;
}) {
  const valueColor =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-stone-900";
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className={`text-3xl font-bold ${valueColor}`}>
        {value.toLocaleString("vi-VN")}
      </div>
      <div className="mt-1 text-sm text-stone-600">{label}</div>
      {cta}
    </div>
  );
}

function EmptyState({
  filtered,
  onClearFilters,
}: {
  filtered: boolean;
  onClearFilters: () => void;
}) {
  if (filtered) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
        <SearchX className="mx-auto size-10 text-stone-400" />
        <h3 className="mt-3 text-lg font-semibold text-stone-700">
          Không có hồ sơ khớp bộ lọc
        </h3>
        <p className="mt-1 text-sm text-stone-500">
          Thử xóa bộ lọc hoặc thay đổi điều kiện tìm kiếm.
        </p>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="mt-4"
          onClick={onClearFilters}
        >
          Xoá bộ lọc
        </Button>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
      <UsersRound className="mx-auto size-10 text-stone-400" />
      <h3 className="mt-3 text-lg font-semibold text-stone-700">
        Chưa có hồ sơ identity nào
      </h3>
      <p className="mt-1 text-sm text-stone-500">
        Hồ sơ identity được tự động tạo sau khi đồng bộ giải. Bạn có thể kích
        hoạt phân cụm thủ công.
      </p>
      <Link
        href="/race-master-data/sync-control"
        className="mt-4 inline-flex items-center rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
      >
        Đi tới đồng bộ giải →
      </Link>
    </div>
  );
}
