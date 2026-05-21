/**
 * F-049 — Cluster list table cho `/athletes/identity-clusters` page.
 *
 * BR-49-09 columns: ID hồ sơ (#abc12345 + copy) / Tier badge / Email /
 * Số giải (badge) / Cập nhật (relative time) / Hành động (Xem chi tiết).
 *
 * Tech mode adds: Cluster UUID đầy đủ + nameSlug raw + Source raw.
 */

"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyClusterIdButton } from "@/components/identity-clusters/CopyClusterIdButton";
import {
  ACTION_LABEL,
  TIER_BADGE_VARIANT,
  TIER_SHORT_LABEL,
  confidenceBadgeVariant,
  confidenceLabel,
  deriveTier,
  formatSource,
  truncateClusterId,
} from "@/lib/identity-cluster-labels";

export interface ClusterListItem {
  clusterId: string;
  emailHash: string | null;
  primaryEmail?: string | null;
  nameSlug: string | null;
  dobYear: number | null;
  genderNormalized: "male" | "female" | "other" | null;
  confidence: number;
  source: string;
  linkedAthleteRecords: Array<{
    mysql_race_id: number;
    athletes_id: number;
    bib_number: string | null;
    fullName: string | null;
    raceName?: string;
    bibNumber?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  items: ClusterListItem[];
  techMode: boolean;
}

export function IdentityClusterTable({ items, techMode }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">ID hồ sơ</TableHead>
            <TableHead className="text-left">Mức độ tin cậy</TableHead>
            <TableHead className="text-left">Email / Tên</TableHead>
            <TableHead className="text-right">Số giải</TableHead>
            <TableHead className="text-left">Cập nhật</TableHead>
            {techMode && (
              <>
                <TableHead className="text-left">UUID đầy đủ</TableHead>
                <TableHead className="text-left">Source</TableHead>
              </>
            )}
            <TableHead className="text-right">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => (
            <ClusterRow key={c.clusterId} cluster={c} techMode={techMode} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClusterRow({
  cluster,
  techMode,
}: {
  cluster: ClusterListItem;
  techMode: boolean;
}) {
  const tier = deriveTier(cluster);
  const displayIdentity =
    cluster.primaryEmail ?? cluster.nameSlug ?? "Hồ sơ ẩn danh";
  const linkedCount = cluster.linkedAthleteRecords.length;
  const linkedBadgeVariant =
    linkedCount >= 10 ? "green" : linkedCount >= 5 ? "blue" : "outline";

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-stone-700">
            {truncateClusterId(cluster.clusterId)}
          </span>
          <CopyClusterIdButton clusterId={cluster.clusterId} />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant={TIER_BADGE_VARIANT[tier]}
            title={`Độ tin cậy: ${cluster.confidence.toFixed(2)} (${tier} - ${formatSource(cluster.source)})`}
          >
            {TIER_SHORT_LABEL[tier]}
          </Badge>
          <Badge
            variant={confidenceBadgeVariant(cluster.confidence)}
            title={`Độ tin cậy: ${cluster.confidence.toFixed(2)}`}
          >
            {confidenceLabel(cluster.confidence)}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="max-w-xs">
        <div
          className="truncate text-sm text-stone-900"
          title={displayIdentity}
        >
          {displayIdentity}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Badge variant={linkedBadgeVariant}>{linkedCount}</Badge>
      </TableCell>
      <TableCell className="text-sm text-stone-600">
        {formatRelativeTime(cluster.updatedAt)}
      </TableCell>
      {techMode && (
        <>
          <TableCell>
            <span className="font-mono text-xs text-stone-500">
              {cluster.clusterId}
            </span>
          </TableCell>
          <TableCell>
            <span className="font-mono text-xs text-stone-500">
              {cluster.source}
            </span>
          </TableCell>
        </>
      )}
      <TableCell className="text-right">
        <Link
          href={`/athletes/identity-clusters/${cluster.clusterId}`}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          <span>{ACTION_LABEL.viewDetail}</span>
          <ChevronRight className="size-3.5" />
        </Link>
      </TableCell>
    </TableRow>
  );
}

/**
 * Simple relative-time formatter VN — avoids extra dep on date-fns/locale.
 * For longer periods falls back to absolute Date string vi-VN.
 */
function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}
