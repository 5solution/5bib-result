"use client";

/**
 * 5BIB Admin Dashboard Layout — FEATURE-022 BR-DESIGN-05/11.
 *
 * Sidebar 240px dark slate (sticky desktop, Sheet drawer mobile)
 *   + Topbar 60px white (breadcrumb + ⌘K + bell + page actions slot)
 *   + Main content area.
 *
 * Sidebar va Topbar tach ra component rieng o `admin-shell/`.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LogOut, Menu } from "lucide-react";
import Logo5bib from "@/components/Logo5bib";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { PromptProvider } from "@/components/prompt-dialog";
import {
  Sidebar,
  SidebarNav,
  SidebarUserCard,
} from "@/components/admin-shell/Sidebar";
import { Topbar } from "@/components/admin-shell/Topbar";

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
  const userName =
    userInfo?.name ?? userInfo?.username ?? userInfo?.email ?? "Admin";

  return (
    <div className="flex min-h-screen bg-[var(--admin-bg)]">
      {/* Desktop Sidebar — 240px dark slate, sticky.
          F-011 BR-PB-01: data-admin-sidebar enables Command Center fullscreen
          (body[data-fullscreen]) to hide admin shell. */}
      <aside
        data-admin-sidebar
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] lg:flex"
      >
        <Sidebar
          userName={userName}
          userRole="Super Admin"
          onLogout={handleLogout}
        />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <Topbar
          leftSlot={
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
                <nav className="flex-1 overflow-y-auto px-2.5 py-3.5 scrollbar-thin [scrollbar-gutter:stable]">
                  <SidebarNav onNavigate={() => setMobileOpen(false)} />
                </nav>
                <div className="border-t border-white/8">
                  <SidebarUserCard
                    userName={userName}
                    userRole="Super Admin"
                    onLogout={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          }
        />

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
