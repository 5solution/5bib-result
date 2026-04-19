"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listTeamRoles, type TeamRole } from "@/lib/team-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// v1.8 — Roles inside this Team. Filter listTeamRoles by category_id === teamId.

export default function TeamRolesPage(): React.ReactElement {
  const params = useParams<{ eventId: string; teamId: string }>();
  const eventId = Number(params.eventId);
  const teamId = Number(params.teamId);
  const { token } = useAuth();

  const [roles, setRoles] = useState<TeamRole[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    try {
      setError(null);
      const all = await listTeamRoles(token, eventId);
      setRoles(all.filter((r) => r.category_id === teamId));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    if (!roles) return { filled: 0, slots: 0 };
    let filled = 0;
    let slots = 0;
    for (const r of roles) {
      filled += r.filled_slots;
      slots += r.max_slots;
    }
    return { filled, slots };
  }, [roles]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!roles) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="size-5 text-blue-600" />
            Vai trò của team
          </h2>
          <p className="text-xs text-gray-500">
            {roles.length} vai trò · tổng {totals.filled}/{totals.slots} slot.
            Quản lý role (thêm/sửa/xoá) tại tab "Vai trò" top-level.
          </p>
        </div>
        <Link
          href={`/team-management/${eventId}/roles`}
          className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          Mở danh sách vai trò chung <ExternalLink className="size-3" />
        </Link>
      </div>

      {roles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Users className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-2">
            Chưa có vai trò nào thuộc team này.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Gán vai trò vào team tại tab "Vai trò" top-level (cột Team).
          </p>
          <Link
            href={`/team-management/${eventId}/roles`}
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            Mở danh sách vai trò <ExternalLink className="size-3" />
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên vai trò</TableHead>
                <TableHead>Cấp bậc</TableHead>
                <TableHead>Slots</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id} className="result-row-hover">
                  <TableCell className="font-medium">
                    <Link
                      href={`/team-management/${eventId}/roles/${r.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {r.role_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.is_leader_role ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        👑 Leader
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Thành viên</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.filled_slots} / {r.max_slots}
                  </TableCell>
                  <TableCell>{r.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/team-management/${eventId}/roles/${r.id}`}
                      className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      Mở <ExternalLink className="size-3" />
                    </Link>
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
