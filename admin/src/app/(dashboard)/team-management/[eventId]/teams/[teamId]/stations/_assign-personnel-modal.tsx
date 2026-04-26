"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  listAssignableMembers,
  createAssignment,
  removeAssignment,
  listStationsByCategory,
  type AssignableMember,
  type AssignmentMember,
  type Station,
} from "@/lib/team-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, User, UserMinus, Search, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";

// v1.8 — Assignment modal. assignment_role enum removed; supervisor/worker
// is derived from registration.role.is_leader_role. Leader members can be
// assigned (no longer gated by BR-STN-03) but we show a warning badge.

export function AssignPersonnelModal({
  station,
  onOpenChange,
  onChanged,
}: {
  station: Station | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}): React.ReactElement {
  const { token } = useAuth();
  const confirm = useConfirm();
  const params = useParams<{ eventId: string; teamId: string }>();
  const teamId = Number(params.teamId);
  const [current, setCurrent] = useState<AssignmentMember[]>([]);
  const [assignable, setAssignable] = useState<AssignableMember[] | null>(null);
  const [query, setQuery] = useState("");
  const [working, setWorking] = useState<number | null>(null);
  const [duty, setDuty] = useState("");

  const open = station != null;

  const reload = useCallback(async () => {
    if (!token || !station) return;
    try {
      const stations = await listStationsByCategory(token, teamId);
      const fresh = stations.find((s) => s.id === station.id);
      if (fresh) {
        setCurrent([...fresh.supervisors, ...fresh.workers]);
      }
      const members = await listAssignableMembers(token, station.id);
      setAssignable(members);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token, station, teamId]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setAssignable(null);
      void reload();
    }
  }, [open, reload]);

  useEffect(() => {
    if (station) {
      setCurrent([...station.supervisors, ...station.workers]);
    }
  }, [station]);

  const filtered = useMemo(() => {
    if (!assignable) return [];
    const q = query.trim().toLowerCase();
    if (!q) return assignable;
    return assignable.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [assignable, query]);

  async function handleAssign(member: AssignableMember): Promise<void> {
    if (!token || !station) return;
    setWorking(member.registration_id);
    try {
      await createAssignment(token, station.id, {
        registration_id: member.registration_id,
        duty: duty.trim() || null,
      });
      const roleLabel = member.is_leader_role ? "Supervisor 👑" : "Worker";
      toast.success(
        `Đã gán ${member.full_name} (${roleLabel})${
          duty.trim() ? ` · ${duty.trim()}` : ""
        }`,
      );
      setDuty("");
      await reload();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWorking(null);
    }
  }

  async function handleRemove(assignment: AssignmentMember): Promise<void> {
    if (!token) return;
    const ok = await confirm({
      title: 'Gỡ khỏi trạm',
      description: `Gỡ ${assignment.full_name} khỏi trạm?`,
      confirmText: 'Gỡ',
      variant: 'destructive',
    });
    if (!ok) return;
    setWorking(assignment.assignment_id);
    try {
      await removeAssignment(token, assignment.assignment_id);
      toast.success("Đã gỡ khỏi trạm");
      await reload();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWorking(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            👥 Gán nhân sự — {station?.station_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Hiện tại tại trạm ({current.length})
            </h3>
            {current.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
                Chưa có ai được gán.
              </div>
            ) : (
              <div className="rounded-lg border divide-y">
                {current.map((a) => (
                  <div
                    key={a.assignment_id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <div className="flex-shrink-0">
                      {a.is_supervisor ? (
                        <Crown className="size-5 text-amber-500" />
                      ) : (
                        <User className="size-5 text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {a.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.role_name ? (
                          <span className="italic">{a.role_name}</span>
                        ) : null}
                        {a.role_name ? " · " : ""}
                        {a.phone}
                        {a.duty ? (
                          <>
                            {" · "}
                            <span className="italic text-gray-700">
                              🎯 {a.duty}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <Badge
                      style={{
                        background: a.is_supervisor ? "#fef3c7" : "#dbeafe",
                        color: a.is_supervisor ? "#b45309" : "#1d4ed8",
                        border: "none",
                      }}
                    >
                      {a.is_supervisor ? "👑 Supervisor" : "👤 Worker"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working === a.assignment_id}
                      onClick={() => void handleRemove(a)}
                    >
                      <UserMinus className="size-4 mr-1" /> Gỡ
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Thêm vào trạm
            </h3>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên / số điện thoại / email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 pr-8"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <div className="mb-2">
              <Input
                placeholder="🎯 Chuyên môn / nhiệm vụ (tuỳ chọn) — VD: phát nước, sơ cứu, timing"
                value={duty}
                onChange={(e) => setDuty(e.target.value)}
                maxLength={100}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Nhập trước khi click <b>Gán</b> — duty sẽ gán cùng lúc. Vai trò
                Supervisor/Worker tự động từ role của thành viên (leader role →
                Supervisor).
              </p>
            </div>
            {assignable === null ? (
              <Skeleton className="h-40" />
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
                {query
                  ? "Không tìm thấy ai phù hợp."
                  : "Không còn ai khả dụng để gán."}
              </div>
            ) : (
              <div className="rounded-lg border divide-y max-h-80 overflow-y-auto">
                {filtered.map((m) => (
                  <div
                    key={m.registration_id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <div className="flex-shrink-0">
                      {m.is_leader_role ? (
                        <Crown
                          className="size-4 text-amber-500"
                          aria-label="Leader role"
                        />
                      ) : (
                        <User
                          className="size-4 text-blue-500"
                          aria-label="Member role"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {m.full_name}
                        {m.is_leader_role ? (
                          <Badge
                            className="ml-2"
                            style={{
                              background: "#fef3c7",
                              color: "#b45309",
                              border: "none",
                            }}
                          >
                            👑 Leader role — gán sẽ thành Supervisor
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="italic">{m.role_name}</span> ·{" "}
                        {m.phone} · {m.email}
                      </div>
                    </div>
                    <Badge
                      style={{
                        background: "#f3f4f6",
                        color: "#374151",
                        border: "none",
                      }}
                    >
                      {m.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working === m.registration_id}
                      onClick={() => void handleAssign(m)}
                      title="Gán vào trạm"
                    >
                      <UserPlus className="size-3.5 mr-1" /> Gán
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            Người đã có trạm khác không hiện (BR-STN-01). Supervisor/Worker
            distinction tự động từ role.is_leader_role.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
