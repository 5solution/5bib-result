"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listTeamRoles, type TeamRole } from "@/lib/team-api";
import { ArrowLeft } from "lucide-react";

// v1.7 UX — Role detail is the single entry point for per-team operations.
// Danny insisted (2026-04-18): Trạm/Vật tư/Cấu hình đều là thuộc tính của
// 1 Vai trò → đưa vào sub-tabs thay vì tab top-level ngang hàng.

type SubNav = {
  slug: string; // "" for base /roles/[roleId]
  label: string;
};

// v1.8 — Trạm và Vật tư đã move sang Team (category) level. Role detail giờ
// chỉ còn Nhân sự + Cấu hình. Xem trạm/supply tại /team-management/:eid/teams/:tid.
const SUBNAV: SubNav[] = [
  { slug: "", label: "Nhân sự" },
  { slug: "config", label: "Cấu hình" },
];

export default function RoleDetailLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const params = useParams<{ eventId: string; roleId: string }>();
  const pathname = usePathname();
  const eventId = params.eventId;
  const roleId = Number(params.roleId);
  const base = `/team-management/${eventId}/roles/${roleId}`;
  const { token } = useAuth();
  const [role, setRole] = useState<TeamRole | null>(null);

  const loadRole = useCallback(async () => {
    if (!token || !Number.isFinite(roleId)) return;
    try {
      const roles = await listTeamRoles(token, Number(eventId));
      setRole(roles.find((r) => r.id === roleId) ?? null);
    } catch {
      setRole(null);
    }
  }, [token, eventId, roleId]);

  useEffect(() => {
    void loadRole();
  }, [loadRole]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/team-management/${eventId}/roles`}>
          <button
            type="button"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="mr-1 size-4" /> Danh sách vai trò
          </button>
        </Link>
        <div className="h-4 w-px bg-gray-300" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 truncate">
            {role?.role_name ?? "Đang tải..."}
          </h1>
          {role ? (
            <p className="text-xs text-gray-500">
              {role.is_leader_role ? "👑 Leader role · " : ""}
              {role.filled_slots}/{role.max_slots} slots
              {role.waitlist_enabled ? " · có waitlist" : ""}
            </p>
          ) : null}
        </div>
      </div>

      <nav
        className="flex items-end gap-1 overflow-x-auto border-b scrollbar-hide"
        aria-label="Role detail sub-navigation"
      >
        {SUBNAV.map((item) => {
          const href = item.slug ? `${base}/${item.slug}` : base;
          // Overview tab ("Nhân sự") highlights only on exact base path — otherwise
          // any sub-path would also match. Other tabs use prefix match so deep
          // routes (e.g. /stations/5/allocations) still highlight "Trạm".
          const active = item.slug
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === href || pathname === `${href}/`;
          return (
            <Link
              key={item.slug || "overview"}
              href={href}
              className={[
                "whitespace-nowrap px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px",
                active
                  ? "border-blue-600 text-blue-700 font-semibold"
                  : "border-transparent text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
