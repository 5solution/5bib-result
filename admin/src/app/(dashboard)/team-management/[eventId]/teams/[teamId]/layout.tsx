"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getTeamCategory, type TeamCategory } from "@/lib/team-api";
import { ArrowLeft } from "lucide-react";

// v1.8 — Team detail layout. Sub-tabs cover per-team operations:
// Overview ("") / Roles ("roles") / Stations ("stations") / Supply / Config.

type SubNav = { slug: string; label: string };

const SUBNAV: SubNav[] = [
  { slug: "", label: "Tổng quan" },
  { slug: "roles", label: "Vai trò" },
  { slug: "stations", label: "Trạm" },
  { slug: "supply", label: "Vật tư" },
  { slug: "config", label: "Cấu hình" },
];

export default function TeamDetailLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const params = useParams<{ eventId: string; teamId: string }>();
  const pathname = usePathname();
  const eventId = params.eventId;
  const teamId = Number(params.teamId);
  const base = `/team-management/${eventId}/teams/${teamId}`;
  const { token } = useAuth();
  const [team, setTeam] = useState<TeamCategory | null>(null);

  const loadTeam = useCallback(async () => {
    if (!token || !Number.isFinite(teamId)) return;
    try {
      setTeam(await getTeamCategory(token, teamId));
    } catch {
      setTeam(null);
    }
  }, [token, teamId]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/team-management/${eventId}/teams`}>
          <button
            type="button"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="mr-1 size-4" /> Danh sách team
          </button>
        </Link>
        <div className="h-4 w-px bg-gray-300" />
        <div className="min-w-0 flex items-center gap-2">
          {team ? (
            <span
              aria-hidden
              className="inline-block size-4 rounded-full flex-shrink-0"
              style={{ background: team.color }}
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 truncate">
              {team?.name ?? "Đang tải..."}
            </h1>
            {team ? (
              <p className="text-xs text-gray-500 font-mono">{team.slug}</p>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        className="flex items-end gap-1 overflow-x-auto border-b scrollbar-hide"
        aria-label="Team detail sub-navigation"
      >
        {SUBNAV.map((item) => {
          const href = item.slug ? `${base}/${item.slug}` : base;
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
