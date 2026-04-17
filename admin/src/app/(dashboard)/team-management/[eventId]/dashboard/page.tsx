"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getDashboard,
  upsertShirtStock,
  type DashboardResponse,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
type ShirtSize = (typeof SHIRT_SIZES)[number];

interface StockEditRow {
  size: ShirtSize;
  quantity_planned: number;
  quantity_ordered: number;
  quantity_received: number;
}

export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setData(await getDashboard(token, eventId, 1, 100));
      setRefreshedAt(new Date());
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!token) return;
    void load();
    const timer = setInterval(() => {
      void load();
    }, 30_000);
    return () => clearInterval(timer);
  }, [token, load]);

  if (authLoading || !isAuthenticated || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {data.event_name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Tự động làm mới mỗi 30s ·{" "}
            {refreshedAt ? refreshedAt.toLocaleTimeString("vi-VN") : "—"}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void load();
          }}
        >
          Làm mới
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <KpiRow data={data} />
      <HeadcountAndShirtSizes data={data} />
      <ShirtStockEditor eventId={eventId} data={data} onSaved={load} />
      <PeopleTable data={data} eventId={eventId} />
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "ok" | "warn" | "bad";
}): React.ReactElement {
  const toneCls =
    tone === "warn"
      ? "border-orange-500/30 bg-orange-500/5"
      : tone === "bad"
        ? "border-red-500/30 bg-red-500/5"
        : "";
  return (
    <div className={`rounded-lg border p-4 ${toneCls}`}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint ? (
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      ) : null}
    </div>
  );
}

function KpiRow({ data }: { data: DashboardResponse }): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard label="Teams" value={data.total_roles} hint="Có người đã duyệt" />
      <KpiCard label="Đã duyệt" value={data.total_approved} />
      <KpiCard
        label="Check-in"
        value={`${data.total_checked_in}/${data.total_approved}`}
        hint={`${data.checkin_rate}%`}
      />
      <KpiCard label="Đã ký HĐ" value={data.total_contract_signed} tone="ok" />
      <KpiCard
        label="Chưa ký HĐ"
        value={data.total_contract_unsigned}
        tone={data.total_contract_unsigned > 0 ? "warn" : undefined}
      />
      <KpiCard label="Đã thanh toán" value={data.total_paid} />
    </div>
  );
}

