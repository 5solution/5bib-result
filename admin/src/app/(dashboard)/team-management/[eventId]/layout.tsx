"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "dashboard", label: "Tổng quan" },
  { slug: "roles", label: "Vai trò" },
  { slug: "registrations", label: "Nhân sự" },
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
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => {
          const href = `${base}/${tab.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.slug}
              href={href}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
