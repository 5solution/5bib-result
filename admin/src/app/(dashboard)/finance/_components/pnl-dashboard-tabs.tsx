"use client";

/**
 * F-028 Phase 2 — Tabs 3 chiều: Time (default) / Type / Partner.
 *
 * Hiển thị bảng buckets aggregated, có nút "Xem chi tiết" cho Partner /
 * Type drill-down (Phase 2 chỉ scroll xuống top-profit table — drill-down
 * real defer Phase 3).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  formatVnd,
  formatMargin,
  type DashboardGroupBucket,
  type DashboardGroupBy,
} from "@/lib/finance-api";

function BucketTable({
  buckets,
  headerLabel,
  loading,
}: {
  buckets: DashboardGroupBucket[];
  headerLabel: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 px-1 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }
  if (buckets.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Chưa có dữ liệu trong khoảng thời gian này
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-xs text-stone-500">
          <tr>
            <th className="py-2 pr-2 text-left">{headerLabel}</th>
            <th className="py-2 pr-2 text-right">Số HĐ</th>
            <th className="py-2 pr-2 text-right">Doanh thu</th>
            <th className="py-2 pr-2 text-right">Chi phí</th>
            <th className="py-2 pr-2 text-right">Lãi/Lỗ</th>
            <th className="py-2 text-right">Margin TB</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key} className="border-b last:border-b-0 hover:bg-stone-50">
              <td className="py-2 pr-2 font-medium text-stone-800">{b.label}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{b.contractCount}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{formatVnd(b.totalRevenue)}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{formatVnd(b.totalCost)}</td>
              <td
                className={`py-2 pr-2 text-right tabular-nums font-semibold ${
                  b.totalProfit >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatVnd(b.totalProfit)}
              </td>
              <td className="py-2 text-right tabular-nums">{formatMargin(b.avgMargin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PnLDashboardTabs({
  byType,
  byPartner,
  byMonth,
  defaultTab = "month",
  onTabChange,
  loading,
}: {
  byType: DashboardGroupBucket[];
  byPartner: DashboardGroupBucket[];
  byMonth: DashboardGroupBucket[];
  defaultTab?: DashboardGroupBy;
  onTabChange?: (tab: DashboardGroupBy) => void;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Tổng hợp theo chiều</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          defaultValue={defaultTab}
          onValueChange={(v) => onTabChange?.(v as DashboardGroupBy)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="month">Theo thời gian</TabsTrigger>
            <TabsTrigger value="type">Theo loại HĐ</TabsTrigger>
            <TabsTrigger value="partner">Theo đối tác</TabsTrigger>
          </TabsList>
          <TabsContent value="month" className="mt-3">
            <BucketTable buckets={byMonth} headerLabel="Tháng" loading={loading} />
          </TabsContent>
          <TabsContent value="type" className="mt-3">
            <BucketTable buckets={byType} headerLabel="Loại HĐ" loading={loading} />
          </TabsContent>
          <TabsContent value="partner" className="mt-3">
            <BucketTable buckets={byPartner} headerLabel="Đối tác" loading={loading} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
