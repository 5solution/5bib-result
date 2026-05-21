/**
 * F-049 — Cluster summary card cho detail page header.
 *
 * BR-49-10 Section 1 — header với email full + tier badge + confidence
 * traffic light + linked records count + tech-mode raw fields.
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { CopyClusterIdButton } from "@/components/identity-clusters/CopyClusterIdButton";
import {
  TIER_BADGE_VARIANT,
  TIER_LABEL,
  confidenceBadgeVariant,
  confidenceLabel,
  deriveTier,
  formatGender,
  formatSource,
  truncateClusterId,
} from "@/lib/identity-cluster-labels";

export interface ClusterSummary {
  clusterId: string;
  emailHash: string | null;
  /** F-049 — full email exposed for admin (BR-49-02 OVERRIDE). Field may not exist if backend doesn't include yet. */
  primaryEmail?: string | null;
  nameSlug: string | null;
  dobYear: number | null;
  genderNormalized: "male" | "female" | "other" | null;
  confidence: number;
  source: string;
  moderatedBy: string | null;
  moderatedAt: string | null;
  splitFromClusterId: string | null;
  createdAt: string;
  updatedAt: string;
  linkedAthleteRecordsCount: number;
}

interface Props {
  cluster: ClusterSummary;
  techMode: boolean;
}

export function ClusterSummaryCard({ cluster, techMode }: Props) {
  const tier = deriveTier(cluster);
  const tierLabel = TIER_LABEL[tier];
  const confVariant = confidenceBadgeVariant(cluster.confidence);
  const confText = confidenceLabel(cluster.confidence);

  // Fallback display name when no email — show name slug then fallback
  const displayIdentity =
    cluster.primaryEmail ??
    (cluster.nameSlug ? cluster.nameSlug : "Hồ sơ ẩn danh (chưa định danh được)");

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="font-mono text-sm text-stone-700">
              {truncateClusterId(cluster.clusterId)}
            </h2>
            <CopyClusterIdButton clusterId={cluster.clusterId} />
          </div>
          <h1
            className="break-all text-2xl font-bold text-stone-900"
            title={displayIdentity}
          >
            {displayIdentity}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant={TIER_BADGE_VARIANT[tier]}
              title={`Độ tin cậy: ${cluster.confidence.toFixed(2)} (${tier} - ${formatSource(cluster.source)})`}
            >
              {tierLabel}
            </Badge>
            <Badge
              variant={confVariant}
              title={`Độ tin cậy: ${cluster.confidence.toFixed(2)} (${tier} - ${formatSource(cluster.source)})`}
            >
              {confText}
            </Badge>
            <span className="text-sm text-stone-600">
              {cluster.linkedAthleteRecordsCount} giải đã liên kết
            </span>
          </div>
        </div>
      </div>

      {/* Meta info row */}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-stone-100 pt-4 text-sm md:grid-cols-3">
        <MetaItem
          label="Năm sinh"
          value={cluster.dobYear ? String(cluster.dobYear) : "—"}
        />
        <MetaItem
          label="Giới tính"
          value={formatGender(cluster.genderNormalized)}
        />
        <MetaItem
          label="Tạo lúc"
          value={new Date(cluster.createdAt).toLocaleString("vi-VN")}
        />
        {cluster.moderatedBy && (
          <>
            <MetaItem label="Người moderation" value={cluster.moderatedBy} mono />
            <MetaItem
              label="Moderation lúc"
              value={
                cluster.moderatedAt
                  ? new Date(cluster.moderatedAt).toLocaleString("vi-VN")
                  : "—"
              }
            />
          </>
        )}
        {cluster.splitFromClusterId && (
          <MetaItem
            label="Tách từ hồ sơ"
            value={truncateClusterId(cluster.splitFromClusterId)}
            mono
          />
        )}
      </dl>

      {/* Tech mode — raw fields */}
      {techMode && (
        <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Thông tin kỹ thuật
          </h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs md:grid-cols-2">
            <MetaItem
              label="Cluster UUID đầy đủ"
              value={cluster.clusterId}
              mono
            />
            <MetaItem
              label="emailHash (SHA256 12 ký tự đầu)"
              value={
                cluster.emailHash
                  ? cluster.emailHash.substring(0, 12) + "…"
                  : "—"
              }
              mono
            />
            <MetaItem
              label="nameSlug"
              value={cluster.nameSlug ?? "—"}
              mono
            />
            <MetaItem
              label="Source"
              value={cluster.source}
              mono
            />
            <MetaItem
              label="Confidence (raw)"
              value={cluster.confidence.toFixed(4)}
              mono
            />
            <MetaItem
              label="Tier (suy diễn)"
              value={tier}
              mono
            />
          </dl>
        </div>
      )}
    </section>
  );
}

function MetaItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-stone-500">
        {label}
      </dt>
      <dd className={`mt-0.5 ${mono ? "font-mono text-xs" : "text-sm"}`}>
        {value}
      </dd>
    </div>
  );
}
