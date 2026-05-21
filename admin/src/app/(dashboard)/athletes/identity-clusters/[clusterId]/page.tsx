/**
 * FEATURE-049 — Identity Cluster Detail page (humanized UX).
 *
 * Rewrites F-048 baseline với:
 *   - VN business-language action labels ("Phân tách hồ sơ" / "Hợp nhất với hồ sơ khác")
 *   - Cluster summary card với tier badge + traffic light confidence
 *   - Linked records table với raceName + bibNumber (F-049 backend enrichment)
 *   - Merge / Split dialogs với confirm pattern
 *   - Tech-mode toggle for raw fields
 */

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ClusterSummaryCard } from "@/components/identity-clusters/ClusterSummaryCard";
import {
  LinkedRecordsTable,
  type LinkedRecord,
} from "@/components/identity-clusters/LinkedRecordsTable";
import { MergeClusterDialog } from "@/components/identity-clusters/MergeClusterDialog";
import { SplitClusterDialog } from "@/components/identity-clusters/SplitClusterDialog";
import {
  TechModeToggle,
  useTechMode,
} from "@/components/identity-clusters/TechModeToggle";
import { ACTION_LABEL } from "@/lib/identity-cluster-labels";

interface ClusterDetail {
  clusterId: string;
  emailHash: string | null;
  primaryEmail?: string | null;
  nameSlug: string | null;
  dobYear: number | null;
  genderNormalized: "male" | "female" | "other" | null;
  linkedAthleteRecords: LinkedRecord[];
  confidence: number;
  source: string;
  moderatedBy: string | null;
  moderatedAt: string | null;
  splitFromClusterId: string | null;
  createdAt: string;
  updatedAt: string;
}

