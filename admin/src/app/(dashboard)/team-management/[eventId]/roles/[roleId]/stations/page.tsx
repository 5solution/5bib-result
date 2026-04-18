"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listStations,
  createStation,
  updateStation,
  deleteStation,
  updateStationStatus,
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  MapPin,
  Pencil,
  Trash2,
  MoreVertical,
  Users,
  ExternalLink,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { AssignPersonnelModal } from "./_assign-personnel-modal";

const STATUS_LABELS: Record<StationStatus, { icon: string; text: string; bg: string; color: string }> = {
  setup: { icon: "⚪", text: "Đang chuẩn bị", bg: "#f3f4f6", color: "#374151" },
  active: { icon: "🟢", text: "Đang hoạt động", bg: "#dcfce7", color: "#166534" },
  closed: { icon: "⚫", text: "Đã đóng", bg: "#e5e7eb", color: "#1f2937" },
};

export default function StationsPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string; roleId: string }>();
  const eventId = Number(params.eventId);
  const roleId = Number(params.roleId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [stations, setStations] = useState<Station[] | null>(null);
  const [role, setRole] = useState<TeamRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Station | null>(null);
  const [assignTarget, setAssignTarget] = useState<Station | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [list, roles] = await Promise.all([
        listStations(token, eventId, roleId),
        listTeamRoles(token, eventId),
      ]);
      setStations(list);
      setRole(roles.find((r) => r.id === roleId) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId, roleId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const totals = useMemo(() => {
    if (!stations) return { total: 0, noCrew: 0, noVol: 0 };
    let noCrew = 0;
    let noVol = 0;
    for (const s of stations) {
      if (!s.has_crew) noCrew += 1;
      if (s.volunteer_count === 0) noVol += 1;
    }
    return { total: stations.length, noCrew, noVol };
  }, [stations]);

  async function handleDelete(id: number): Promise<void> {
    if (!token) return;
    if (!confirm("Xóa trạm này? Không thể hoàn tác.")) return;
    try {
      await deleteStation(token, id);
      toast.success("Đã xóa trạm");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleStatusChange(id: number, status: StationStatus): Promise<void> {
    if (!token) return;
    try {
      await updateStationStatus(token, id, status);
      toast.success("Đã cập nhật trạng thái");
      setOpenMenuId(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + title */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/team-management/${eventId}/roles`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Vai trò
          </Button>
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-gradient flex items-center gap-2">
          <MapPin className="size-6 sm:size-7 text-blue-600" />
          Quản lý Trạm — {role?.role_name ?? `Role #${roleId}`}
        </h1>
        <div className="flex-1" />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" /> Tạo Trạm Mới
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {stations === null ? (
        <Skeleton className="h-64" />
      ) : stations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <MapPin className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">
            Chưa có trạm. Tạo trạm đầu tiên.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" /> Tạo Trạm Mới
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((s) => {
              const statusCfg = STATUS_LABELS[s.status];
              const warning = !s.has_crew
                ? { text: "⚠️ Chưa có Crew", color: "#dc2626" }
                : s.volunteer_count === 0
                ? { text: "🟡 Chưa đủ người", color: "#b45309" }
                : { text: "✅ Đủ nhân sự", color: "#166534" };
              return (
                <div
                  key={s.id}
                  className="rounded-xl border bg-white p-4 space-y-3 card-hover relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📍</span>
                        <h3 className="font-bold text-base truncate">
                          {s.station_name}
                        </h3>
                      </div>
                      {s.location_description ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {s.location_description}
                        </p>
                      ) : null}
                    </div>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setOpenMenuId((cur) => (cur === s.id ? null : s.id))
                        }
                        onBlur={(e) => {
                          const next = e.relatedTarget as Node | null;
                          if (!e.currentTarget.parentElement?.contains(next)) {
                            setTimeout(
                              () => setOpenMenuId((cur) => (cur === s.id ? null : cur)),
                              150,
                            );
                          }
                        }}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                      {openMenuId === s.id ? (
                        <div
                          className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border bg-white shadow-lg py-1"
                          style={{ borderColor: "#e5e7eb" }}
                        >
                          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b">
                            Đổi trạng thái
                          </div>
                          {(Object.keys(STATUS_LABELS) as StationStatus[]).map(
                            (st) => (
                              <button
                                key={st}
                                type="button"
                                disabled={st === s.status}
                                onClick={() => void handleStatusChange(s.id, st)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {STATUS_LABELS[st].icon} Chuyển sang{" "}
                                {STATUS_LABELS[st].text}
                              </button>
                            ),
                          )}
                          <div className="border-t my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setEditTarget(s);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          >
                            <Pencil className="inline size-3.5 mr-1.5" />
                            Sửa trạm
                          </button>
                          <Link
                            href={`/team-management/${eventId}/roles/${roleId}/stations/${s.id}/allocations`}
                            onClick={() => setOpenMenuId(null)}
                            className="block px-3 py-2 text-sm hover:bg-muted"
                          >
                            <Package className="inline size-3.5 mr-1.5" />
                            Vật tư tại trạm
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              void handleDelete(s.id);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="inline size-3.5 mr-1.5" />
                            Xóa trạm
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge
                      style={{
                        background: statusCfg.bg,
                        color: statusCfg.color,
                        border: "none",
                      }}
                    >
                      {statusCfg.icon} {statusCfg.text}
                    </Badge>
                    {s.gps_lat && s.gps_lng ? (
                      <a
                        href={`https://www.google.com/maps?q=${s.gps_lat},${s.gps_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="size-3" /> GPS
                      </a>
                    ) : null}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    👑 Crew: {s.crew_count} · TNV: {s.volunteer_count} người
                  </div>
                  <div
                    className="text-xs font-medium"
                    style={{ color: warning.color }}
                  >
                    {warning.text}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => setAssignTarget(s)}
                    >
                      <Users className="mr-1.5 size-4" /> Gán người
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditTarget(s)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <b>Tổng:</b> {totals.total} trạm
            </span>
            <span>
              <b>Chưa có Crew:</b> {totals.noCrew}
            </span>
            <span>
              <b>Chưa có TNV:</b> {totals.noVol}
            </span>
          </div>
        </>
      )}

      <StationDialog
        open={createOpen || editTarget != null}
        target={editTarget}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        onSaved={() => {
          setCreateOpen(false);
          setEditTarget(null);
          void load();
        }}
        eventId={eventId}
        roleId={roleId}
      />

      <AssignPersonnelModal
        station={assignTarget}
        onOpenChange={(o) => {
          if (!o) setAssignTarget(null);
        }}
        onChanged={() => {
          void load();
        }}
      />
    </div>
  );
}

function StationDialog({
  open,
  target,
  onOpenChange,
  onSaved,
  eventId,
  roleId,
}: {
  open: boolean;
  target: Station | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  eventId: number;
  roleId: number;
}): React.ReactElement {
  const { token } = useAuth();
  const [form, setForm] = useState<CreateStationInput>({
    station_name: "",
    location_description: "",
    gps_lat: null,
    gps_lng: null,
    sort_order: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({
        station_name: target.station_name,
        location_description: target.location_description ?? "",
        gps_lat: target.gps_lat ? Number(target.gps_lat) : null,
        gps_lng: target.gps_lng ? Number(target.gps_lng) : null,
        sort_order: target.sort_order,
      });
    } else {
      setForm({
        station_name: "",
        location_description: "",
        gps_lat: null,
        gps_lng: null,
        sort_order: 0,
      });
    }
  }, [open, target]);

  async function handleSubmit(): Promise<void> {
    if (!token) return;
    if (!form.station_name.trim()) {
      toast.error("Tên trạm bắt buộc");
      return;
    }
    setSaving(true);
    try {
      if (target) {
        await updateStation(token, target.id, form);
        toast.success("Đã cập nhật trạm");
      } else {
        await createStation(token, eventId, roleId, form);
        toast.success("Đã tạo trạm");
      }
      onSaved();
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
          <DialogTitle>
            {target ? `Sửa trạm — ${target.station_name}` : "Tạo trạm mới"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên trạm *</Label>
            <Input
              placeholder="VD: Trạm Nước Km5"
              value={form.station_name}
              onChange={(e) =>
                setForm({ ...form, station_name: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Mô tả vị trí</Label>
            <Textarea
              placeholder="VD: Ngã ba Suối Vàng, sau cổng checkpoint CP1"
              value={form.location_description ?? ""}
              onChange={(e) =>
                setForm({ ...form, location_description: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>GPS Lat (tùy chọn)</Label>
              <Input
                type="number"
                step="any"
                placeholder="11.9404"
                value={form.gps_lat ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    gps_lat: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>GPS Lng (tùy chọn)</Label>
              <Input
                type="number"
                step="any"
                placeholder="108.4583"
                value={form.gps_lng ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    gps_lng: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <a
            href="https://www.google.com/maps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            📍 Mở Google Maps để lấy toạ độ
            <ExternalLink className="size-3" />
          </a>
          <div>
            <Label>Thứ tự hiển thị</Label>
            <Input
              type="number"
              value={form.sort_order ?? 0}
              onChange={(e) =>
                setForm({ ...form, sort_order: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {saving ? "Đang lưu..." : target ? "Lưu" : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
