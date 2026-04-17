"use client";

/**
 * Race-Ops Event detail page.
 *
 * Full feature set:
 *  - Event: status transition (DRAFT↔LIVE↔ENDED), archive
 *  - Teams: create/edit (all fields), assign leader, lock/unlock, archive
 *  - Users: create crew/tnv/leader, approve-with-team, reject via RejectReasonDialog
 *  - Supply: Orders (full lifecycle submit→approve→dispatch→receive + reject),
 *            Items (SKU CRUD), Aggregate (planning view)
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  opsEventsApi,
  opsTeamsApi,
  opsUsersApi,
  opsSupplyApi,
  opsCheckInsApi,
  opsTasksApi,
  opsIncidentsApi,
  type OpsEvent,
  type OpsTeam,
  type OpsUser,
  type OpsSupplyItem,
  type OpsSupplyOrder,
  type OpsCheckIn,
  type OpsTask,
  type OpsTaskStatus,
  type OpsIncident,
  type OpsIncidentPriority,
  type OpsIncidentStatus,
  type EventKpi,
  type SupplyAggregateLine,
  type UserQrBadge,
} from "@/lib/ops-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RejectReasonDialog } from "@/components/reject-reason-dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { Pagination, usePagedList } from "@/components/pagination";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Users,
  Package,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Trash2,
  Pencil,
  UserCog,
  Lock,
  Unlock,
  Archive,
  Send,
  Truck,
  PackageCheck,
  MapPin,
  ListTodo,
  AlertTriangle,
  Download,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab =
  | "overview"
  | "teams"
  | "users"
  | "checkins"
  | "tasks"
  | "incidents"
  | "supply";

const TABS: {
  key: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "overview", label: "Tổng quan", icon: ClipboardList },
  { key: "teams", label: "Teams", icon: ShieldCheck },
  { key: "users", label: "Nhân sự", icon: Users },
  { key: "checkins", label: "Check-in", icon: MapPin },
  { key: "tasks", label: "Tasks", icon: ListTodo },
  { key: "incidents", label: "Sự cố", icon: AlertTriangle },
  { key: "supply", label: "Vật tư", icon: Package },
];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  LIVE: "bg-green-100 text-green-700",
  ENDED: "bg-orange-100 text-orange-700",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  LIVE: "Live",
  ENDED: "Kết thúc",
};

export default function OpsEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const confirm = useConfirm();
  const eventId = params.id as string;
  const [tab, setTab] = useState<Tab>("overview");
  const [event, setEvent] = useState<OpsEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);

  const loadEvent = useCallback(async () => {
    if (!token || !eventId) return;
    try {
      const ev = await opsEventsApi.get(token, eventId);
      setEvent(ev);
    } catch (err) {
      toast.error(
        `Load event thất bại: ${err instanceof Error ? err.message : ""}`
      );
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  async function handleStatusChange(next: string | null) {
    if (!token || !event || !next || next === event.status) return;
    setStatusBusy(true);
    try {
      const updated = await opsEventsApi.update(token, event.id, {
        status: next,
      });
      setEvent(updated);
      toast.success(`Chuyển trạng thái: ${STATUS_LABEL[next] ?? next}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleArchive() {
    if (!token || !event) return;
    const ok = await confirm({
      title: "Archive event?",
      description: `"${event.name}" — thao tác này chỉ khả dụng khi DRAFT hoặc ENDED và không thể khôi phục từ UI.`,
      confirmLabel: "Archive",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await opsEventsApi.archive(token, event.id);
      toast.success("Đã archive event");
      router.push("/ops-events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Event không tồn tại
      </div>
    );
  }

  const canArchive = event.status === "DRAFT" || event.status === "ENDED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/ops-events")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(event.date).toLocaleDateString("vi-VN")} ·{" "}
            {event.location?.name}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("text-xs", STATUS_BADGE[event.status])}
        >
          {STATUS_LABEL[event.status] ?? event.status}
        </Badge>
        <Select
          value={event.status}
          onValueChange={handleStatusChange}
          disabled={statusBusy}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRAFT">Nháp</SelectItem>
            <SelectItem value="LIVE">Live</SelectItem>
            <SelectItem value="ENDED">Kết thúc</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleArchive}
          disabled={!canArchive}
          title={canArchive ? "" : "Chỉ archive được DRAFT / ENDED"}
        >
          <Archive className="mr-1 size-4" /> Archive
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab eventId={eventId} />}
      {tab === "teams" && <TeamsTab eventId={eventId} event={event} />}
      {tab === "users" && <UsersTab eventId={eventId} />}
      {tab === "checkins" && <CheckInsTab eventId={eventId} />}
      {tab === "tasks" && <TasksTab eventId={eventId} />}
      {tab === "incidents" && <IncidentsTab eventId={eventId} />}
      {tab === "supply" && <SupplyTab eventId={eventId} />}
    </div>
  );
}

/* ═══════════════════════════ Overview ═══════════════════════════ */

