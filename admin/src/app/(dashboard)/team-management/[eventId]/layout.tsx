"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listRegistrations, listTeamRoles, type TeamRole } from "@/lib/team-api";
import { ChevronDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// v1.6 nav — 4 groups, dropdown on desktop, stacked on mobile.
// ─────────────────────────────────────────────────────────────

type NavLeaf = {
  slug: string;
  label: string;
  /** If true, needs a role picker (sub-menu of roles). */
  perRole?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavLeaf[];
};

const GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Tổng quan",
    items: [{ slug: "dashboard", label: "Dashboard" }],
  },
  {
    id: "ops",
    label: "Vận hành",
    items: [
      { slug: "roles", label: "Vai trò" },
      { slug: "registrations", label: "Nhân sự" },
      { slug: "stations", label: "Trạm", perRole: true },
      { slug: "contacts", label: "Liên lạc khẩn cấp" },
      { slug: "schedule-emails", label: "Email lịch trình" },
      { slug: "scan", label: "Scan QR" },
    ],
  },
  {
    id: "supply",
    label: "Vật tư",
    items: [
      { slug: "supply-items", label: "Kho vật tư" },
      { slug: "supply", label: "Kế hoạch vật tư" },
    ],
  },
  {
    id: "reports",
    label: "Báo cáo",
    items: [{ slug: "export", label: "Xuất báo cáo" }],
  },
];

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const params = useParams<{ eventId: string }>();
  const pathname = usePathname();
  const base = `/team-management/${params.eventId}`;
  const eventId = Number(params.eventId);
  const { token } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    try {
      const res = await listRegistrations(token, eventId, {
        status: "pending",
        page: 1,
        limit: 1,
      });
      setPendingCount(res.total);
    } catch {
      // non-fatal
    }
  }, [token, eventId]);

  const fetchRoles = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    try {
      setRoles(await listTeamRoles(token, eventId));
    } catch {
      // non-fatal
    }
  }, [token, eventId]);

  useEffect(() => {
    void fetchPending();
    void fetchRoles();
  }, [fetchPending, fetchRoles]);

  // Close any open dropdown on route change
  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!openGroup) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest("[data-nav-group]")) {
        setOpenGroup(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenGroup(null);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  // Helper: is this leaf the active one?
  const isLeafActive = useCallback(
    (slug: string) => {
      const href = `${base}/${slug}`;
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [base, pathname],
  );

  const activeGroupId = useMemo(() => {
    for (const g of GROUPS) {
      if (g.items.some((it) => isLeafActive(it.slug))) return g.id;
    }
    return null;
  }, [isLeafActive]);

  return (
    <div className="space-y-5">
      {/* Desktop nav — groups with dropdowns */}
      <nav
        className="hidden md:flex flex-nowrap gap-1 border-b relative"
        style={{ borderColor: "#e5e7eb" }}
      >
        {GROUPS.map((group) => {
          const isActive = activeGroupId === group.id;
          const isOpen = openGroup === group.id;
          // Single-item group (overview, reports) → render as direct link.
          if (group.items.length === 1) {
            const only = group.items[0]!;
            const href = `${base}/${only.slug}`;
            return (
              <Link
                key={group.id}
                href={href}
                className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-150 whitespace-nowrap"
                style={{
                  borderBottomColor: isActive ? "#2563eb" : "transparent",
                  color: isActive ? "#1d4ed8" : "#6b7280",
                  background: "transparent",
                }}
              >
                {group.label}
              </Link>
            );
          }
          return (
            <div key={group.id} className="relative" data-nav-group>
              <button
                type="button"
                onClick={() =>
                  setOpenGroup((cur) => (cur === group.id ? null : group.id))
                }
                className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-150 whitespace-nowrap"
                style={{
                  borderBottomColor: isActive ? "#2563eb" : "transparent",
                  color: isActive ? "#1d4ed8" : "#6b7280",
                  background: "transparent",
                }}
              >
                {group.label}
                {group.id === "ops" && pendingCount > 0 ? (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-xs font-bold animate-pulse"
                    style={{ background: "#fef3c7", color: "#b45309" }}
                  >
                    {pendingCount}
                  </span>
                ) : null}
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
              {isOpen ? (
                <div
                  className="absolute left-0 top-full z-30 mt-1 min-w-[220px] rounded-lg border bg-white shadow-lg py-1"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  {group.items.map((leaf) => {
                    if (leaf.perRole) {
                      return (
                        <RoleSubmenu
                          key={leaf.slug}
                          label={leaf.label}
                          slug={leaf.slug}
                          base={base}
                          roles={roles}
                          onPick={() => setOpenGroup(null)}
                        />
                      );
                    }
                    const href = `${base}/${leaf.slug}`;
                    const active = isLeafActive(leaf.slug);
                    return (
                      <Link
                        key={leaf.slug}
                        href={href}
                        onClick={() => setOpenGroup(null)}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors"
                        style={{
                          color: active ? "#1d4ed8" : "#374151",
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        <span>{leaf.label}</span>
                        {leaf.slug === "registrations" && pendingCount > 0 ? (
                          <span
                            className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                            style={{
                              background: "#fef3c7",
                              color: "#b45309",
                            }}
                          >
                            {pendingCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* Mobile nav — stacked collapsible sections */}
      <nav className="md:hidden flex flex-col gap-0 border rounded-lg overflow-hidden bg-white">
        {GROUPS.map((group) => {
          const isActive = activeGroupId === group.id;
          const isOpen = openGroup === group.id || isActive;
          // Single-item: direct link
          if (group.items.length === 1) {
            const only = group.items[0]!;
            const href = `${base}/${only.slug}`;
            return (
              <Link
                key={group.id}
                href={href}
                className="px-4 py-3 text-sm font-medium border-b last:border-b-0"
                style={{
                  background: isActive ? "#eff6ff" : "white",
                  color: isActive ? "#1d4ed8" : "#374151",
                }}
              >
                {group.label}
              </Link>
            );
          }
          return (
            <div key={group.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() =>
                  setOpenGroup((cur) => (cur === group.id ? null : group.id))
                }
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
                style={{
                  background: isActive ? "#eff6ff" : "white",
                  color: isActive ? "#1d4ed8" : "#374151",
                }}
              >
                <span>{group.label}</span>
                <ChevronDown
                  className="size-4 transition-transform"
                  style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                />
              </button>
              {isOpen ? (
                <div className="flex flex-col bg-muted/30">
                  {group.items.map((leaf) => {
                    if (leaf.perRole) {
                      return (
                        <div
                          key={leaf.slug}
                          className="px-4 py-2 text-xs font-semibold text-muted-foreground border-t"
                        >
                          {leaf.label}
                          <div className="flex flex-col mt-1">
                            {roles.length === 0 ? (
                              <span className="px-2 py-1 text-xs text-muted-foreground">
                                Chưa có vai trò
                              </span>
                            ) : (
                              roles.map((r) => {
                                const href = `${base}/roles/${r.id}/${leaf.slug}`;
                                const active = pathname === href;
                                return (
                                  <Link
                                    key={r.id}
                                    href={href}
                                    className="px-3 py-1.5 text-sm rounded"
                                    style={{
                                      color: active ? "#1d4ed8" : "#4b5563",
                                    }}
                                  >
                                    → {r.role_name}
                                  </Link>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    }
                    const href = `${base}/${leaf.slug}`;
                    const active = isLeafActive(leaf.slug);
                    return (
                      <Link
                        key={leaf.slug}
                        href={href}
                        className="px-6 py-2.5 text-sm border-t"
                        style={{
                          color: active ? "#1d4ed8" : "#4b5563",
                          fontWeight: active ? 600 : 400,
                          background: active ? "#dbeafe" : "transparent",
                        }}
                      >
                        {leaf.label}
                        {leaf.slug === "registrations" && pendingCount > 0 ? (
                          <span
                            className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold"
                            style={{
                              background: "#fef3c7",
                              color: "#b45309",
                            }}
                          >
                            {pendingCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

function RoleSubmenu({
  label,
  slug,
  base,
  roles,
  onPick,
}: {
  label: string;
  slug: string;
  base: string;
  roles: TeamRole[];
  onPick: () => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted cursor-default">
        <span>{label}</span>
        <ChevronDown className="size-3.5 -rotate-90 opacity-60" />
      </div>
      {open ? (
        <div
          className="absolute left-full top-0 min-w-[200px] rounded-lg border bg-white shadow-lg py-1"
          style={{ borderColor: "#e5e7eb" }}
        >
          {roles.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Chưa có vai trò
            </div>
          ) : (
            roles.map((r) => (
              <Link
                key={r.id}
                href={`${base}/roles/${r.id}/${slug}`}
                onClick={onPick}
                className="block px-3 py-2 text-sm hover:bg-muted"
                style={{ color: "#374151" }}
              >
                → {r.role_name}
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
