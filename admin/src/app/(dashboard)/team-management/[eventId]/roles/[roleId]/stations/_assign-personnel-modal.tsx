"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  listAssignableMembers,
  createAssignment,
  removeAssignment,
  listStations,
  type AssignableMember,
  type AssignmentMember,
  type AssignmentRole,
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
import { Crown, User, UserMinus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "next/navigation";

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
  const params = useParams<{ eventId: string; roleId: string }>();
  const eventId = Number(params.eventId);
  const roleId = Number(params.roleId);
  const [current, setCurrent] = useState<AssignmentMember[]>([]);
  const [assignable, setAssignable] = useState<AssignableMember[] | null>(null);
  const [query, setQuery] = useState("");
  const [working, setWorking] = useState<number | null>(null);

  const open = station != null;

  const reload = useCallback(async () => {
    if (!token || !station) return;
    try {
      // Re-fetch the station itself to get up-to-date crew/volunteers.
      const stations = await listStations(token, eventId, roleId);
      const fresh = stations.find((s) => s.id === station.id);
      if (fresh) {
        setCurrent([...fresh.crew, ...fresh.volunteers]);
      }
      const members = await listAssignableMembers(token, station.id);
      setAssignable(members);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token, station, eventId, roleId]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setAssignable(null);
      void reload();
    }
  }, [open, reload]);

  useEffect(() => {
    // Also sync current list from the passed station prop initially.
    if (station) {
      setCurrent([...station.crew, ...station.volunteers]);
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

  async function handleAssign(
    member: AssignableMember,
    role: AssignmentRole,
  ): Promise<void> {
    if (!token || !station) return;
    setWorking(member.registration_id);
    try {
      await createAssignment(token, station.id, {
        registration_id: member.registration_id,
        assignment_role: role,
      });
      toast.success(
        `Đã gán ${member.full_name} làm ${role === "crew" ? "Crew" : "TNV"}`,
      );
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
    if (!confirm(`Gỡ ${assignment.full_name} khỏi trạm?`)) return;
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
            👥 Gán Nhân Sự — {station?.station_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1">
          {/* Current */}
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
                      {a.assignment_role === "crew" ? (
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
                        {a.phone}
                      </div>
                    </div>
                    <Badge
                      style={{
                        background:
                          a.assignment_role === "crew" ? "#fef3c7" : "#dbeafe",
                        color:
                          a.assignment_role === "crew" ? "#b45309" : "#1d4ed8",
                        border: "none",
                      }}
                    >
                      {a.assignment_role === "crew" ? "👑 Crew" : "TNV"}
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

          {/* Add */}
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
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {m.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
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
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={working === m.registration_id}
                        onClick={() => void handleAssign(m, "crew")}
                        title="Gán làm Crew (trưởng trạm)"
                      >
                        <Crown className="size-3.5 mr-1" /> Crew
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={working === m.registration_id}
                        onClick={() => void handleAssign(m, "volunteer")}
                        title="Gán làm TNV"
                      >
                        <User className="size-3.5 mr-1" /> TNV
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            ⚠️ Leader không hiện trong danh sách (BR-STN-03). Người đã có trạm
            không hiện (BR-STN-01).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
