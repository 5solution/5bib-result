"use client";

/**
 * F-069 — Merchant Portal race list (merchant.5bib.com/dashboard).
 * 5Solution "Velocity" design. Shows the logged-in BTC user + their
 * accessible races as cover-image cards. Auth via Logto merchant session
 * (proxy injects merchant-scoped token → backend guard).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { useLang } from "@/lib/mp/lang-context";
import {
  merchantPortalControllerGetMe,
  merchantPortalControllerGetRaces,
} from "@/lib/api-generated/sdk.gen";
import type {
  MerchantMeResponseDto,
  MerchantRaceItemDto,
} from "@/lib/api-generated/types.gen";
import { t } from "@/lib/mp/i18n";
import { fmt, parseDate } from "@/lib/mp/fmt";
import { AppShell, Card, EmptyState, RaceStatusBadge, type MpUser } from "@/components/mp/ui";
import { Icons } from "@/components/mp/icons";

const COVERS = ["/mp/race-cover-1.jpg", "/mp/race-cover-2.jpg"];

/** Extract VN error message — backend trả message dạng {vi,en} object. */
function extractMsg(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; vi?: unknown; en?: unknown };
    const m = e.message;
    if (typeof m === "string") return m;
    if (m && typeof m === "object") {
      const o = m as { vi?: unknown; en?: unknown };
      if (typeof o.vi === "string") return o.vi;
      if (typeof o.en === "string") return o.en;
    }
    if (typeof e.vi === "string") return e.vi;
    if (typeof e.en === "string") return e.en;
  }
  return "Không tải được dữ liệu";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toMpUser(me: MerchantMeResponseDto | null): MpUser {
  if (!me) return { name: "—", email: "", initials: "?" };
  return { name: me.userName, email: me.email, initials: initialsOf(me.userName) };
}

function RaceCard({ race, lang, cover }: { race: MerchantRaceItemDto; lang: "vi" | "en"; cover: string }) {
  const [hover, setHover] = useState(false);
  const d = parseDate(race.eventStartDate);
  return (
    <a
      href={`/races/${race.raceId}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: "#fff",
        border: "1px solid var(--5s-border)",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-sm)",
        transform: hover ? "translateY(-2px)" : "none",
        transition: "all .28s var(--ease-out-expo)",
      }}
    >
      <div style={{ height: 132, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            transform: hover ? "scale(1.05)" : "scale(1)",
            transition: "transform .7s ease",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent 60%)" }} />
        <div style={{ position: "absolute", top: 11, left: 11 }}>
          <RaceStatusBadge status={race.status} lang={lang} />
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <h3
          style={{
            fontSize: 15.5,
            fontWeight: 800,
            lineHeight: 1.25,
            color: "var(--5s-text)",
            marginBottom: 8,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: 38,
          }}
        >
          {race.title}
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--5s-text-muted)", marginBottom: 14 }}>
          <Icons.Calendar size={13} color="var(--5s-text-subtle)" />
          <span className="mp-data">{d ? fmt.date(d, lang) : "—"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 13, borderTop: "1px solid var(--5s-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Icons.Ticket size={15} color="var(--5s-blue)" />
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 16, color: "var(--5s-text)" }}>{fmt.num(race.ticketsSold, lang)}</span>
            <span style={{ fontSize: 11.5, color: "var(--5s-text-subtle)" }}>{t("tickets_sold", lang)}</span>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 700, color: "var(--5s-blue)" }}>
            {t("view_report", lang)} <Icons.ChevR size={13} color="var(--5s-blue)" />
          </span>
        </div>
      </div>
    </a>
  );
}

export default function MerchantDashboard() {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lang, toggleLang } = useLang();
  const [me, setMe] = useState<MerchantMeResponseDto | null>(null);
  const [races, setRaces] = useState<MerchantRaceItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) window.location.href = "/api/logto/sign-in";
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
      console.error("[merchant dashboard] load failed:", err);
      setError(extractMsg(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const finance = !!me?.permissions.includes("revenue_report");
  const user = useMemo(() => toMpUser(me), [me]);

  // Group by tenant only when the user spans multiple BTCs.
  const multiTenant = (me?.tenantIds.length ?? 0) > 1;
  const groups = useMemo(() => {
    if (!multiTenant) return [{ tenantId: null as number | null, races }];
    const byTenant = new Map<number, MerchantRaceItemDto[]>();
    for (const r of races) {
      const arr = byTenant.get(r.tenantId) ?? [];
      arr.push(r);
      byTenant.set(r.tenantId, arr);
    }
    return [...byTenant.entries()].map(([tenantId, rs]) => ({ tenantId, races: rs }));
  }, [races, multiTenant]);

  if (authLoading || (!isAuthenticated && !error)) {
    return (
      <div className="mp-root" style={{ display: "grid", minHeight: "100vh", placeItems: "center", fontSize: 14, color: "var(--5s-text-muted)", background: "var(--5s-bg)" }}>
        {t("loading", lang)}
      </div>
    );
  }

  let coverIdx = 0;
  const nextCover = () => COVERS[coverIdx++ % COVERS.length];

  return (
    <AppShell lang={lang} onLang={toggleLang} finance={finance} active="races" breadcrumb={[t("nav_races", lang)]} user={user} onRefresh={load}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em" }}>{t("your_races", lang)}</h1>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 13px",
            borderRadius: 99,
            background: "var(--5s-blue-50)",
            color: "var(--5s-blue)",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <Icons.Trophy size={14} color="var(--5s-blue)" />
          {fmt.num(races.length, lang)} {t("races_count", lang)}
        </span>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="shimmer" style={{ height: 244, borderRadius: 14, background: "var(--5s-surface)" }} />
          ))}
        </div>
      ) : error ? (
        <Card style={{ borderColor: "var(--5s-danger)", background: "var(--5s-danger-bg)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "12px 0" }}>
            <Icons.Alert size={28} color="var(--5s-danger)" />
            <p style={{ fontSize: 14, color: "var(--5s-danger)", textAlign: "center", margin: 0 }}>{error}</p>
            <button
              onClick={load}
              className="mp-focusable"
              style={{ border: "1px solid var(--5s-border)", background: "#fff", borderRadius: 9, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {t("retry", lang)}
            </button>
          </div>
        </Card>
      ) : races.length === 0 ? (
        <Card>
          <EmptyState icon={Icons.Inbox} title={t("no_races_title", lang)} body={t("no_races_body", lang)} />
        </Card>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.tenantId ?? "all"} style={{ marginBottom: 28 }}>
              {multiTenant && g.tenantId != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                  <Icons.Building size={15} color="var(--5s-text-subtle)" />
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, letterSpacing: ".02em", color: "var(--5s-text)" }}>BTC #{g.tenantId}</span>
                  <span style={{ fontSize: 12, color: "var(--5s-text-subtle)" }}>
                    · {fmt.num(g.races.length, lang)} {t("races_count", lang)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--5s-border)" }} />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
                {g.races.map((r) => (
                  <RaceCard key={r.raceId} race={r} lang={lang} cover={nextCover()} />
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 12.5, color: "var(--5s-text-subtle)", marginTop: 4 }}>
            {t("showing", lang)} {fmt.num(races.length, lang)} {t("races_count", lang)}
          </div>
        </>
      )}
    </AppShell>
  );
}
