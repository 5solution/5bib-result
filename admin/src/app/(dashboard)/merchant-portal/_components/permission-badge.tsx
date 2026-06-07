"use client";

/**
 * F-069 M3 — Render permissions array thành badge VN (Display Convention).
 */
import { Badge } from "@/components/ui/badge";
import { formatPermission } from "@/lib/merchant-portal-labels";

export function PermissionBadges({ permissions }: { permissions: string[] }) {
  if (!permissions || permissions.length === 0) {
    return <span className="text-xs text-[var(--text-muted,#78716C)]">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {permissions.map((p) => (
        <Badge
          key={p}
          variant={p === "revenue_report" ? "default" : "secondary"}
        >
          {formatPermission(p)}
        </Badge>
      ))}
    </div>
  );
}