function OverviewTab({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const [kpi, setKpi] = useState<EventKpi | null>(null);

  useEffect(() => {
    if (!token) return;
    opsEventsApi
      .kpi(token, eventId)
      .then(setKpi)
      .catch(() => {});
  }, [token, eventId]);

  if (!kpi) return <Skeleton className="h-48 w-full" />;

  const cards = [
    { label: "Teams", value: kpi.total_teams, color: "text-blue-600" },
    {
      label: "TNV đăng ký",
      value: kpi.total_volunteers,
      color: "text-purple-600",
    },
    {
      label: "TNV đã duyệt",
      value: kpi.total_volunteers_approved,
      color: "text-green-600",
    },
    { label: "Crew", value: kpi.total_crew, color: "text-indigo-600" },
    {
      label: "Đã check-in",
      value: kpi.total_checked_in,
      color: "text-teal-600",
    },
    {
      label: "Đơn VT chờ duyệt",
      value: kpi.total_supply_orders_submitted,
      color: "text-orange-600",
    },
    {
      label: "Đơn VT đã duyệt",
      value: kpi.total_supply_orders_approved,
      color: "text-emerald-600",
    },
    {
      label: "Tasks pending",
      value: kpi.total_tasks_pending,
      color: "text-amber-600",
    },
    {
      label: "Incident mở",
      value: kpi.total_incidents_open,
      color: "text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border bg-card p-4 shadow-sm"
        >
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className={cn("mt-1 text-2xl font-bold", c.color)}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════ Teams ═══════════════════════════ */

interface TeamFormState {
  name: string;
  code: string;
  target_crew: string;
  target_tnv: string;
  color: string;
  station_ids: string[];
  tags: string;
  locked: boolean;
}

const EMPTY_TEAM_FORM: TeamFormState = {
  name: "",
  code: "",
  target_crew: "0",
  target_tnv: "0",
  color: "",
  station_ids: [],
  tags: "",
  locked: false,
};

function TeamsTab({ eventId, event }: { eventId: string; event: OpsEvent }) {
  const { token } = useAuth();
  const confirm = useConfirm();
  const [teams, setTeams] = useState<OpsTeam[]>([]);
  const [users, setUsers] = useState<OpsUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamFormState>(EMPTY_TEAM_FORM);
  const [saving, setSaving] = useState(false);

  // Leader dialog
  const [leaderOpen, setLeaderOpen] = useState(false);
  const [leaderTeam, setLeaderTeam] = useState<OpsTeam | null>(null);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>("__none__");
  const [leaderSaving, setLeaderSaving] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsTeamsApi.list(token, eventId);
      setTeams(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi load teams");
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  const loadLeaders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsUsersApi.list(token, eventId, {
        role: "ops_leader",
      });
      setUsers(res.items);
    } catch {
      /* non-critical */
    }
  }, [token, eventId]);

  useEffect(() => {
    loadTeams();
    loadLeaders();
  }, [loadTeams, loadLeaders]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_TEAM_FORM);
    setFormOpen(true);
  }

  function openEdit(t: OpsTeam) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      code: t.code,
      target_crew: String(t.target_crew),
      target_tnv: String(t.target_tnv),
      color: t.color ?? "",
      station_ids: t.station_ids,
      tags: t.tags.join(", "),
      locked: t.locked,
    });
    setFormOpen(true);
  }

  function buildTeamPayload(isUpdate: boolean) {
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      target_crew: Number(form.target_crew) || 0,
      target_tnv: Number(form.target_tnv) || 0,
      station_ids: form.station_ids,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    if (form.color) payload.color = form.color;
    if (isUpdate) payload.locked = form.locked;
    return payload;
  }

  async function handleSaveTeam() {
    if (!token) return;
    if (form.name.trim().length < 2) {
      toast.error("Tên team tối thiểu 2 ký tự");
      return;
    }
    if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(form.code.trim().toUpperCase())) {
      toast.error("Code phải UPPER_SNAKE_CASE, 2-20 ký tự");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await opsTeamsApi.update(token, eventId, editingId, buildTeamPayload(true));
        toast.success("Đã cập nhật team");
      } else {
        await opsTeamsApi.create(token, eventId, buildTeamPayload(false));
        toast.success("Đã tạo team");
      }
      setFormOpen(false);
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(t: OpsTeam) {
    if (!token) return;
    const ok = await confirm({
      title: "Archive team?",
      description: `"${t.name}" sẽ bị soft-delete. Thao tác này không thể khôi phục từ UI.`,
      confirmLabel: "Archive",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await opsTeamsApi.archive(token, eventId, t.id);
      toast.success("Đã archive");
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  async function handleToggleLock(t: OpsTeam) {
    if (!token) return;
    try {
      await opsTeamsApi.update(token, eventId, t.id, { locked: !t.locked });
      toast.success(t.locked ? "Đã unlock" : "Đã lock");
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  function openLeaderDialog(t: OpsTeam) {
    setLeaderTeam(t);
    setSelectedLeaderId(t.leader_user_id ?? "__none__");
    setLeaderOpen(true);
  }

  async function handleAssignLeader() {
    if (!token || !leaderTeam) return;
    setLeaderSaving(true);
    try {
      const next =
        selectedLeaderId === "__none__" ? null : selectedLeaderId;
      await opsTeamsApi.assignLeader(token, eventId, leaderTeam.id, next);
      toast.success(next ? "Đã gán leader" : "Đã bỏ gán leader");
      setLeaderOpen(false);
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setLeaderSaving(false);
    }
  }

  const leaderNameById = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => m.set(u.id, u.full_name));
    return m;
  }, [users]);

  const eventStations = event.stations ?? [];

  function toggleStation(stationId: string) {
    setForm((f) => ({
      ...f,
      station_ids: f.station_ids.includes(stationId)
        ? f.station_ids.filter((s) => s !== stationId)
        : [...f.station_ids, stationId],
    }));
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          Thêm team
        </Button>
      </div>

      {teams.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          Chưa có team nào
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead>Crew</TableHead>
                <TableHead>TNV</TableHead>
                <TableHead>Stations</TableHead>
                <TableHead>Lock</TableHead>
                <TableHead className="w-[180px] text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.order}</TableCell>
                  <TableCell className="font-medium">
                    {t.color && (
                      <span
                        className="mr-2 inline-block size-3 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                    )}
                    {t.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell className="text-xs">
                    {t.leader_user_id
                      ? leaderNameById.get(t.leader_user_id) ??
                        t.leader_user_id.slice(-6)
                      : "-"}
                  </TableCell>
                  <TableCell>{t.target_crew}</TableCell>
                  <TableCell>{t.target_tnv}</TableCell>
                  <TableCell className="text-xs">
                    {t.station_ids.length > 0 ? t.station_ids.join(", ") : "-"}
                  </TableCell>
                  <TableCell>
                    {t.locked ? (
                      <Badge variant="outline" className="bg-red-50 text-red-600">
                        Locked
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Gán leader"
                        onClick={() => openLeaderDialog(t)}
                      >
                        <UserCog className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Sửa"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t.locked ? "Unlock" : "Lock"}
                        onClick={() => handleToggleLock(t)}
                      >
                        {t.locked ? (
                          <Unlock className="size-4" />
                        ) : (
                          <Lock className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600"
                        title="Archive"
                        onClick={() => handleArchive(t)}
                      >
                        <Archive className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa Team" : "Tạo Team"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tên team *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Team Nước"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="WATER"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Target Crew</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.target_crew}
                  onChange={(e) =>
                    setForm({ ...form, target_crew: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Target TNV</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.target_tnv}
                  onChange={(e) =>
                    setForm({ ...form, target_tnv: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Màu (hex, optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={form.color || "#1d4ed8"}
                  onChange={(e) =>
                    setForm({ ...form, color: e.target.value })
                  }
                  className="h-9 w-16 p-1"
                />
                <Input
                  value={form.color}
                  onChange={(e) =>
                    setForm({ ...form, color: e.target.value })
                  }
                  placeholder="#1d4ed8"
                  className="flex-1 font-mono"
                />
                {form.color && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ ...form, color: "" })}
                  >
                    Xóa
                  </Button>
                )}
              </div>
            </div>
            {eventStations.length > 0 && (
              <div className="grid gap-1.5">
                <Label>Stations phục vụ</Label>
                <div className="flex flex-wrap gap-2">
                  {eventStations.map((s) => {
                    const checked = form.station_ids.includes(s.station_id);
                    return (
                      <button
                        key={s.station_id}
                        type="button"
                        onClick={() => toggleStation(s.station_id)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs transition-colors",
                          checked
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        )}
                      >
                        {s.station_id} — {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Tags (phân cách dấu phẩy)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="water, medical"
              />
            </div>
            {editingId && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Locked</p>
                  <p className="text-xs text-muted-foreground">
                    Team locked sẽ không thể chỉnh sửa từ leader app
                  </p>
                </div>
                <Switch
                  checked={form.locked}
                  onCheckedChange={(v) => setForm({ ...form, locked: v })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button onClick={handleSaveTeam} disabled={saving}>
              {saving ? "..." : editingId ? "Lưu" : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leader Dialog */}
      <Dialog open={leaderOpen} onOpenChange={setLeaderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Gán Leader — {leaderTeam?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label>Chọn leader (role = ops_leader, cùng event)</Label>
            <Select
              value={selectedLeaderId}
              onValueChange={(v) => setSelectedLeaderId(v ?? "__none__")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn leader" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- Không gán --</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} ({u.phone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {users.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Chưa có ops_leader nào trong event này. Tạo user role
                &quot;leader&quot; ở tab Nhân sự trước.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLeaderOpen(false)}
              disabled={leaderSaving}
            >
              Hủy
            </Button>
            <Button onClick={handleAssignLeader} disabled={leaderSaving}>
              {leaderSaving ? "..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════ Users ═══════════════════════════ */

interface UserFormState {
  phone: string;
  full_name: string;
  email: string;
  dob: string;
  role: "ops_tnv" | "ops_crew" | "ops_leader";
  team_id: string;
  password: string;
}

const EMPTY_USER_FORM: UserFormState = {
  phone: "",
  full_name: "",
  email: "",
  dob: "",
  role: "ops_tnv",
  team_id: "",
  password: "",
};

function UsersTab({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const [users, setUsers] = useState<OpsUser[]>([]);
  const [teams, setTeams] = useState<OpsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [creating, setCreating] = useState(false);

  // Approve dialog
  const [approveOpen, setApproveOpen] = useState(false);
  const [approvingUser, setApprovingUser] = useState<OpsUser | null>(null);
  const [approveTeamId, setApproveTeamId] = useState<string>("__none__");
  const [approving, setApproving] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectingUser, setRejectingUser] = useState<OpsUser | null>(null);
  const [rejecting, setRejecting] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<OpsUser | null>(null);
  const [editForm, setEditForm] = useState<{
    full_name: string;
    phone: string;
    email: string;
    team_id: string;
  }>({ full_name: "", phone: "", email: "", team_id: "__none__" });
  const [saving, setSaving] = useState(false);

  // QR badge dialog
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUser, setQrUser] = useState<OpsUser | null>(null);
  const [qrBadge, setQrBadge] = useState<UserQrBadge | null>(null);
  const [issuingQr, setIssuingQr] = useState(false);

  // CSV export
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: { status?: string; role?: string } = {};
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.role = roleFilter;
      const res = await opsUsersApi.list(token, eventId, params);
      setUsers(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi load users");
    } finally {
      setLoading(false);
    }
  }, [token, eventId, statusFilter, roleFilter]);

  const loadTeams = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsTeamsApi.list(token, eventId);
      setTeams(res.items);
    } catch {
      /* non-critical */
    }
  }, [token, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  function openCreate() {
    setForm(EMPTY_USER_FORM);
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!token) return;
    if (form.phone.trim().length < 9 || form.full_name.trim().length < 2) {
      toast.error("Phone tối thiểu 9 ký tự, tên tối thiểu 2 ký tự");
      return;
    }
    if (form.role === "ops_leader" && form.password.length < 8) {
      toast.error("Leader cần password tối thiểu 8 ký tự");
      return;
    }
    if (
      (form.role === "ops_crew" || form.role === "ops_tnv") &&
      !form.team_id
    ) {
      toast.error("Crew/TNV bắt buộc gán team");
      return;
    }
    const payload: Record<string, unknown> = {
      phone: form.phone.trim(),
      full_name: form.full_name.trim(),
      role: form.role,
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.dob) payload.dob = form.dob;
    if (form.team_id) payload.team_id = form.team_id;
    if (form.role === "ops_leader" && form.password)
      payload.password = form.password;

    setCreating(true);
    try {
      await opsUsersApi.create(token, eventId, payload);
      toast.success("Đã tạo user");
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setCreating(false);
    }
  }

  function openApprove(u: OpsUser) {
    setApprovingUser(u);
    setApproveTeamId(u.team_id ?? "__none__");
    setApproveOpen(true);
  }

  async function handleApprove() {
    if (!token || !approvingUser) return;
    setApproving(true);
    try {
      const tid = approveTeamId === "__none__" ? undefined : approveTeamId;
      await opsUsersApi.approve(token, eventId, approvingUser.id, tid);
      toast.success("Đã duyệt");
      setApproveOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setApproving(false);
    }
  }

  function openReject(u: OpsUser) {
    setRejectingUser(u);
    setRejectOpen(true);
  }

  async function handleReject(reason: string) {
    if (!token || !rejectingUser) return;
    setRejecting(true);
    try {
      await opsUsersApi.reject(token, eventId, rejectingUser.id, reason);
      toast.success("Đã từ chối");
      setRejectOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setRejecting(false);
    }
  }

  function openEdit(u: OpsUser) {
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name ?? "",
      phone: u.phone ?? "",
      email: u.email ?? "",
      team_id: u.team_id ?? "__none__",
    });
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!token || !editingUser) return;
    if (editForm.full_name.trim().length < 2) {
      toast.error("Họ tên tối thiểu 2 ký tự");
      return;
    }
    if (editForm.phone.trim().length < 9) {
      toast.error("SĐT tối thiểu 9 ký tự");
      return;
    }
    const patch: {
      full_name?: string;
      phone?: string;
      email?: string | null;
      team_id?: string | null;
    } = {};
    if (editForm.full_name.trim() !== (editingUser.full_name ?? ""))
      patch.full_name = editForm.full_name.trim();
    if (editForm.phone.trim() !== (editingUser.phone ?? ""))
      patch.phone = editForm.phone.trim();
    const nextEmail = editForm.email.trim();
    const curEmail = editingUser.email ?? "";
    if (nextEmail !== curEmail)
      patch.email = nextEmail.length > 0 ? nextEmail : null;
    const nextTeam =
      editForm.team_id === "__none__" ? null : editForm.team_id;
    const curTeam = editingUser.team_id ?? null;
    if (nextTeam !== curTeam) patch.team_id = nextTeam;

    if (Object.keys(patch).length === 0) {
      toast.info("Không có thay đổi");
      setEditOpen(false);
      return;
    }

    setSaving(true);
    try {
      await opsUsersApi.update(token, eventId, editingUser.id, patch);
      toast.success("Đã cập nhật");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function handleIssueQr(u: OpsUser) {
    if (!token) return;
    setQrUser(u);
    setQrBadge(null);
    setQrOpen(true);
    setIssuingQr(true);
    try {
      const res = await opsUsersApi.issueQrBadge(token, eventId, u.id);
      setQrBadge(res);
      toast.success("Đã cấp QR mới — badge cũ không còn hiệu lực");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi cấp QR");
      setQrOpen(false);
    } finally {
      setIssuingQr(false);
    }
  }

  async function handleExportCsv() {
    if (!token) return;
    setExporting(true);
    try {
      const params: { status?: string; role?: string } = {};
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.role = roleFilter;
      const blob = await opsUsersApi.downloadCsv(token, eventId, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users-${eventId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Đã tải CSV");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi export");
    } finally {
      setExporting(false);
    }
  }

  const canIssueQr = (u: OpsUser): boolean =>
    (u.role === "ops_crew" || u.role === "ops_tnv") &&
    (u.status === "APPROVED" || u.status === "ACTIVE");

  const {
    paged: pagedUsers,
    page: userPage,
    setPage: setUserPage,
    pageCount: userPageCount,
    pageSize: userPageSize,
  } = usePagedList(users, 20);

  const needTeamForRole =
    form.role === "ops_crew" || form.role === "ops_tnv";

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tất cả status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="PENDING">Chờ duyệt</SelectItem>
            <SelectItem value="APPROVED">Đã duyệt</SelectItem>
            <SelectItem value="REJECTED">Từ chối</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={roleFilter || "all"}
          onValueChange={(v) => setRoleFilter(v === "all" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tất cả role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="ops_tnv">TNV</SelectItem>
            <SelectItem value="ops_crew">Crew</SelectItem>
            <SelectItem value="ops_leader">Leader</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="self-center">
          {users.length} người
        </Badge>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportCsv}
          disabled={exporting || users.length === 0}
          title="Export danh sách (UTF-8 BOM, mở tốt trên Excel)"
        >
          <Download className="mr-1 size-4" />
          {exporting ? "..." : "Export CSV"}
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          Tạo user
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : users.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          Không có dữ liệu
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ngày DK</TableHead>
                <TableHead className="w-[170px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedUsers.map((u) => {
                const teamName =
                  u.team_id && teams.find((t) => t.id === u.team_id)?.name;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name}
                    </TableCell>
                    <TableCell className="text-xs">{u.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {u.role.replace("ops_", "")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {teamName ?? (u.team_id ? u.team_id.slice(-6) : "-")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          u.status === "PENDING" &&
                            "bg-yellow-50 text-yellow-700",
                          u.status === "APPROVED" &&
                            "bg-green-50 text-green-700",
                          u.status === "REJECTED" &&
                            "bg-red-50 text-red-700",
                          u.status === "ACTIVE" && "bg-blue-50 text-blue-700"
                        )}
                      >
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(u.created_at).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {u.status === "PENDING" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-green-600"
                              title="Duyệt"
                              onClick={() => openApprove(u)}
                            >
                              <CheckCircle2 className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-red-600"
                              title="Từ chối"
                              onClick={() => openReject(u)}
                            >
                              <XCircle className="size-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Chỉnh sửa"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {canIssueQr(u) && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-blue-600"
                            title="Cấp QR badge mới (rotate)"
                            onClick={() => handleIssueQr(u)}
                          >
                            <QrCode className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-3 pb-2">
            <Pagination
              page={userPage}
              pageCount={userPageCount}
              pageSize={userPageSize}
              total={users.length}
              onPageChange={setUserPage}
            />
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo user (crew / tnv / leader)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>SĐT *</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="0912345678"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Họ tên *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  placeholder="Nguyễn Văn A"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="a@example.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Ngày sinh</Label>
                <Input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Role *</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    role: v as UserFormState["role"],
                    // Clear password if switch away from leader
                    password: v === "ops_leader" ? form.password : "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ops_tnv">TNV (tình nguyện viên)</SelectItem>
                  <SelectItem value="ops_crew">Crew</SelectItem>
                  <SelectItem value="ops_leader">Leader</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Team {needTeamForRole && "*"}</Label>
              <Select
                value={form.team_id || "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    team_id: !v || v === "__none__" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Không gán --</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role === "ops_leader" && (
              <div className="grid gap-1.5">
                <Label>Password * (tối thiểu 8 ký tự)</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="••••••••"
                />
                <p className="text-xs text-muted-foreground">
                  Leader login bằng email + password vào leader app.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Hủy
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "..." : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duyệt user — {approvingUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-xs text-muted-foreground">
              Có thể gán team luôn lúc duyệt (nếu user chưa có team).
            </p>
            <div className="grid gap-1.5">
              <Label>Team (optional)</Label>
              <Select
                value={approveTeamId}
                onValueChange={(v) => setApproveTeamId(v ?? "__none__")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Không gán --</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveOpen(false)}
              disabled={approving}
            >
              Hủy
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? "..." : "Duyệt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa — {editingUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Họ tên *</Label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, full_name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>SĐT *</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                placeholder="để trống để xoá email"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Team</Label>
              <Select
                value={editForm.team_id}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, team_id: v ?? "__none__" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Không gán --</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Role + password không chỉnh sửa ở đây. Thay đổi team sẽ reset
                QR badge hiện tại ở backend (nếu có).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? "..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR badge dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Badge — {qrUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {issuingQr ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Đang tạo QR…
              </p>
            ) : qrBadge ? (
              <>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Token (copy vào máy in QR / encode)
                  </p>
                  <code className="text-xs font-mono break-all">
                    {qrBadge.qr_token}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (qrBadge?.qr_token) {
                        navigator.clipboard
                          .writeText(qrBadge.qr_token)
                          .then(() => toast.success("Đã copy"))
                          .catch(() => toast.error("Copy lỗi"));
                      }
                    }}
                  >
                    Copy token
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => qrUser && handleIssueQr(qrUser)}
                    disabled={issuingQr}
                  >
                    <RefreshCw className="mr-1 size-4" />
                    Cấp lại
                  </Button>
                </div>
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  <strong>Lưu ý:</strong> Token chỉ hiển thị một lần. Sau khi
                  đóng, không thể lấy lại — chỉ có thể cấp mới (badge cũ hết
                  hiệu lực).
                </div>
              </>
            ) : (
              <p className="text-sm text-destructive">Không có dữ liệu</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <RejectReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        loading={rejecting}
        title={`Từ chối — ${rejectingUser?.full_name ?? ""}`}
        description="Nhập lý do rõ ràng để TNV biết nguyên nhân."
        onConfirm={handleReject}
      />
    </div>
  );
}

/* ═══════════════════════════ Supply ═══════════════════════════ */

type SupplySub = "orders" | "items" | "aggregate";

function SupplyTab({ eventId }: { eventId: string }) {
  const [sub, setSub] = useState<SupplySub>("orders");

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(
          [
            { key: "orders" as const, label: "Đơn vật tư" },
            { key: "items" as const, label: "Master SKU" },
            { key: "aggregate" as const, label: "Tổng hợp" },
          ] satisfies { key: SupplySub; label: string }[]
        ).map((s) => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              sub === s.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sub === "orders" && <SupplyOrdersSection eventId={eventId} />}
      {sub === "items" && <SupplyItemsSection eventId={eventId} />}
      {sub === "aggregate" && <SupplyAggregateSection eventId={eventId} />}
    </div>
  );
}

/* ── Orders ───────────────────────────────────────── */

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Nháp", className: "bg-gray-50 text-gray-600" },
  SUBMITTED: {
    label: "Chờ duyệt",
    className: "bg-yellow-50 text-yellow-700",
  },
  APPROVED: { label: "Đã duyệt", className: "bg-green-50 text-green-700" },
  REJECTED: { label: "Từ chối", className: "bg-red-50 text-red-700" },
  DISPATCHED: { label: "Đã giao", className: "bg-blue-50 text-blue-700" },
  RECEIVED: {
    label: "Đã nhận",
    className: "bg-emerald-50 text-emerald-700",
  },
};

interface OrderLineDraft {
  sku: string;
  quantity: string;
  note: string;
}

function SupplyOrdersSection({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState<OpsSupplyOrder[]>([]);
  const [items, setItems] = useState<OpsSupplyItem[]>([]);
  const [teams, setTeams] = useState<OpsTeam[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createTeamId, setCreateTeamId] = useState<string>("");
  const [lines, setLines] = useState<OrderLineDraft[]>([
    { sku: "", quantity: "1", note: "" },
  ]);
  const [creating, setCreating] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectingOrder, setRejectingOrder] = useState<OpsSupplyOrder | null>(
    null
  );
  const [rejecting, setRejecting] = useState(false);

  // Per-action busy flag
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [ordersRes, itemsRes, teamsRes] = await Promise.all([
        opsSupplyApi.listOrders(token, eventId),
        opsSupplyApi.listItems(token, eventId),
        opsTeamsApi.list(token, eventId),
      ]);
      setOrders(ordersRes.items);
      setItems(itemsRes.items);
      setTeams(teamsRes.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi load");
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setCreateTeamId(teams[0]?.id ?? "");
    setLines([{ sku: items[0]?.sku ?? "", quantity: "1", note: "" }]);
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!token) return;
    if (!createTeamId) {
      toast.error("Chọn team");
      return;
    }
    const validLines = lines.filter(
      (l) => l.sku && Number(l.quantity) > 0
    );
    if (validLines.length === 0) {
      toast.error("Cần ít nhất 1 dòng SKU + quantity > 0");
      return;
    }
    const payload = {
      team_id: createTeamId,
      items: validLines.map((l) => ({
        sku: l.sku,
        quantity: Number(l.quantity),
        ...(l.note ? { note: l.note } : {}),
      })),
    };
    setCreating(true);
    try {
      await opsSupplyApi.createOrder(token, eventId, payload);
      toast.success("Đã tạo đơn (DRAFT)");
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setCreating(false);
    }
  }

  async function runAction(
    order: OpsSupplyOrder,
    fn: () => Promise<unknown>,
    successMsg: string
  ) {
    setActionBusyId(order.id);
    try {
      await fn();
      toast.success(successMsg);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setActionBusyId(null);
    }
  }

  function openReject(o: OpsSupplyOrder) {
    setRejectingOrder(o);
    setRejectOpen(true);
  }

  async function handleReject(reason: string) {
    if (!token || !rejectingOrder) return;
    setRejecting(true);
    try {
      await opsSupplyApi.rejectOrder(
        token,
        eventId,
        rejectingOrder.id,
        reason
      );
      toast.success("Đã từ chối đơn");
      setRejectOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setRejecting(false);
    }
  }

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [teams]);

  const {
    paged: pagedOrders,
    page: ordPage,
    setPage: setOrdPage,
    pageCount: ordPageCount,
    pageSize: ordPageSize,
  } = usePagedList(orders, 20);

  function updateLine(idx: number, patch: Partial<OrderLineDraft>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [
      ...ls,
      { sku: items[0]?.sku ?? "", quantity: "1", note: "" },
    ]);
  }
  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={openCreate}
          disabled={teams.length === 0 || items.length === 0}
          title={
            teams.length === 0
              ? "Cần tạo team trước"
              : items.length === 0
                ? "Cần tạo SKU ở tab Master SKU trước"
                : ""
          }
        >
          <Plus className="mr-1 size-4" />
          Tạo đơn
        </Button>
      </div>

      {orders.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          Chưa có đơn vật tư
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Số lượng</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[200px] text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedOrders.map((o) => {
                const totalItems = o.items.reduce(
                  (s, i) => s + i.quantity,
                  0
                );
                const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.DRAFT;
                const busy = actionBusyId === o.id;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">
                      {o.order_code}
                    </TableCell>
                    <TableCell className="text-xs">
                      {teamNameById.get(o.team_id) ?? o.team_id.slice(-6)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.items.length} SKU / {totalItems} items
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={st.className}>
                        {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(o.created_at).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {o.status === "DRAFT" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Gửi duyệt"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                o,
                                () =>
                                  opsSupplyApi.submitOrder(
                                    token!,
                                    eventId,
                                    o.id
                                  ),
                                "Đã gửi duyệt"
                              )
                            }
                          >
                            <Send className="size-4" />
                          </Button>
                        )}
                        {o.status === "SUBMITTED" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-green-600"
                              title="Duyệt"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  o,
                                  () =>
                                    opsSupplyApi.approveOrder(
                                      token!,
                                      eventId,
                                      o.id
                                    ),
                                  "Đã duyệt đơn"
                                )
                              }
                            >
                              <CheckCircle2 className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-red-600"
                              title="Từ chối"
                              disabled={busy}
                              onClick={() => openReject(o)}
                            >
                              <XCircle className="size-4" />
                            </Button>
                          </>
                        )}
                        {o.status === "APPROVED" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-blue-600"
                            title="Giao đi"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                o,
                                () =>
                                  opsSupplyApi.dispatchOrder(
                                    token!,
                                    eventId,
                                    o.id
                                  ),
                                "Đã đánh dấu giao đi"
                              )
                            }
                          >
                            <Truck className="size-4" />
                          </Button>
                        )}
                        {o.status === "DISPATCHED" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-emerald-600"
                            title="Xác nhận đã nhận"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                o,
                                () =>
                                  opsSupplyApi.receiveOrder(
                                    token!,
                                    eventId,
                                    o.id
                                  ),
                                "Đã xác nhận nhận hàng"
                              )
                            }
                          >
                            <PackageCheck className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-3 pb-2">
            <Pagination
              page={ordPage}
              pageCount={ordPageCount}
              pageSize={ordPageSize}
              total={orders.length}
              onPageChange={setOrdPage}
            />
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo đơn vật tư (DRAFT)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-1.5">
              <Label>Team *</Label>
              <Select
                value={createTeamId}
                onValueChange={(v) => setCreateTeamId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Line items *</Label>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-1 size-3" />
                  Thêm dòng
                </Button>
              </div>
              {lines.map((l, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-md border p-2.5 sm:grid-cols-[1fr_80px_1fr_auto]"
                >
                  <Select
                    value={l.sku}
                    onValueChange={(v) => updateLine(idx, { sku: v ?? "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((it) => (
                        <SelectItem key={it.id} value={it.sku}>
                          {it.sku} — {it.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) =>
                      updateLine(idx, { quantity: e.target.value })
                    }
                  />
                  <Input
                    value={l.note}
                    onChange={(e) =>
                      updateLine(idx, { note: e.target.value })
                    }
                    placeholder="Ghi chú"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Hủy
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "..." : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <RejectReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        loading={rejecting}
        title={`Từ chối đơn — ${rejectingOrder?.order_code ?? ""}`}
        description="Lý do sẽ hiển thị cho leader/team khi xem đơn."
        onConfirm={handleReject}
      />
    </div>
  );
}

/* ── Items (Master SKU) ───────────────────────────── */

interface ItemFormState {
  sku: string;
  name: string;
  description: string;
  unit: string;
  category: string;
  default_price: string;
}

const EMPTY_ITEM_FORM: ItemFormState = {
  sku: "",
  name: "",
  description: "",
  unit: "",
  category: "",
  default_price: "",
};

function SupplyItemsSection({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const confirm = useConfirm();
  const [items, setItems] = useState<OpsSupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsSupplyApi.listItems(token, eventId);
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi load SKU");
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_ITEM_FORM);
    setFormOpen(true);
  }

  function openEdit(it: OpsSupplyItem) {
    setEditingId(it.id);
    setForm({
      sku: it.sku,
      name: it.name,
      description: it.description ?? "",
      unit: it.unit,
      category: it.category,
      default_price:
        it.default_price != null ? String(it.default_price) : "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    if (
      form.sku.trim().length < 2 ||
      form.name.trim().length < 2 ||
      !form.unit ||
      !form.category
    ) {
      toast.error("SKU/name/unit/category đều bắt buộc");
      return;
    }
    const payload: Record<string, unknown> = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      unit: form.unit.trim(),
      category: form.category.trim(),
    };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.default_price) payload.default_price = Number(form.default_price);
    setSaving(true);
    try {
      if (editingId) {
        await opsSupplyApi.updateItem(token, eventId, editingId, payload);
        toast.success("Đã cập nhật SKU");
      } else {
        await opsSupplyApi.createItem(token, eventId, payload);
        toast.success("Đã tạo SKU");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(it: OpsSupplyItem) {
    if (!token) return;
    const ok = await confirm({
      title: "Xóa SKU?",
      description: `SKU "${it.sku}" sẽ bị xoá. Không thể khôi phục.`,
      confirmLabel: "Xóa",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await opsSupplyApi.deleteItem(token, eventId, it.id);
      toast.success("Đã xóa");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          Thêm SKU
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          Chưa có SKU nào
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Giá mặc định</TableHead>
                <TableHead className="w-[120px] text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-xs">{it.sku}</TableCell>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="secondary" className="text-xs">
                      {it.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{it.unit}</TableCell>
                  <TableCell className="text-xs">
                    {it.default_price != null
                      ? it.default_price.toLocaleString("vi-VN") + " đ"
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(it)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600"
                        onClick={() => handleDelete(it)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Sửa SKU" : "Thêm SKU"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>SKU *</Label>
                <Input
                  value={form.sku}
                  onChange={(e) =>
                    setForm({ ...form, sku: e.target.value })
                  }
                  placeholder="WATER_500ML"
                  className="font-mono"
                  disabled={!!editingId}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Tên *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Nước Lavie 500ml"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Category *</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  placeholder="nước"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Unit *</Label>
                <Input
                  value={form.unit}
                  onChange={(e) =>
                    setForm({ ...form, unit: e.target.value })
                  }
                  placeholder="thùng"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Giá mặc định (VND)</Label>
              <Input
                type="number"
                min={0}
                value={form.default_price}
                onChange={(e) =>
                  setForm({ ...form, default_price: e.target.value })
                }
                placeholder="65000"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Mô tả</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Thùng 24 chai 500ml"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "..." : editingId ? "Lưu" : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Aggregate ────────────────────────────────────── */

function SupplyAggregateSection({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const [lines, setLines] = useState<SupplyAggregateLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    opsSupplyApi
      .aggregate(token, eventId)
      .then((res) => setLines(res.lines))
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Lỗi load aggregate")
      )
      .finally(() => setLoading(false));
  }, [token, eventId]);

  if (loading) return <Skeleton className="h-48 w-full" />;

  if (lines.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">
        Chưa có dữ liệu tổng hợp (chưa có đơn SUBMITTED/APPROVED nào)
      </p>
    );
  }

  // Group by category for readability
  const grouped = lines.reduce<Record<string, SupplyAggregateLine[]>>(
    (acc, l) => {
      (acc[l.category] ??= []).push(l);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, rows]) => (
        <div key={cat} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {cat} · {rows.length} SKU
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Đã duyệt</TableHead>
                  <TableHead className="text-right">Đang chờ</TableHead>
                  <TableHead className="text-right">Tổng dự kiến</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.sku}>
                    <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs">{r.unit}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {r.total_approved}
                    </TableCell>
                    <TableCell className="text-right text-yellow-700">
                      {r.total_pending}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {r.total_approved + r.total_pending}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════ Check-ins ═══════════════════════════ */

function CheckInsTab({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const confirm = useConfirm();
  const [items, setItems] = useState<OpsCheckIn[]>([]);
  const [teams, setTeams] = useState<OpsTeam[]>([]);
  const [users, setUsers] = useState<OpsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");

  // Manual check-in dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUserId, setManualUserId] = useState<string>("");
  const [manualSaving, setManualSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: { team_id?: string; method?: string } = {};
      if (teamFilter) params.team_id = teamFilter;
      if (methodFilter) params.method = methodFilter;
      const res = await opsCheckInsApi.list(token, eventId, params);
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi load check-ins");
    } finally {
      setLoading(false);
    }
  }, [token, eventId, teamFilter, methodFilter]);

  const loadTeamsAndUsers = useCallback(async () => {
    if (!token) return;
    try {
      const [t, u] = await Promise.all([
        opsTeamsApi.list(token, eventId),
        opsUsersApi.list(token, eventId, { status: "APPROVED" }),
      ]);
      setTeams(t.items);
      setUsers(u.items);
    } catch {
      /* non-critical */
    }
  }, [token, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTeamsAndUsers();
  }, [loadTeamsAndUsers]);

  async function handleManualCheckIn() {
    if (!token || !manualUserId) return;
    setManualSaving(true);
    try {
      await opsCheckInsApi.create(token, eventId, {
        user_id: manualUserId,
        method: "MANUAL",
      });
      toast.success("Đã ghi nhận check-in");
      setManualOpen(false);
      setManualUserId("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setManualSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    const ok = await confirm({
      title: "Xoá check-in?",
      description: "Bản ghi check-in sẽ bị xoá hoàn toàn khỏi lịch sử. Không thể khôi phục.",
      confirmLabel: "Xoá",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await opsCheckInsApi.delete(token, eventId, id);
      toast.success("Đã xoá");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  const {
    paged: pagedCheckIns,
    page: ciPage,
    setPage: setCiPage,
    pageCount: ciPageCount,
    pageSize: ciPageSize,
  } = usePagedList(items, 20);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <Select
          value={teamFilter || "all"}
          onValueChange={(v) => setTeamFilter(v === "all" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tất cả team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} ({t.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={methodFilter || "all"}
          onValueChange={(v) => setMethodFilter(v === "all" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Phương thức" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="QR">QR scan</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="self-center">
          {items.length} lượt
        </Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setManualOpen(true)}>
          <Plus className="mr-1 size-4" />
          Check-in tay
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          Chưa có lượt check-in nào
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Thời điểm</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedCheckIns.map((c) => {
                const teamName =
                  teams.find((t) => t.id === c.team_id)?.name ??
                  c.team_id.slice(-6);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.user_full_name ?? c.user_id.slice(-6)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.user_phone ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {(c.user_role ?? "").replace("ops_", "") || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{teamName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          c.method === "QR"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {c.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(c.checked_in_at).toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-600"
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-3 pb-2">
            <Pagination
              page={ciPage}
              pageCount={ciPageCount}
              pageSize={ciPageSize}
              total={items.length}
              onPageChange={setCiPage}
            />
          </div>
        </div>
      )}

      {/* Manual check-in dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check-in thủ công</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-xs text-muted-foreground">
              Dùng khi TNV không mang badge QR. Chọn user đã APPROVED để ghi nhận.
            </p>
            <div className="grid gap-1.5">
              <Label>User *</Label>
              <Select
                value={manualUserId || "__none__"}
                onValueChange={(v) =>
                  setManualUserId(!v || v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn user" />
                </SelectTrigger>
                <SelectContent>
                  {users.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Chưa có user APPROVED
                    </SelectItem>
                  ) : (
                    users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} — {u.phone} ({u.role.replace("ops_", "")})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManualOpen(false)}
              disabled={manualSaving}
            >
              Hủy
            </Button>
            <Button
              onClick={handleManualCheckIn}
              disabled={manualSaving || !manualUserId}
            >
              {manualSaving ? "..." : "Ghi nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════ Tasks ═══════════════════════════ */

interface TaskFormState {
  title: string;
  description: string;
  due_at: string; // ISO datetime-local
  due_end_at: string;
  team_id: string;
}

const EMPTY_TASK_FORM: TaskFormState = {
  title: "",
  description: "",
  due_at: "",
  due_end_at: "",
  team_id: "",
};

const TASK_STATUS_BADGE: Record<OpsTaskStatus, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DONE: "bg-green-100 text-green-700",
  BLOCKED: "bg-red-100 text-red-700",
};

function TasksTab({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const confirm = useConfirm();
  const [items, setItems] = useState<OpsTask[]>([]);
  const [teams, setTeams] = useState<OpsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [saving, setSaving] = useState(false);

  // Status change prompt
  const [statusPromptOpen, setStatusPromptOpen] = useState(false);
  const [statusTargetTask, setStatusTargetTask] = useState<OpsTask | null>(null);
  const [blockerReason, setBlockerReason] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: { status?: string; team_id?: string } = {};
      if (statusFilter) params.status = statusFilter;
      if (teamFilter) params.team_id = teamFilter;
      const res = await opsTasksApi.list(token, eventId, params);
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi load tasks");
    } finally {
      setLoading(false);
    }
  }, [token, eventId, statusFilter, teamFilter]);

  const loadTeams = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsTeamsApi.list(token, eventId);
      setTeams(res.items);
    } catch {
      /* non-critical */
    }
  }, [token, eventId]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_TASK_FORM);
    setCreateOpen(true);
  }

  function openEdit(task: OpsTask) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      due_at: toDatetimeLocal(task.due_at),
      due_end_at: task.due_end_at ? toDatetimeLocal(task.due_end_at) : "",
      team_id: task.team_id ?? "",
    });
    setCreateOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    if (form.title.trim().length < 2) {
      toast.error("Title tối thiểu 2 ký tự");
      return;
    }
    if (!form.due_at) {
      toast.error("due_at bắt buộc");
      return;
    }
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      due_at: new Date(form.due_at).toISOString(),
    };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.due_end_at) payload.due_end_at = new Date(form.due_end_at).toISOString();
    if (form.team_id) payload.team_id = form.team_id;

    setSaving(true);
    try {
      if (editingId) {
        // For edit, allow clearing team via explicit empty → backend nhận team_id=""
        const editPayload = { ...payload };
        if (!form.team_id) (editPayload as Record<string, unknown>).team_id = "";
        await opsTasksApi.update(token, eventId, editingId, editPayload);
        toast.success("Đã cập nhật");
      } else {
        await opsTasksApi.create(token, eventId, payload);
        toast.success("Đã tạo task");
      }
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(task: OpsTask, next: OpsTaskStatus) {
    if (next === "BLOCKED") {
      // Open prompt for reason
      setStatusTargetTask(task);
      setBlockerReason("");
      setStatusPromptOpen(true);
      return;
    }
    if (!token) return;
    try {
      await opsTasksApi.updateStatus(token, eventId, task.id, next);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  async function confirmBlocker() {
    if (!token || !statusTargetTask) return;
    if (blockerReason.trim().length < 2) {
      toast.error("Lý do tối thiểu 2 ký tự");
      return;
    }
    try {
      await opsTasksApi.updateStatus(
        token,
        eventId,
        statusTargetTask.id,
        "BLOCKED",
        blockerReason.trim()
      );
      setStatusPromptOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  async function handleArchive(id: string) {
    if (!token) return;
    const ok = await confirm({
      title: "Archive task?",
      description: "Task sẽ bị soft-delete. Không thể khôi phục từ UI.",
      confirmLabel: "Archive",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await opsTasksApi.archive(token, eventId, id);
      toast.success("Đã archive");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  const {
    paged: pagedTasks,
    page: taskPage,
    setPage: setTaskPage,
    pageCount: taskPageCount,
    pageSize: taskPageSize,
  } = usePagedList(items, 20);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tất cả status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">Đang làm</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={teamFilter || "all"}
          onValueChange={(v) => setTeamFilter(v === "all" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tất cả team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} ({t.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="self-center">
          {items.length} task
        </Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          Tạo task
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          Chưa có task nào
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[220px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTasks.map((t) => {
                const teamName = t.team_id
                  ? teams.find((x) => x.id === t.team_id)?.name ??
                    t.team_id.slice(-6)
                  : "(event-wide)";
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <div>{t.title}</div>
                      {t.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {t.description}
                        </div>
                      )}
                      {t.status === "BLOCKED" && t.blocker_reason && (
                        <div className="text-xs text-red-600 mt-1">
                          ⚠ {t.blocker_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{teamName}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(t.due_at).toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", TASK_STATUS_BADGE[t.status])}
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {t.status !== "IN_PROGRESS" &&
                          t.status !== "DONE" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Bắt đầu"
                              onClick={() => quickStatus(t, "IN_PROGRESS")}
                            >
                              <Send className="size-4" />
                            </Button>
                          )}
                        {t.status !== "DONE" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-green-600"
                            title="Done"
                            onClick={() => quickStatus(t, "DONE")}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        )}
                        {t.status !== "BLOCKED" && t.status !== "DONE" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-amber-600"
                            title="Block"
                            onClick={() => quickStatus(t, "BLOCKED")}
                          >
                            <XCircle className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Sửa"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-600"
                          title="Archive"
                          onClick={() => handleArchive(t.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-3 pb-2">
            <Pagination
              page={taskPage}
              pageCount={taskPageCount}
              pageSize={taskPageSize}
              total={items.length}
              onPageChange={setTaskPage}
            />
          </div>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Sửa task" : "Tạo task"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Tiêu đề *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Setup cổng xuất phát"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Mô tả</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Due at *</Label>
                <Input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) =>
                    setForm({ ...form, due_at: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Due end (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.due_end_at}
                  onChange={(e) =>
                    setForm({ ...form, due_end_at: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Team (optional — bỏ trống = event-wide)</Label>
              <Select
                value={form.team_id || "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    team_id: !v || v === "__none__" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Event-wide --</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "..." : editingId ? "Cập nhật" : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocker reason dialog */}
      <Dialog open={statusPromptOpen} onOpenChange={setStatusPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lý do block</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-xs text-muted-foreground">
              Task: <span className="font-medium">{statusTargetTask?.title}</span>
            </p>
            <div className="grid gap-1.5">
              <Label>Lý do *</Label>
              <Textarea
                value={blockerReason}
                onChange={(e) => setBlockerReason(e.target.value)}
                rows={3}
                placeholder="VD: Thiếu vật tư, chờ nhà cung cấp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusPromptOpen(false)}
            >
              Hủy
            </Button>
            <Button variant="destructive" onClick={confirmBlocker}>
              Block task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toDatetimeLocal(iso: string): string {
  // Convert ISO → "YYYY-MM-DDTHH:mm" (local timezone)
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ═══════════════════════════ Incidents ═══════════════════════════ */

interface IncidentFormState {
  team_id: string;
  station_id: string;
  priority: OpsIncidentPriority;
  description: string;
  photo_urls: string; // newline-separated URLs
}

const EMPTY_INCIDENT_FORM: IncidentFormState = {
  team_id: "",
  station_id: "",
  priority: "MEDIUM",
  description: "",
  photo_urls: "",
};

const INCIDENT_PRIORITY_BADGE: Record<OpsIncidentPriority, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-red-100 text-red-700",
};

const INCIDENT_STATUS_BADGE: Record<OpsIncidentStatus, string> = {
  OPEN: "bg-red-100 text-red-700",
  ACKNOWLEDGED: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
};

function IncidentsTab({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const confirm = useConfirm();
  const [items, setItems] = useState<OpsIncident[]>([]);
  const [teams, setTeams] = useState<OpsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<IncidentFormState>(EMPTY_INCIDENT_FORM);
  const [saving, setSaving] = useState(false);

  // Resolve dialog
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<OpsIncident | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: { status?: string; priority?: string } = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await opsIncidentsApi.list(token, eventId, params);
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi load incidents");
    } finally {
      setLoading(false);
    }
  }, [token, eventId, statusFilter, priorityFilter]);

  const loadTeams = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsTeamsApi.list(token, eventId);
      setTeams(res.items);
    } catch {
      /* non-critical */
    }
  }, [token, eventId]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  function openCreate() {
    setForm(EMPTY_INCIDENT_FORM);
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!token) return;
    if (form.description.trim().length < 5) {
      toast.error("Mô tả tối thiểu 5 ký tự");
      return;
    }
    const urls = form.photo_urls
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length > 3) {
      toast.error("Tối đa 3 ảnh");
      return;
    }
    const payload: Record<string, unknown> = {
      priority: form.priority,
      description: form.description.trim(),
    };
    if (form.team_id) payload.team_id = form.team_id;
    if (form.station_id.trim()) payload.station_id = form.station_id.trim();
    if (urls.length > 0) payload.photo_urls = urls;

    setSaving(true);
    try {
      await opsIncidentsApi.create(token, eventId, payload);
      toast.success("Đã tạo báo cáo sự cố");
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function handleAcknowledge(incident: OpsIncident) {
    if (!token) return;
    try {
      await opsIncidentsApi.acknowledge(token, eventId, incident.id);
      toast.success("Đã acknowledge");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  function openResolve(incident: OpsIncident) {
    setResolveTarget(incident);
    setResolveNote("");
    setResolveOpen(true);
  }

  async function handleResolve() {
    if (!token || !resolveTarget) return;
    if (resolveNote.trim().length < 5) {
      toast.error("Ghi chú tối thiểu 5 ký tự");
      return;
    }
    setResolving(true);
    try {
      await opsIncidentsApi.resolve(
        token,
        eventId,
        resolveTarget.id,
        resolveNote.trim()
      );
      toast.success("Đã resolve");
      setResolveOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setResolving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!token) return;
    const ok = await confirm({
      title: "Archive incident?",
      description: "Incident sẽ bị soft-delete và biến mất khỏi danh sách. Không thể khôi phục từ UI.",
      confirmLabel: "Archive",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await opsIncidentsApi.archive(token, eventId, id);
      toast.success("Đã archive");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi");
    }
  }

  const {
    paged: pagedIncidents,
    page: incPage,
    setPage: setIncPage,
    pageCount: incPageCount,
    pageSize: incPageSize,
  } = usePagedList(items, 20);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tất cả status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={priorityFilter || "all"}
          onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="self-center">
          {items.length} sự cố
        </Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          Báo sự cố
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          Chưa có sự cố nào
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mô tả</TableHead>
                <TableHead>Team / Station</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="w-[180px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedIncidents.map((i) => {
                const teamName = i.team_id
                  ? teams.find((t) => t.id === i.team_id)?.name ??
                    i.team_id.slice(-6)
                  : "(event-wide)";
                return (
                  <TableRow key={i.id}>
                    <TableCell className="max-w-[340px]">
                      <p className="line-clamp-2 text-sm">{i.description}</p>
                      {i.resolution_note && (
                        <p className="text-xs text-green-700 mt-1">
                          ✓ {i.resolution_note}
                        </p>
                      )}
                      {i.photo_urls?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📷 {i.photo_urls.length} ảnh
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{teamName}</div>
                      {i.station_id && (
                        <div className="text-muted-foreground">
                          {i.station_id}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          INCIDENT_PRIORITY_BADGE[i.priority]
                        )}
                      >
                        {i.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          INCIDENT_STATUS_BADGE[i.status]
                        )}
                      >
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(i.created_at).toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {i.status === "OPEN" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-blue-600"
                            title="Acknowledge"
                            onClick={() => handleAcknowledge(i)}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        )}
                        {i.status !== "RESOLVED" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-green-600"
                            title="Resolve"
                            onClick={() => openResolve(i)}
                          >
                            <PackageCheck className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-600"
                          title="Archive"
                          onClick={() => handleArchive(i.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-3 pb-2">
            <Pagination
              page={incPage}
              pageCount={incPageCount}
              pageSize={incPageSize}
              total={items.length}
              onPageChange={setIncPage}
            />
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Báo sự cố</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Priority *</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      priority: (v ?? "MEDIUM") as OpsIncidentPriority,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Station (optional)</Label>
                <Input
                  value={form.station_id}
                  onChange={(e) =>
                    setForm({ ...form, station_id: e.target.value })
                  }
                  placeholder="N05"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Team (optional — bỏ trống = event-wide)</Label>
              <Select
                value={form.team_id || "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    team_id: !v || v === "__none__" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Event-wide --</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Mô tả *</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={4}
                placeholder="Chi tiết sự cố, hiện trạng, người liên quan..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Ảnh (URL, mỗi dòng 1 ảnh, tối đa 3)</Label>
              <Textarea
                value={form.photo_urls}
                onChange={(e) =>
                  setForm({ ...form, photo_urls: e.target.value })
                }
                rows={2}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "..." : "Gửi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve sự cố</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {resolveTarget?.description}
            </p>
            <div className="grid gap-1.5">
              <Label>Note xử lý *</Label>
              <Textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                rows={3}
                placeholder="VD: Đã điều thêm 5 thùng nước, xử lý 3 TNV say nắng."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveOpen(false)}
              disabled={resolving}
            >
              Hủy
            </Button>
            <Button onClick={handleResolve} disabled={resolving}>
              {resolving ? "..." : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
