"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listRegistrations } from "@/lib/team-api";

// v1.6 UX update: flat nav per Danny feedback — mỗi entry là 1 tab
// riêng, không gộp dropdown.

type NavItem = {
  slug: string;
  label: string;
};

const ITEMS: NavItem[] = [
  { slug: "dashboard", label: "Tổng quan" },
  { slug: "roles", label: "Vai trò" },
  { slug: "registrations", label: "Nhân sự" },
  { slug: "stations", label: "Trạm" },
  { slug: "supply-items", label: "Kho vật tư" },
  { slug: "supply", label: "Kế hoạch vật tư" },
  { slug: "contacts", label: "Liên lạc khẩn cấp" },
  { slug: "schedule-emails", label: "Email lịch trình" },
  { slug: "scan", label: "Scan QR" },
  { slug: "export", label: "Xuất báo cáo" },
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

  const fetchPending = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    try {
      const res = await listRegistrations(token, eventId, {
        status: "pending_approval",
        page: 1,
        limit: 1,
      });
      setPendingCount(res.total ?? 0);
    } catch {
      setPendingCount(0);
    }
  }, [token, eventId]);

  useEffect(() => {
    void fetchPending();
    const t = window.setInterval(() => void fetchPending(), 30_000);
    return () => window.clearInterval(t);
  }, [fetchPending]);

  return (
    <div className="space-y-4">
      <nav
        className="flex items-end gap-1 overflow-x-auto border-b scrollbar-hide"
        aria-label="Team management navigation"
      >
        {ITEMS.map((item) => {
          const href = `${base}/${item.slug}`;
          // Match exact path OR nested (e.g. /registrations/:id still highlights "Nhân sự")
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          const showBadge =
            item.slug === "registrations" && pendingCount > 0;
          return (
            <Link
              key={item.slug}
              href={href}
              className={[
                "whitespace-nowrap px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px",
                active
                  ? "border-blue-600 text-blue-700 font-semibold"
                  : "border-transparent text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              {item.label}
              {showBadge ? (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-700">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
