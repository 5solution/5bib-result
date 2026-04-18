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
      // v1.4: dashboard aggregate now returns all 10 per-status counts +
      // total_suspicious inline, so no more companion fetches.
      const dash = await getDashboard(token, eventId, 1, 100);
      setData(dash);
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
          <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900">
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
        <div
          className="rounded-lg border p-3 text-sm"
          style={{
            background: "#fee2e2",
            borderColor: "#fca5a5",
            color: "#b91c1c",
          }}
        >
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
  title,
  value,
  valueColor,
  bgAccent,
  icon,
  pulse,
}: {
  title: string;
  value: React.ReactNode;
  valueColor: string;
  bgAccent: string;
  icon: string;
  pulse?: boolean;
}): React.ReactElement {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-1 transition-shadow hover:shadow-md relative"
      style={{
        background: bgAccent,
        borderColor: "#e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {pulse ? (
        <span
          aria-hidden
          className="absolute top-2 right-2 inline-block size-2 animate-pulse rounded-full"
          style={{ background: valueColor }}
        />
      ) : null}
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <p className="text-xs font-medium" style={{ color: "#6b7280" }}>
          {title}
        </p>
      </div>
      <p
        className="text-3xl font-bold tracking-tight tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * v1.4: 10-status funnel KPIs, ordered by workflow progression. Pending
 * and Nghi vấn cards pulse when > 0 so they catch the eye during race-day
 * triage. All values come from the dashboard aggregate — the backend fills
 * each field to 0 when missing, but we coalesce here for safety.
 */
function KpiRow({ data }: { data: DashboardResponse }): React.ReactElement {
  const pending = data.pending_approval ?? 0;
  const approved = data.approved ?? 0;
  const contractSent = data.contract_sent ?? 0;
  const contractSigned = data.contract_signed ?? 0;
  const qrSent = data.qr_sent ?? 0;
  const checkedIn = data.checked_in ?? 0;
  const completed = data.completed ?? 0;
  const waitlisted = data.waitlisted ?? 0;
  const suspicious = data.total_suspicious ?? 0;
  const total = data.total ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 stagger-in">
      <KpiCard
        title="Chờ duyệt"
        value={pending}
        valueColor="#b45309"
        bgAccent="#fffbeb"
        icon="⏳"
        pulse={pending > 0}
      />
      <KpiCard
        title="Đã duyệt"
        value={approved}
        valueColor="#15803d"
        bgAccent="#f0fdf4"
        icon="✅"
      />
      <KpiCard
        title="Chờ ký HĐ"
        value={contractSent}
        valueColor="#1d4ed8"
        bgAccent="#eff6ff"
        icon="📨"
      />
      <KpiCard
        title="Đã ký HĐ"
        value={contractSigned}
        valueColor="#065f46"
        bgAccent="#ecfdf5"
        icon="📝"
      />
      <KpiCard
        title="Có QR"
        value={qrSent}
        valueColor="#2563eb"
        bgAccent="#eff6ff"
        icon="📲"
      />
      <KpiCard
        title="Checked-in"
        value={checkedIn}
        valueColor="#1d4ed8"
        bgAccent="#dbeafe"
        icon="🎫"
      />
      <KpiCard
        title="Hoàn thành"
        value={completed}
        valueColor="#5b21b6"
        bgAccent="#ede9fe"
        icon="🏁"
      />
      <KpiCard
        title="Waitlist"
        value={waitlisted}
        valueColor="#6b7280"
        bgAccent="#f9fafb"
        icon="🕒"
      />
      <KpiCard
        title="Nghi vấn"
        value={suspicious}
        valueColor="#b91c1c"
        bgAccent="#fef2f2"
        icon="⚠️"
        pulse={suspicious > 0}
      />
      <KpiCard
        title="Tổng"
        value={total}
        valueColor="#111827"
        bgAccent="#ffffff"
        icon="∑"
      />
    </div>
  );
}

