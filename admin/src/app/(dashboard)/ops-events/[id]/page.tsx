"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  opsEventsApi,
  opsTeamsApi,
  opsUsersApi,
  opsSupplyApi,
  type OpsEvent,
  type OpsTeam,
  type OpsUser,
  type OpsSupplyOrder,
  type EventKpi,
} from "@/lib/ops-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "teams" | "users" | "supply";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Tong quan", icon: ClipboardList },
  { key: "teams", label: "Teams", icon: ShieldCheck },
  { key: "users", label: "Nhan su", icon: Users },
  { key: "supply", label: "Vat tu", icon: Package },
];

export default function OpsEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const eventId = params.id as string;
  const [tab, setTab] = useState<Tab>("overview");
  const [event, setEvent] = useState<OpsEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const loadEvent = useCallback(async () => {
    if (!token || !eventId) return;
    try {
      const ev = await opsEventsApi.get(token, eventId);
      setEvent(ev);
    } catch (err) {
      toast.error(`Load event that bai: ${err instanceof Error ? err.message : ""}`);
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

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
        Event khong ton tai
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push("/ops-events")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(event.date).toLocaleDateString("vi-VN")} &middot;{" "}
            {event.location?.name}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            event.status === "LIVE" && "bg-green-100 text-green-700",
            event.status === "DRAFT" && "bg-gray-100 text-gray-700",
            event.status === "ENDED" && "bg-orange-100 text-orange-700"
          )}
        >
          {event.status}
        </Badge>
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
      {tab === "teams" && <TeamsTab eventId={eventId} />}
      {tab === "users" && <UsersTab eventId={eventId} />}
      {tab === "supply" && <SupplyTab eventId={eventId} />}
    </div>
  );
}

/* ═══════ Overview Tab ═══════ */

function OverviewTab({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const [kpi, setKpi] = useState<EventKpi | null>(null);

  useEffect(() => {
    if (!token) return;
    opsEventsApi.kpi(token, eventId).then(setKpi).catch(() => {});
  }, [token, eventId]);

  if (!kpi) return <Skeleton className="h-48 w-full" />;

  const cards = [
    { label: "Teams", value: kpi.total_teams, color: "text-blue-600" },
    { label: "TNV dang ky", value: kpi.total_volunteers, color: "text-purple-600" },
    { label: "TNV da duyet", value: kpi.total_volunteers_approved, color: "text-green-600" },
    { label: "Crew", value: kpi.total_crew, color: "text-indigo-600" },
    { label: "Da check-in", value: kpi.total_checked_in, color: "text-teal-600" },
    { label: "Don VT cho duyet", value: kpi.total_supply_orders_submitted, color: "text-orange-600" },
    { label: "Don VT da duyet", value: kpi.total_supply_orders_approved, color: "text-emerald-600" },
    { label: "Tasks pending", value: kpi.total_tasks_pending, color: "text-amber-600" },
    { label: "Incident open", value: kpi.total_incidents_open, color: "text-red-600" },
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

/* ═══════ Teams Tab ═══════ */

function TeamsTab({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const [teams, setTeams] = useState<OpsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsTeamsApi.list(token, eventId);
      setTeams(res.items);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!token || !name || !code) return;
    setCreating(true);
    try {
      await opsTeamsApi.create(token, eventId, { name, code: code.toUpperCase() });
      toast.success("Tao team thanh cong");
      setDialogOpen(false);
      setName("");
      setCode("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="mr-1 size-4" />
            Them team
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tao Team</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Ten team</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team Nuoc" />
              </div>
              <div className="grid gap-2">
                <Label>Code (UPPER_SNAKE)</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WATER" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating || !name || !code}>
                {creating ? "..." : "Tao"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {teams.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Chua co team nao</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Ten</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Crew</TableHead>
                <TableHead>TNV</TableHead>
                <TableHead>Stations</TableHead>
                <TableHead>Lock</TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ═══════ Users Tab ═══════ */

function UsersTab({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const [users, setUsers] = useState<OpsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (roleFilter) params.role = roleFilter;
      const res = await opsUsersApi.list(token, eventId, params);
      setUsers(res.items);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [token, eventId, statusFilter, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(userId: string) {
    if (!token) return;
    try {
      await opsUsersApi.approve(token, eventId, userId);
      toast.success("Da duyet");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi");
    }
  }

  async function handleReject(userId: string) {
    if (!token) return;
    const reason = prompt("Ly do tu choi:");
    if (!reason) return;
    try {
      await opsUsersApi.reject(token, eventId, userId, reason);
      toast.success("Da tu choi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tat ca status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tat ca</SelectItem>
            <SelectItem value="PENDING">Cho duyet</SelectItem>
            <SelectItem value="APPROVED">Da duyet</SelectItem>
            <SelectItem value="REJECTED">Tu choi</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? "")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tat ca role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tat ca</SelectItem>
            <SelectItem value="ops_tnv">TNV</SelectItem>
            <SelectItem value="ops_crew">Crew</SelectItem>
            <SelectItem value="ops_leader">Leader</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="self-center">
          {users.length} nguoi
        </Badge>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : users.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Khong co du lieu</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ho ten</TableHead>
                <TableHead>SoT</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ngay DK</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-xs">{u.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {u.role.replace("ops_", "")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        u.status === "PENDING" && "bg-yellow-50 text-yellow-700",
                        u.status === "APPROVED" && "bg-green-50 text-green-700",
                        u.status === "REJECTED" && "bg-red-50 text-red-700",
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
                    {u.status === "PENDING" && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-green-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(u.id);
                          }}
                        >
                          <CheckCircle2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(u.id);
                          }}
                        >
                          <XCircle className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ═══════ Supply Tab ═══════ */

function SupplyTab({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState<OpsSupplyOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsSupplyApi.listOrders(token, eventId);
      setOrders(res.items);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(orderId: string) {
    if (!token) return;
    try {
      await opsSupplyApi.approveOrder(token, eventId, orderId);
      toast.success("Da duyet don");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi");
    }
  }

  async function handleReject(orderId: string) {
    if (!token) return;
    const reason = prompt("Ly do tu choi:");
    if (!reason) return;
    try {
      await opsSupplyApi.rejectOrder(token, eventId, orderId, reason);
      toast.success("Da tu choi don");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi");
    }
  }

  const ORDER_STATUS: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Nhap", className: "bg-gray-50 text-gray-600" },
    SUBMITTED: { label: "Cho duyet", className: "bg-yellow-50 text-yellow-700" },
    APPROVED: { label: "Da duyet", className: "bg-green-50 text-green-700" },
    REJECTED: { label: "Tu choi", className: "bg-red-50 text-red-700" },
    DISPATCHED: { label: "Da giao", className: "bg-blue-50 text-blue-700" },
    RECEIVED: { label: "Da nhan", className: "bg-emerald-50 text-emerald-700" },
  };

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Chua co don vat tu</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ma don</TableHead>
                <TableHead>Sp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ngay tao</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const totalItems = o.items.reduce((s, i) => s + i.quantity, 0);
                const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.DRAFT;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">
                      {o.order_code}
                    </TableCell>
                    <TableCell>
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
                    <TableCell>
                      {o.status === "SUBMITTED" && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-green-600"
                            onClick={() => handleApprove(o.id)}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-red-600"
                            onClick={() => handleReject(o.id)}
                          >
                            <XCircle className="size-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
