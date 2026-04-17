"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import Logo5bib from "@/components/Logo5bib";

const navItems = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/races", label: "Giải đấu", icon: Trophy },
  { href: "/merchants", label: "Merchant", icon: Store },
  { href: "/reconciliations", label: "Đối soát", icon: ReceiptText },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/sponsors", label: "Nhà tài trợ", icon: Handshake },
  { href: "/team-management", label: "Quản lý nhân sự", icon: Users },
  { href: "/sync-logs", label: "Nhật ký đồng bộ", icon: RefreshCw },
  { href: "/claims", label: "Khiếu nại", icon: FileWarning },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-1">
      {navItems.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname === item.href || pathname.startsWith(item.href + "/")}
          onClick={onNavigate}
        />
      ))}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
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
    return null;
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo5bib className="h-7" />
            <span className="text-xs font-semibold text-muted-foreground">Admin</span>
          </Link>
        </div>
        <Separator />
        <nav className="flex-1 p-3">
          <SidebarContent />
        </nav>
        <Separator />
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 md:px-6">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger className="md:hidden inline-flex items-center justify-center rounded-md size-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <SheetHeader className="p-4">
                <SheetTitle className="flex items-center gap-2">
                  <Logo5bib className="h-6" />
                  <span className="text-xs font-semibold text-muted-foreground">Admin</span>
                </SheetTitle>
              </SheetHeader>
              <Separator />
              <nav className="p-3">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </nav>
              <Separator />
              <div className="p-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-muted-foreground"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="size-4" />
                  Đăng xuất
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Admin
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              className="hidden md:flex"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