function HeadcountBar({
  roleName,
  filled,
  total,
}: {
  roleName: string;
  filled: number;
  total: number;
}): React.ReactElement {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const isEmpty = filled === 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="w-44 text-sm text-gray-700 truncate font-medium">
        {roleName}
      </span>
      <div className="flex-1 h-2.5 rounded-full" style={{ background: "#f3f4f6" }}>
        <div
          className="h-2.5 rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isEmpty ? "transparent" : "#2563eb",
          }}
        />
      </div>
      <span
        className="w-14 text-right text-sm font-mono font-semibold"
        style={{ color: filled > 0 ? "#1d4ed8" : "#9ca3af" }}
      >
        {filled}/{total || "∞"}
      </span>
      {filled > 0 ? (
        <span className="w-10 text-right text-xs text-gray-400">{pct}%</span>
      ) : (
        <span className="w-10" />
      )}
    </div>
  );
}

function SizeBar({
  size,
  count,
  max,
}: {
  size: string;
  count: number;
  max: number;
}): React.ReactElement {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-10 text-sm font-bold font-mono text-gray-800">
        {size}
      </span>
      <div
        className="flex-1 h-2 rounded-full"
        style={{ background: "#f3f4f6" }}
      >
        <div
          className="h-2 rounded-full"
          style={{ width: `${pct}%`, background: "#f59e0b" }}
        />
      </div>
      <span className="w-6 text-right text-sm font-mono font-semibold text-gray-700">
        {count}
      </span>
    </div>
  );
}

function HeadcountAndShirtSizes({
  data,
}: {
  data: DashboardResponse;
}): React.ReactElement {
  const maxShirt = Math.max(...data.shirt_sizes.map((r) => r.count), 1);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div
        className="rounded-xl border p-5"
        style={{ background: "#ffffff", borderColor: "#e5e7eb" }}
      >
        <h2 className="font-semibold mb-3 text-gray-900">Headcount theo team</h2>
        <div>
          {data.by_role.map((row) => (
            <HeadcountBar
              key={row.role_id}
              roleName={row.role_name}
              filled={row.checked_in}
              total={row.headcount}
            />
          ))}
        </div>
      </div>
      <div
        className="rounded-xl border p-5"
        style={{ background: "#ffffff", borderColor: "#e5e7eb" }}
      >
        <h2 className="font-semibold mb-3 text-gray-900">Phân bổ size áo</h2>
        <div>
          {data.shirt_sizes.map((row) => (
            <SizeBar
              key={row.size ?? "null"}
              size={row.size ?? "Chưa điền"}
              count={row.count}
              max={maxShirt}
            />
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
    <div
      className="rounded-xl border p-5"
      style={{ background: "#ffffff", borderColor: "#e5e7eb" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Kế hoạch kho áo</h2>
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
                <tr
                  key={row.size}
                  className="border-b last:border-b-0"
                  style={underPlan ? { background: "#fee2e2" } : undefined}
                >
                  <td className="py-2 font-medium">{row.size}</td>
                  <td className="text-right font-mono">
                    {underPlan ? (
                      <span className="inline-flex items-center gap-1.5 text-red-600">
                        {registered}
                        <span
                          aria-label="Kế hoạch thiếu"
                          className="inline-block size-2 rounded-full bg-red-600"
                        />
                      </span>
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
                      className={`h-8 w-20 text-right ${underOrdered ? "border-amber-500" : ""}`}
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
      <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-red-600" />
          Kế hoạch thấp hơn số đã đăng ký
        </span>
        <span>·</span>
        <span>viền amber: chưa đặt đủ NCC</span>
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
    <div
      className="rounded-xl border"
      style={{ background: "#ffffff", borderColor: "#e5e7eb" }}
    >
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="font-semibold text-gray-900">
          Nhân sự · {data.people.length}/{data.people_total}
        </h2>
        <Link
          href={`/team-management/${eventId}/registrations`}
          className="text-sm font-medium"
          style={{ color: "#1d4ed8" }}
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
              <tr key={p.id} className="border-b last:border-b-0 result-row-hover">
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
