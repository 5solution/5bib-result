"use client";

/**
 * F-069 M4 — Merchant Portal dashboard (merchant.5bib.com).
 * Shows the logged-in BTC user + their accessible races. Auth via Logto
 * merchant session (proxy injects merchant-scoped token → backend guard).
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import {
  merchantPortalControllerGetMe,
  merchantPortalControllerGetRaces,
} from "@/lib/api-generated/sdk.gen";
import type {
  MerchantMeResponseDto,
  MerchantRaceItemDto,
} from "@/lib/api-generated/types.gen";

const RACE_STATUS_LABEL: Record<string, string> = {
  COMPLETE: "Đã kết thúc",
  ONGOING: "Đang diễn ra",
  GENERATED_CODE: "Chuẩn bị",
  CANCEL: "Đã hủy",
};
const PERMISSION_LABEL: Record<string, string> = {
  ticket_report: "Báo cáo vé",
  revenue_report: "Báo cáo doanh thu",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString("vi-VN");
}

export default function MerchantDashboard() {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [me, setMe] = useState<MerchantMeResponseDto | null>(null);
  const [races, setRaces] = useState<MerchantRaceItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect to Logto sign-in if not authenticated.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/api/logto/sign-in";
    }
  }, [authLoading, isAuthenticated]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [meRes, racesRes] = await Promise.all([
        merchantPortalControllerGetMe({ ...authHeaders(token) }),
        merchantPortalControllerGetRaces({ ...authHeaders(token) }),
      ]);
      if (meRes.error) throw meRes.error;
      if (racesRes.error) throw racesRes.error;
      setMe(meRes.data ?? null);
      setRaces(racesRes.data?.races ?? []);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Không tải được dữ liệu";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  if (authLoading || (!isAuthenticated && !error)) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-stone-500">
        Đang tải…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">
            Báo cáo giải chạy
          </h1>
          {me && (
            <p className="mt-1 text-sm text-stone-500">
              Xin chào <span className="font-medium text-stone-700">{me.userName}</span> · {me.email}
            </p>
          )}
        </div>
        {me && (
          <div className="flex flex-wrap gap-1.5">
            {me.permissions.map((p) => (
              <span
                key={p}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {PERMISSION_LABEL[p] ?? p}
              </span>
            ))}
          </div>
        )}
      </header>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-stone-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={load}
            className="mt-3 rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Thử lại
          </button>
        </div>
      ) : races.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-12 text-center text-sm text-stone-500">
          Chưa có giải nào được gán cho tài khoản của bạn. Liên hệ BTC/5BIB để được cấp quyền.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Giải</th>
                <th className="px-4 py-2.5 font-medium">Ngày</th>
                <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                <th className="px-4 py-2.5 text-right font-medium">Vé đã bán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {races.map((r) => (
                <tr key={r.raceId} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <a
                      href={`/races/${r.raceId}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {r.title}
                    </a>
                    <div className="font-mono text-xs text-stone-400">id={r.raceId}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{fmtDate(r.eventStartDate)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {RACE_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-stone-800">
                    {r.ticketsSold.toLocaleString("vi-VN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="mt-8 flex items-center justify-between border-t border-stone-200 pt-4 text-xs text-stone-400">
        <span>5BIB Merchant Portal{me ? ` · ${me.assignedRaceCount} giải` : ""}</span>
        <a href="/api/logto/sign-out" className="hover:text-stone-600">Đăng xuất</a>
      </footer>
    </div>
  );
}
