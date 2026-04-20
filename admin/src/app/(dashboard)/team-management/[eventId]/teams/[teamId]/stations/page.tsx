"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listStationsByCategory,
  createStation,
  updateStation,
  deleteStation,
  updateStationStatus,
  getTeamCategory,
  type CreateStationInput,
  type Station,
  type StationStatus,
  type TeamCategory,
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

// v1.8 — Stations now belong to Team (category), not role. assignment_role
// (crew/volunteer) removed — supervisor/worker derives from role.is_leader_role.

const STATUS_LABELS: Record<
  StationStatus,
  { icon: string; text: string; bg: string; color: string }
> = {
  setup: { icon: "⚪", text: "Đang chuẩn bị", bg: "#f3f4f6", color: "#374151" },
  active: { icon: "🟢", text: "Đang hoạt động", bg: "#dcfce7", color: "#166534" },
  closed: { icon: "⚫", text: "Đã đóng", bg: "#e5e7eb", color: "#1f2937" },
};

export default function TeamStationsPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string; teamId: string }>();
  const eventId = Number(params.eventId);
  const teamId = Number(params.teamId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [stations, setStations] = useState<Station[] | null>(null);
  const [team, setTeam] = useState<TeamCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Station | null>(null);
  const [assignTarget, setAssignTarget] = useState<Station | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [list, t] = await Promise.all([
        listStationsByCategory(token, teamId),
        getTeamCategory(token, teamId).catch(() => null),
      ]);
      setStations(list);
      setTeam(t);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, teamId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/sign-in");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const totals = useMemo(() => {
    if (!stations) return { total: 0, noSup: 0, noWorker: 0 };
    let noSup = 0;
    let noWorker = 0;
    for (const s of stations) {
      if (!s.has_supervisor) noSup += 1;
      if (s.worker_count === 0) noWorker += 1;
    }
    return { total: stations.length, noSup, noWorker };
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

  async function handleStatusChange(
    id: number,
    status: StationStatus,
  ): Promise<void> {
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="size-5 text-blue-600" />
            Trạm của team
          </h2>
          <p className="text-xs text-gray-500">
            Các trạm do team{" "}
            <strong>{team?.name ?? `#${teamId}`}</strong> vận hành. Click "Gán
            người" để assign Leader/Crew/TNV của team vào trạm.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" /> Tạo trạm mới
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
            <Plus className="mr-2 size-4" /> Tạo trạm mới
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((s) => {
              const statusCfg = STATUS_LABELS[s.status];
              const warning = !s.has_supervisor
                ? { text: "⚠️ Chưa có Supervisor", color: "#dc2626" }
                : s.worker_count === 0
                ? { text: "🟡 Chưa có Worker", color: "#b45309" }
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
                          if (
                            !e.currentTarget.parentElement?.contains(next)
                          ) {
                            setTimeout(
                              () =>
                                setOpenMenuId((cur) =>
                                  cur === s.id ? null : cur,
                                ),
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
                                onClick={() =>
                                  void handleStatusChange(s.id, st)
                                }
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
                            href={`/team-management/${eventId}/teams/${teamId}/stations/${s.id}/allocations`}
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
                    👑 Supervisor: {s.supervisor_count} · 👤 Worker:{" "}
                    {s.worker_count} người
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
              <b>Chưa có Supervisor:</b> {totals.noSup}
            </span>
            <span>
              <b>Chưa có Worker:</b> {totals.noWorker}
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
        teamId={teamId}
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
  teamId,
}: {
  open: boolean;
  target: Station | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  teamId: number;
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
        await createStation(token, teamId, form);
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
                    gps_lat:
                      e.target.value === "" ? null : Number(e.target.value),
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
                    gps_lng:
                      e.target.value === "" ? null : Number(e.target.value),
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
