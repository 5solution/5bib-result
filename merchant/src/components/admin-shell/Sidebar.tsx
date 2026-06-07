"use client";

/**
 * 5BIB Admin Sidebar — FEATURE-022 BR-DESIGN-05/10/13.
 *
 * - Width fixed 240px (KHONG collapse tren desktop, BR-DESIGN-05).
 * - Background dark slate #0F172A.
 * - 4 nhom NAV_GROUPS theo shell.jsx.
 * - Active item: blue tint background `rgba(29, 73, 255, 0.18)` + blue left bar 3px.
 * - Hover: white/5 tint slate.
 * - Mobile: cha (dashboard layout) co lo gic hide qua `lg:flex`. Sidebar nay dung
 *   trong desktop sticky + trong mobile Sheet drawer.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import Logo5bib from "@/components/Logo5bib";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type NavItem } from "@/lib/nav-groups";
import { useAuth } from "@/lib/auth-context";

type SidebarProps = {
  /** Goi khi click item (dong mobile drawer). */
  onNavigate?: () => void;
  /** Ten user hien thi card duoi. */
  userName?: string;
  /** Vai tro hien thi card duoi. */
  userRole?: string;
  /** Handler dang xuat. */
  onLogout?: () => void;
};

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      prefetch={false}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-[var(--sidebar-accent)] text-white"
          : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-2.5 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--admin-blue)]"
        />
      )}
      <Icon className="size-[15px] shrink-0" aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count != null && (
        <span className="rounded-full bg-white/10 px-1.5 py-px text-[10px] font-bold text-white/65">
          {item.count}
        </span>
      )}
      {item.badge && (
        <span className="rounded-full bg-[var(--admin-magenta)] px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.06em] text-white">
          {item.badge}
        </span>
      )}
      {item.dot && (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-[var(--admin-magenta)]"
        />
      )}
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  // RBAC filter — bỏ item requireRole="admin" khỏi sidebar nếu user không phải admin.
  // Đồng thời ẩn group hoàn toàn nếu sau filter không còn item nào.
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.requireRole || (item.requireRole === "admin" && isAdmin),
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {visibleGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <div className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/45">
            {group.label}
          </div>
          {group.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <NavLink
                key={item.id}
                item={item}
                active={active}
                onClick={onNavigate}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function SidebarUserCard({
  userName,
  userRole,
  onLogout,
}: {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}) {
  const initials = (userName ?? "AD")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--admin-magenta)] text-xs font-black text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-bold text-white">
          {userName ?? "Admin"}
        </div>
        <div className="text-[11px] text-white/55">{userRole ?? "Super Admin"}</div>
      </div>
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="grid size-7 place-items-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Đăng xuất"
        >
          <LogOut className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Sidebar shell co dinh 240px, dark slate. Bao gom logo, nav, user card.
 * Goi tu (dashboard)/layout.tsx (desktop sticky) hoac trong Sheet drawer (mobile).
 */
export function Sidebar({ onNavigate, userName, userRole, onLogout }: SidebarProps) {
  return (
    <>
      <div className="flex h-[60px] items-center gap-2.5 border-b border-white/8 px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo5bib className="h-6 [&_*]:fill-white" />
          <span className="h-[18px] w-px bg-white/20" aria-hidden />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">
            Admin
          </span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3.5 scrollbar-thin [scrollbar-gutter:stable]">
        <SidebarNav onNavigate={onNavigate} />
      </nav>
      <div className="border-t border-white/8">
        <SidebarUserCard
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
        />
      </div>
    </>
  );
}
