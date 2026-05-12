"use client";

/**
 * F-028 Phase 2 — Top 10 contracts profit DESC.
 */
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import {
  formatVnd,
  formatMargin,
  type DashboardContractItem,
} from "@/lib/finance-api";

export function TopProfitTable({
  items,
  loading,
}: {
  items: DashboardContractItem[];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="size-4 text-emerald-600" />
          Top 10 HĐ lãi cao nhất
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có hợp đồng nào trong khoảng thời gian này
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-stone-500">
                <tr>
                  <th className="py-2 pr-2 text-left">#</th>
                  <th className="py-2 pr-2 text-left">Mã HĐ</th>
                  <th className="py-2 pr-2 text-left">Đối tác</th>
                  <th className="py-2 pr-2 text-right">Doanh thu</th>
                  <th className="py-2 pr-2 text-right">Lãi</th>
                  <th className="py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr
                    key={it.contractId}
                    className="border-b last:border-b-0 hover:bg-stone-50"
                  >
                    <td className="py-2 pr-2 tabular-nums text-stone-500">{idx + 1}</td>
                    <td className="py-2 pr-2">
                      <Link
                        href={`/finance/contracts/${it.contractId}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {it.contractNumber ?? "(DRAFT)"}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 max-w-[180px] truncate text-stone-700">
                      {it.partnerName ?? "—"}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {formatVnd(it.revenue)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums font-semibold text-emerald-700">
                      {formatVnd(it.profit)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMargin(it.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
