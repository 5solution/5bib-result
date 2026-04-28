"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Trophy,
  RefreshCw,
  FileWarning,
  Handshake,
  LogOut,
  Menu,
  Store,
  ReceiptText,
  BarChart2,
  Users,
  Award,
  Timer,
  Image as ImageIcon,
  Megaphone,
  FileText,
  Tags,
  KeyRound,
  Bug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Logo5bib from "@/components/Logo5bib";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { PromptProvider } from "@/components/prompt-dialog";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

// Sidebar nav grouped per design spec (5BIB Admin Blog) — 3 sections.
// All 13 existing modules retained (Q1=B); 2 new items in Nội dung.
const navGroups: NavGroup[] = [
  {
    label: "Vận hành",
    items: [
      { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/races", label: "Giải đấu", icon: Trophy },
      { href: "/merchants", label: "Merchant", icon: Store },
      { href: "/reconciliations", label: "Đối soát", icon: ReceiptText },
      { href: "/analytics", label: "Analytics", icon: BarChart2 },
      { href: "/team-management", label: "Quản lý nhân sự", icon: Users },
      { href: "/claims", label: "Khiếu nại", icon: FileWarning },
      { href: "/timing-leads", label: "Timing Leads", icon: Timer },
    ],
  },
  {
    label: "Nội dung",
    items: [
      { href: "/articles", label: "Bài viết", icon: FileText, badge: "NEW" },
      { href: "/article-categories", label: "Danh mục", icon: Tags, badge: "NEW" },
      { href: "/sponsors", label: "Nhà tài trợ", icon: Handshake },
      { href: "/sponsored", label: "Banner Zone", icon: Megaphone },
      { href: "/certificates", label: "Certificates", icon: Award },
      { href: "/result-image-stats", label: "Ảnh kết quả", icon: ImageIcon },
    ],
  },
  {
    label: "Hỗ trợ",
    items: [
      { href: "/bug-reports", label: "Báo lỗi", icon: Bug, badge: "NEW" },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { href: "/api-keys", label: "API Keys", icon: KeyRound, badge: "NEW" },
      { href: "/sync-logs", label: "Nhật ký đồng bộ", icon: RefreshCw },
    ],
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  badge,
  active,
  onClick,
}: NavItem & { active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      // prefetch=false: avoid eager RSC fetch storm on layout mount.
      prefetch={false}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--sidebar-accent)] text-white"
          : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--sidebar-primary)]"
        />
      )}
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded-full bg-[var(--5bib-magenta)] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-5">
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <div className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/55">
            {group.label}
          </div>
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={pathname === item.href || pathname.startsWith(item.href + "/")}
              onClick={onNavigate}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function UserCard({ name, onLogout }: { name?: string; onLogout: () => void }) {
  const initials = (name ?? "AD")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--5bib-magenta)] text-xs font-black text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-bold text-white">{name ?? "Admin"}</div>
        <div className="text-[11px] text-white/55">Super Admin</div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="grid size-7 place-items-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Đăng xuất"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, logout, userRole, userInfo } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  if (userRole !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <LogOut className="size-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Không có quyền truy cập
          </h1>
          <p className="text-sm text-muted-foreground">
            Tài khoản của bạn chưa được cấp role admin. Vui lòng liên hệ
            superadmin để cấp quyền, hoặc đăng nhập tài khoản khác.
          </p>
          <Button variant="default" onClick={() => logout()}>
            Đăng xuất
          </Button>
        </div>
      </div>
    );
  }

  const handleLogout = () => logout();
  const userName = userInfo?.name ?? userInfo?.username ?? userInfo?.email ?? "Admin";

  return (
    <div className="flex min-h-screen bg-[#F7F7F8]">
      {/* Desktop Sidebar — dark slate-900, sticky */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] lg:flex">
        <div className="flex h-[60px] items-center gap-2.5 border-b border-white/8 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Logo5bib className="h-6 [&_*]:fill-white" />
            <span className="h-[18px] w-px bg-white/20" aria-hidden />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">
              Admin
            </span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 py-3.5">
          <SidebarContent />
        </nav>
        <div className="border-t border-white/8">
          <UserCard name={userName} onLogout={handleLogout} />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-border bg-card px-4 md:px-7">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger className="lg:hidden inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 border-none bg-[var(--sidebar)] p-0 text-[var(--sidebar-foreground)]"
            >
              <SheetHeader className="border-b border-white/8 p-4">
                <SheetTitle className="flex items-center gap-2.5">
                  <Logo5bib className="h-6 [&_*]:fill-white" />
                  <span className="h-[18px] w-px bg-white/20" aria-hidden />
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">
                    Admin
                  </span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto px-2.5 py-3.5">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </nav>
              <div className="border-t border-white/8">
                <UserCard
                  name={userName}
                  onLogout={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* U-01/U-02: Global search + notifications hidden in v1.0 — Phase 2 */}
          <span className="ml-auto hidden font-mono text-xs text-muted-foreground md:inline">
            admin.5bib.com
          </span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <ConfirmProvider>
            <PromptProvider>{children}</PromptProvider>
          </ConfirmProvider>
        </main>
      </div>
    </div>
  );
}