const fetchCluster = async (clusterId: string): Promise<ClusterDetail> => {
  const res = await fetch(
    `/api/admin/athletes/identity-clusters/${encodeURIComponent(clusterId)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const postSplit = async (data: {
  clusterId: string;
  extractAthleteIds: number[];
  reason: string;
}): Promise<void> => {
  const res = await fetch(
    `/api/admin/athletes/identity-clusters/${data.clusterId}/split`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        extractAthleteIds: data.extractAthleteIds,
        reason: data.reason,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
};

const postMerge = async (data: {
  clusterId: string;
  additionalClusterIds: string[];
  reason: string;
}): Promise<void> => {
  const res = await fetch(
    `/api/admin/athletes/identity-clusters/${data.clusterId}/merge`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        additionalClusterIds: data.additionalClusterIds,
        reason: data.reason,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
};

export default function ClusterDetailPage({
  params,
}: {
  params: Promise<{ clusterId: string }>;
}) {
  const { clusterId } = use(params);
  const queryClient = useQueryClient();
  const { techMode, setTechMode, hydrated } = useTechMode();

  const [splitOpen, setSplitOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["identity-cluster", clusterId],
    queryFn: () => fetchCluster(clusterId),
  });

  const splitMutation = useMutation({
    mutationFn: postSplit,
    onSuccess: () => {
      toast.success("Đã phân tách hồ sơ thành công");
      queryClient.invalidateQueries({
        queryKey: ["identity-cluster", clusterId],
      });
      queryClient.invalidateQueries({ queryKey: ["identity-clusters"] });
      setSplitOpen(false);
    },
    onError: (err: Error) => {
      toast.error(`Lỗi phân tách: ${err.message}`);
    },
  });

  const mergeMutation = useMutation({
    mutationFn: postMerge,
    onSuccess: () => {
      toast.success("Đã hợp nhất hồ sơ thành công");
      queryClient.invalidateQueries({
        queryKey: ["identity-cluster", clusterId],
      });
      queryClient.invalidateQueries({ queryKey: ["identity-clusters"] });
      setMergeOpen(false);
    },
    onError: (err: Error) => {
      toast.error(`Lỗi hợp nhất: ${err.message}`);
    },
  });

  // Inline-row single-record split
  const handleSingleRecordSplit = async (
    athletesId: number,
    displayName: string,
  ) => {
    await splitMutation.mutateAsync({
      clusterId,
      extractAthleteIds: [athletesId],
      reason: `Phân tách bản ghi ${displayName} (admin inline-split)`,
    });
  };

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-100" />
        <div className="h-40 animate-pulse rounded-lg bg-stone-100" />
        <div className="h-64 animate-pulse rounded-lg bg-stone-100" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Không tìm thấy hồ sơ identity hoặc lỗi tải dữ liệu
        </div>
        <Link
          href="/athletes/identity-clusters"
          className="inline-flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900"
        >
          <ArrowLeft className="size-3.5" />
          {ACTION_LABEL.backToList}
        </Link>
      </div>
    );
  }

  const cluster = detailQuery.data;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-stone-500">
            <Link
              href="/athletes/identity-clusters"
              className="hover:text-stone-700"
            >
              Quản trị / Vận hành / Hồ sơ identity
            </Link>
            <span className="mx-1">/</span>
            <span className="text-stone-700">Chi tiết</span>
          </nav>
          <h1 className="text-xl font-semibold text-stone-900">Chi tiết hồ sơ</h1>
        </div>
        <div className="flex items-center gap-3">
          <TechModeToggle
            techMode={techMode}
            onChange={setTechMode}
            hydrated={hydrated}
          />
          <Link
            href="/athletes/identity-clusters"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium hover:bg-stone-50"
          >
            <ArrowLeft className="size-3.5" />
            <span>{ACTION_LABEL.backToList}</span>
          </Link>
        </div>
      </header>

      {/* Summary card */}
      <ClusterSummaryCard
        cluster={{
          ...cluster,
          linkedAthleteRecordsCount: cluster.linkedAthleteRecords.length,
        }}
        techMode={techMode}
      />

      {/* Linked records */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-800">
            Bản ghi đã liên kết ({cluster.linkedAthleteRecords.length})
          </h2>
        </div>
        <LinkedRecordsTable
          records={cluster.linkedAthleteRecords}
          techMode={techMode}
          onSplitRecord={(id, name) => {
            // Inline confirm UX already inside LinkedRecordsTable row
            handleSingleRecordSplit(id, name);
          }}
          disabled={splitMutation.isPending}
        />
      </section>

      {/* Actions section */}
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
        <div className="flex-1 text-sm text-stone-700">
          <p className="font-medium">Thao tác quản trị hồ sơ</p>
          <p className="text-xs text-stone-500">
            Sử dụng các nút bên phải để phân tách bản ghi sang hồ sơ mới hoặc hợp
            nhất hồ sơ này với hồ sơ khác.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSplitOpen(true)}
          disabled={
            cluster.linkedAthleteRecords.length <= 1 ||
            splitMutation.isPending
          }
          title={
            cluster.linkedAthleteRecords.length <= 1
              ? "Cần ít nhất 2 bản ghi mới có thể phân tách"
              : ACTION_LABEL.split
          }
          className="text-red-700 hover:bg-red-50"
        >
          {splitMutation.isPending && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          <span>{ACTION_LABEL.split}</span>
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={() => setMergeOpen(true)}
          disabled={mergeMutation.isPending}
        >
          {mergeMutation.isPending && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          <span>{ACTION_LABEL.merge}</span>
        </Button>
      </section>

      {/* Dialogs */}
      <SplitClusterDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        records={cluster.linkedAthleteRecords}
        onConfirm={async ({ extractAthleteIds, reason }) => {
          await splitMutation.mutateAsync({
            clusterId,
            extractAthleteIds,
            reason,
          });
        }}
        isPending={splitMutation.isPending}
      />
      <MergeClusterDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        currentClusterId={cluster.clusterId}
        onConfirm={async ({ additionalClusterIds, reason }) => {
          await mergeMutation.mutateAsync({
            clusterId,
            additionalClusterIds,
            reason,
          });
        }}
        isPending={mergeMutation.isPending}
      />
    </div>
  );
}
