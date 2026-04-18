"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listRegistrations } from "@/lib/team-api";

const TABS = [
  { slug: "dashboard", label: "Tổng quan" },
  { slug: "roles", label: "Vai trò" },
  { slug: "registrations", label: "Nhân sự" },
  { slug: "schedule-emails", label: "Email lịch trình" },
  { slug: "contacts", label: "📞 Liên lạc khẩn cấp" },
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
        status: "pending",
        page: 1,
        limit: 1,
      });
      setPendingCount(res.total);
    } catch {
      // non-fatal — badge just stays at 0 if the probe fails
    }
  }, [token, eventId]);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  return (
    <div className="space-y-5">
      <nav
        className="flex flex-nowrap gap-1 overflow-x-auto whitespace-nowrap scrollbar-thin border-b"
        style={{ borderColor: "#e5e7eb" }}
      >
        {TABS.map((tab) => {
          const href = `${base}/${tab.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const showPendingBadge =
            tab.slug === "registrations" && pendingCount > 0;
          return (
            <Link
              key={tab.slug}
              href={href}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-150 whitespace-nowrap"
              style={{
                borderBottomColor: active ? "#2563eb" : "transparent",
                color: active ? "#1d4ed8" : "#6b7280",
                background: "transparent",
              }}
            >
              {tab.label}
              {showPendingBadge ? (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs font-bold animate-pulse"
                  style={{ background: "#fef3c7", color: "#b45309" }}
                >
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
