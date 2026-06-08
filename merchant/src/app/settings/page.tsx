"use client";

/**
 * F-069 — Merchant Portal settings (merchant.5bib.com/settings).
 * 5Solution "Velocity" design. Language preference + account info +
 * assigned races chips. Ported from mockup SettingsScreen, wired to /me
 * and /races real data.
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
import { t, LANGS } from "@/lib/mp/i18n";
import { AppShell, Card, PermBadge, type MpUser } from "@/components/mp/ui";
import { Segmented, type SegOption } from "@/components/mp/charts";
import type { Lang } from "@/lib/mp/i18n";

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--5s-surface)" }}>
      <span style={{ fontSize: 13, color: "var(--5s-text-muted)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13.5, color: "var(--5s-text)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const { lang, setLang } = useLang();
  const [me, setMe] = useState<MerchantMeResponseDto | null>(null);
  const [races, setRaces] = useState<MerchantRaceItemDto[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) window.location.href = "/api/logto/sign-in";
  }, [authLoading, isAuthenticated]);

  const load = useCallback(async () => {
    if (!token) return;
    const [meRes, racesRes] = await Promise.all([
      merchantPortalControllerGetMe({ ...authHeaders(token) }),
      merchantPortalControllerGetRaces({ ...authHeaders(token) }),
    ]);
    if (!meRes.error) setMe(meRes.data ?? null);
    if (!racesRes.error) setRaces(racesRes.data?.races ?? []);
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const finance = !!me?.permissions.includes("revenue_report");
  const user = useMemo(() => toMpUser(me), [me]);
  const langOptions: SegOption<Lang>[] = LANGS.map((l) => ({
    value: l.code,
    label: `${l.flag} ${l.short}`,
  }));

  if (authLoading || !isAuthenticated) {
    return (
      <div className="mp-root" style={{ display: "grid", minHeight: "100vh", placeItems: "center", fontSize: 14, color: "var(--5s-text-muted)", background: "var(--5s-bg)" }}>
        {t("loading", lang)}
      </div>
    );
  }

  return (
    <AppShell lang={lang} finance={finance} active="settings" breadcrumb={[t("nav_settings", lang)]} user={user}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em", marginBottom: 22 }}>{t("settings_title", lang)}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, maxWidth: 820 }}>
        <Card>
          <div className="mp-eyebrow" style={{ marginBottom: 14 }}>{t("language", lang)}</div>
          <Segmented<Lang> value={lang} onChange={setLang} options={langOptions} />
          <div style={{ fontSize: 12.5, color: "var(--5s-text-subtle)", marginTop: 12, lineHeight: 1.5 }}>
            {t("lang_save_note", lang)}
          </div>
        </Card>
        <Card>
          <div className="mp-eyebrow" style={{ marginBottom: 14 }}>{t("account", lang)}</div>
          <Row label={t("your_name", lang)} value={user.name} />
          <Row label={t("f_email", lang)} value={user.email} />
          <Row label={t("role_label", lang)} value={<PermBadge perms={me?.permissions ?? []} lang={lang} />} />
        </Card>
      </div>
      <Card style={{ maxWidth: 820, marginTop: 18 }}>
        <div className="mp-eyebrow" style={{ marginBottom: 14 }}>
          {t("assigned_races", lang)} · {races.length}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {races.map((r) => (
            <span key={r.raceId} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 99, background: "var(--5s-surface)", fontSize: 13, fontWeight: 600 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background:
                    r.status === "ONGOING"
                      ? "var(--5s-danger)"
                      : r.status === "GENERATED_CODE"
                        ? "var(--5s-blue)"
                        : "var(--5s-border-strong)",
                }}
              />
              {r.title}
            </span>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
