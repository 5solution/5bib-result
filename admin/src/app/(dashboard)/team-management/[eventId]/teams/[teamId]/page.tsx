"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getTeamCategory, type TeamCategory } from "@/lib/team-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MapPin, Package } from "lucide-react";

// v1.8 — Team overview: stats tiles + description + quick links into sub-tabs.

export default function TeamOverviewPage(): React.ReactElement {
  const params = useParams<{ eventId: string; teamId: string }>();
  const eventId = params.eventId;
  const teamId = Number(params.teamId);
  const { token } = useAuth();

  const [team, setTeam] = useState<TeamCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(teamId)) return;
    try {
      setError(null);
      setTeam(await getTeamCategory(token, teamId));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!team) return <Skeleton className="h-64" />;

  const base = `/team-management/${eventId}/teams/${teamId}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href={`${base}/roles`}
          className="rounded-xl border bg-white p-4 card-hover"
        >
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
            <Users className="size-4" /> Vai trò
          </div>
          <div className="mt-2 font-display text-3xl font-bold">
            {team.role_count}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Leader / Crew / TNV thuộc team
          </p>
        </Link>
        <Link
          href={`${base}/stations`}
          className="rounded-xl border bg-white p-4 card-hover"
        >
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
            <MapPin className="size-4" /> Trạm
          </div>
          <div className="mt-2 font-display text-3xl font-bold">
            {team.station_count}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Số trạm team đang vận hành
          </p>
        </Link>
        <Link
          href={`${base}/supply`}
          className="rounded-xl border bg-white p-4 card-hover"
        >
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
            <Package className="size-4" /> Vật tư
          </div>
          <div className="mt-2 font-display text-3xl font-bold">
            {team.supply_plan_count}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Số mục trong kế hoạch vật tư
          </p>
        </Link>
      </div>

      {team.description ? (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Mô tả</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {team.description}
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Thông tin</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">Slug</dt>
          <dd className="font-mono text-gray-900">{team.slug}</dd>
          <dt className="text-gray-500">Màu chủ đạo</dt>
          <dd className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-3 rounded-full"
              style={{ background: team.color }}
            />
            <code className="font-mono text-xs">{team.color}</code>
          </dd>
          <dt className="text-gray-500">Thứ tự</dt>
          <dd>{team.sort_order}</dd>
          <dt className="text-gray-500">Tạo lúc</dt>
          <dd className="text-xs">
            {new Date(team.created_at).toLocaleString("vi-VN")}
          </dd>
        </dl>
      </div>
    </div>
  );
}