function HeadcountAndShirtSizes({
  data,
}: {
  data: DashboardResponse;
}): React.ReactElement {
  const maxHeadcount = Math.max(...data.by_role.map((r) => r.headcount), 1);
  const maxShirt = Math.max(...data.shirt_sizes.map((r) => r.count), 1);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Headcount theo team</h2>
        <div className="space-y-2">
          {data.by_role.map((row) => (
            <div key={row.role_id}>
              <div className="flex justify-between text-xs mb-0.5">
                <span>{row.role_name}</span>
                <span className="font-mono">
                  {row.checked_in}/{row.headcount}
                </span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(row.headcount / maxHeadcount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Phân bổ size áo</h2>
        <div className="space-y-2">
          {data.shirt_sizes.map((row) => (
            <div key={row.size ?? "null"}>
              <div className="flex justify-between text-xs mb-0.5">
                <span>{row.size ?? "Chưa điền"}</span>
                <span className="font-mono">{row.count}</span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-orange-500"
                  style={{ width: `${(row.count / maxShirt) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShirtStockEditor({
  eventId,
  data,
  onSaved,
}: {
  eventId: number;
  data: DashboardResponse;
  onSaved: () => Promise<void>;
}): React.ReactElement {
  const { token } = useAuth();
  const initialRows = useMemo<StockEditRow[]>(() => {
    const map = new Map<ShirtSize, StockEditRow>();
    for (const row of data.shirt_stock) {
      if (SHIRT_SIZES.includes(row.size as ShirtSize)) {
        map.set(row.size as ShirtSize, {
          size: row.size as ShirtSize,
          quantity_planned: row.planned,
          quantity_ordered: row.ordered,
          quantity_received: row.received,
        });
      }
    }
    return SHIRT_SIZES.map(
      (size) =>
        map.get(size) ?? {
          size,
          quantity_planned: 0,
          quantity_ordered: 0,
          quantity_received: 0,
        },
    );
  }, [data.shirt_stock]);

  const [rows, setRows] = useState<StockEditRow[]>(initialRows);
  const [saving, setSaving] = useState(false);
  useEffect(() => setRows(initialRows), [initialRows]);

  const registeredBySize = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of data.shirt_stock) map.set(r.size, r.registered);
    return map;
  }, [data.shirt_stock]);

  function updateCell(
    idx: number,
    key: keyof Omit<StockEditRow, "size">,
    val: number,
  ) {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [key]: val } : row)),
    );
  }

  async function handleSave(): Promise<void> {
    if (!token) return;
    setSaving(true);
    try {
      await upsertShirtStock(
        token,
        eventId,
        rows.map((r) => ({
          size: r.size,
          quantity_planned: r.quantity_planned,
          quantity_ordered: r.quantity_ordered,
          quantity_received: r.quantity_received,
        })),
      );
      toast.success("Đã lưu kế hoạch áo");
      await onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Kế hoạch kho áo</h2>
        <Button
          size="sm"
          onClick={() => {
            void handleSave();
          }}
          disabled={saving}
        >
          {saving ? "Đang lưu..." : "Lưu kế hoạch"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left py-2 font-medium">Size</th>
              <th className="text-right font-medium">Đăng ký</th>
              <th className="text-right font-medium">Kế hoạch</th>
              <th className="text-right font-medium">Đã đặt NCC</th>
              <th className="text-right font-medium">Đã nhận</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const registered = registeredBySize.get(row.size) ?? 0;
              const underPlan = row.quantity_planned < registered;
              const underOrdered = row.quantity_ordered < row.quantity_planned;
              return (
                <tr key={row.size} className="border-b last:border-b-0">
                  <td className="py-2 font-medium">{row.size}</td>
                  <td className="text-right font-mono">
                    {underPlan ? (
                      <span className="text-red-500">{registered} 🔴</span>
                    ) : (
                      registered
                    )}
                  </td>
                  <td className="text-right">
                    <Input
                      type="number"
                      min={0}
                      value={row.quantity_planned}
                      onChange={(e) =>
                        updateCell(
                          idx,
                          "quantity_planned",
                          Number(e.target.value) || 0,
                        )
                      }
                      className="h-8 w-20 text-right"
                    />
                  </td>
                  <td className="text-right">
                    <Input
                      type="number"
                      min={0}
                      value={row.quantity_ordered}
                      onChange={(e) =>
                        updateCell(
                          idx,
                          "quantity_ordered",
                          Number(e.target.value) || 0,
                        )
                      }
                      className={`h-8 w-20 text-right ${underOrdered ? "border-yellow-500" : ""}`}
                    />
                  </td>
                  <td className="text-right">
                    <Input
                      type="number"
                      min={0}
                      value={row.quantity_received}
                      onChange={(e) =>
                        updateCell(
                          idx,
                          "quantity_received",
                          Number(e.target.value) || 0,
                        )
                      }
                      className="h-8 w-20 text-right"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        🔴 Kế hoạch thấp hơn số đã đăng ký · viền vàng: chưa đặt đủ NCC
      </p>
    </div>
  );
}

function PeopleTable({
  data,
  eventId,
}: {
  data: DashboardResponse;
  eventId: number;
}): React.ReactElement {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="font-semibold">
          Nhân sự · {data.people.length}/{data.people_total}
        </h2>
        <Link
          href={`/team-management/${eventId}/registrations`}
          className="text-sm text-primary hover:underline"
        >
          Xem đầy đủ
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left py-2 px-3">Tên</th>
              <th className="text-left">Team</th>
              <th className="text-left">Size</th>
              <th className="text-left">Check-in</th>
              <th className="text-left">Hợp đồng</th>
              <th className="text-left px-3">Thanh toán</th>
            </tr>
          </thead>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0">
                <td className="py-2 px-3 font-medium">
                  <Link
                    href={`/team-management/${eventId}/registrations/${p.id}`}
                    className="hover:underline"
                  >
                    {p.full_name}
                  </Link>
                </td>
                <td>{p.role_name}</td>
                <td>{p.shirt_size ?? "—"}</td>
                <td>
                  {p.checked_in_at
                    ? `✅ ${new Date(p.checked_in_at).toLocaleTimeString("vi-VN")}`
                    : "⏳"}
                </td>
                <td>
                  {p.contract_status === "signed"
                    ? "✅ Đã ký"
                    : p.contract_status === "sent"
                      ? "⏳ Chờ ký"
                      : "—"}
                </td>
                <td className="px-3">
                  {p.payment_status === "paid" ? "✅" : "⏳"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
