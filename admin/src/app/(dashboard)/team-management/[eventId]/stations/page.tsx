"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listAllStationsInEvent,
  createStation,
  listTeamRoles,
  type CreateStationInput,
  type Station,
  type StationStatus,
  type TeamRole,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";

/**
 * v1.6 — Event-wide Trạm list.
 *
 * Previous UX forced admin to pick a role before seeing stations; Danny
 * found that confusing ("sao chọn trạm lại phải đi qua vai trò?"). This
 * page flat-lists every station in the event, groups by role, and lets
 * admin filter + create inline. Click through to the per-role detail page
 * for assignment/supply editing.
 */

const STATUS_LABELS: Record<
  StationStatus,
  { icon: string; text: string; bg: string; color: string }
> = {
  setup: { icon: "⚪", text: "Đang chuẩn bị", bg: "#f3f4f6", color: "#374151" },
  active: { icon: "🟢", text: "Đang hoạt động", bg: "#dcfce7", color: "#166534" },
  closed: { icon: "⚫", text: "Đã đóng", bg: "#e5e7eb", color: "#1f2937" },
};

export default function EventStationsPage(): React.ReactElement {
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRoleId, setFilterRoleId] = useState<number | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        listAllStationsInEvent(token, eventId),
        listTeamRoles(token, eventId),
      ]);
      setStations(s);
      // Filter out leader roles — stations only meaningful for crew/TNV roles.
      setRoles(r.filter((role) => !role.is_leader_role));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filterRoleId === "all") return stations;
    return stations.filter((s) => s.role_id === filterRoleId);
  }, [stations, filterRoleId]);

  const groupedByRole = useMemo(() => {
    const groups = new Map<number, { role_name: string; stations: Station[] }>();
    for (const s of filtered) {
      const key = s.role_id;
      const existing = groups.get(key);
      if (existing) {
        existing.stations.push(s);
      } else {
        groups.set(key, {
          role_name: s.role_name ?? `Role #${s.role_id}`,
          stations: [s],
        });
      }
    }
    return Array.from(groups.entries()).sort((a, b) =>
      a[1].role_name.localeCompare(b[1].role_name, "vi"),
    );
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900">
            🗺️ Trạm
          </h2>
          <p className="text-sm text-gray-500">
            Tất cả trạm trong sự kiện · nhóm theo team · click để xem chi tiết + gán
            nhân sự.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={roles.length === 0}
        >
          <Plus className="mr-1 size-4" /> Tạo trạm mới
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm">Lọc theo team:</Label>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={filterRoleId}
          onChange={(e) =>
            setFilterRoleId(e.target.value === "all" ? "all" : Number(e.target.value))
          }
        >
          <option value="all">Tất cả ({stations.length})</option>
          {roles.map((r) => {
            const count = stations.filter((s) => s.role_id === r.id).length;
            return (
              <option key={r.id} value={r.id}>
                {r.role_name} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : groupedByRole.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-8 text-center text-sm text-gray-500">
          Chưa có trạm nào.{" "}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={roles.length === 0}
            className="text-blue-600 hover:underline disabled:text-gray-400"
          >
            Tạo trạm đầu tiên →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByRole.map(([roleId, group]) => (
            <section key={roleId}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900">
                  {group.role_name}{" "}
                  <span className="text-gray-500 font-normal">
                    · {group.stations.length} trạm
                  </span>
                </h3>
                <Link
                  href={`/team-management/${eventId}/roles/${roleId}/stations`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Quản lý trạm team này →
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.stations.map((s) => (
                  <StationCard key={s.id} eventId={eventId} station={s} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <CreateStationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        eventId={eventId}
        onCreated={() => {
          setCreateOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function StationCard({
  eventId,
  station,
}: {
  eventId: number;
  station: Station;
}): React.ReactElement {
  const s = STATUS_LABELS[station.status];
  return (
    <Link
      href={`/team-management/${eventId}/roles/${station.role_id}/stations`}
      className="group block rounded-lg border bg-white p-3 hover:border-blue-400 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-medium text-gray-900 truncate">
            <MapPin className="size-4 text-gray-400 shrink-0" />
            {station.station_name}
          </p>
          {station.location_description ? (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {station.location_description}
            </p>
          ) : null}
        </div>
        <ExternalLink className="size-4 text-gray-300 group-hover:text-blue-500 shrink-0" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: s.bg, color: s.color }}
        >
          {s.icon} {s.text}
        </span>
        <span className="text-xs text-gray-500">
          👑 {station.crew_count} · 👤 {station.volunteer_count}
        </span>
      </div>
    </Link>
  );
}

function CreateStationDialog({
  open,
  onOpenChange,
  roles,
  eventId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roles: TeamRole[];
  eventId: number;
  onCreated: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const [roleId, setRoleId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateStationInput>({
    station_name: "",
    location_description: "",
    sort_order: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && roles.length > 0 && roleId == null) setRoleId(roles[0].id);
  }, [open, roles, roleId]);

  async function handleSubmit(): Promise<void> {
    if (!token || !roleId) return;
    if (!form.station_name.trim()) {
      toast.error("Tên trạm bắt buộc");
      return;
    }
    setSaving(true);
    try {
      await createStation(token, eventId, roleId, form);
      toast.success("Đã tạo trạm");
      setForm({ station_name: "", location_description: "", sort_order: 0 });
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo trạm mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Team/Role *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={roleId ?? ""}
              onChange={(e) => setRoleId(Number(e.target.value))}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.role_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Tên trạm *</Label>
            <Input
              value={form.station_name}
              onChange={(e) =>
                setForm({ ...form, station_name: e.target.value })
              }
              placeholder="Trạm Nước Km5"
            />
          </div>
          <div>
            <Label>Địa điểm (tuỳ chọn)</Label>
            <Textarea
              rows={2}
              value={form.location_description ?? ""}
              onChange={(e) =>
                setForm({ ...form, location_description: e.target.value })
              }
              placeholder="Cạnh cột km5, QL1A, Nghệ An"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>GPS Lat (tuỳ chọn)</Label>
              <Input
                type="number"
                step="0.0000001"
                value={form.gps_lat ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    gps_lat: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <div>
              <Label>GPS Lng (tuỳ chọn)</Label>
              <Input
                type="number"
                step="0.0000001"
                value={form.gps_lng ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    gps_lng: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
          <a
            href="https://www.google.com/maps"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            📍 Mở Google Maps để lấy toạ độ →
          </a>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={saving || !form.station_name.trim() || !roleId}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {saving ? "Đang tạo..." : "Tạo trạm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
