"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSupplyPlanByCategory } from "@/lib/team-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ExternalLink } from "lucide-react";

// v1.8 — Per-team supply view. Read-only snapshot; full edit on event-wide
// "Kế hoạch vật tư" tab. Uses supply-overview filtered to this category.

interface Row {
  item_id: number;
  item_name: string;
  unit: string;
  requested_qty: number;
  fulfilled_qty: number | null;
  gap_qty: number | null;
  allocated_qty: number;
  confirmed_qty: number;
}

export default function TeamSupplyPage(): React.ReactElement {
  const params = useParams<{ eventId: string; teamId: string }>();
  const eventId = Number(params.eventId);
  const teamId = Number(params.teamId);
  const { token } = useAuth();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    try {
      setError(null);
      setRows(await getSupplyPlanByCategory(token, eventId, teamId));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!rows) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="size-5 text-gray-400" />
            Vật tư của team
          </h2>
          <p className="text-xs text-gray-500">
            Tổng hợp số lượng team đã yêu cầu, planner duyệt, và đã phân bổ
            xuống trạm. Leader điền đơn hàng qua portal của họ.
          </p>
        </div>
        <Link
          href={`/team-management/${eventId}/supply`}
          className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          Mở Kế hoạch vật tư tổng <ExternalLink className="size-3" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-8 text-center text-sm text-gray-500">
          Team chưa có đơn hàng vật tư nào. Leader tạo đơn tại portal của họ.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Vật tư</th>
                <th className="px-3 py-2 text-right font-medium">Yêu cầu</th>
                <th className="px-3 py-2 text-right font-medium">Duyệt</th>
                <th className="px-3 py-2 text-right font-medium">Chênh</th>
                <th className="px-3 py-2 text-right font-medium">Đã phân bổ</th>
                <th className="px-3 py-2 text-right font-medium">Xác nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const gap = r.gap_qty;
                const gapColor =
                  gap == null
                    ? "text-gray-400"
                    : gap === 0
                    ? "text-emerald-700"
                    : gap > 0
                    ? "text-amber-700"
                    : "text-red-700";
                return (
                  <tr key={r.item_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.item_name}
                      <span className="ml-1 text-xs text-gray-400">
                        ({r.unit})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">
                      {r.requested_qty}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">
                      {r.fulfilled_qty ?? "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono ${gapColor}`}
                    >
                      {gap == null ? "—" : gap > 0 ? `+${gap}` : gap}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-blue-700">
                      {r.allocated_qty}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">
                      {r.confirmed_qty}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border bg-blue-50 border-blue-200 p-3 text-xs text-blue-900">
        <strong>Ghi chú:</strong> Planner sửa số "Duyệt" tại tab{" "}
        <Link
          href={`/team-management/${eventId}/supply`}
          className="underline hover:no-underline"
        >
          Kế hoạch vật tư
        </Link>{" "}
        (top-level). Phân bổ xuống từng trạm thực hiện trong menu "Vật tư tại
        trạm" của mỗi trạm ở tab{" "}
        <Link
          href={`/team-management/${eventId}/teams/${teamId}/stations`}
          className="underline hover:no-underline"
        >
          Trạm
        </Link>
        .
      </div>
    </div>
  );
}
