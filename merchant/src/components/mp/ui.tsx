"use client";

/**
 * F-069 Merchant Portal — shared chrome (ported from mp-ui.jsx).
 * AppShell (sidebar + topbar), KPI cards, badges, buttons, empty states.
 * Inline-style approach kept from the mockup for fidelity (CSS vars).
 */
import type { CSSProperties, ReactNode } from "react";
import { Icons, type IconComponent } from "./icons";
import { DeltaPill } from "./charts";
import { t, lab, L, type Lang } from "@/lib/mp/i18n";
import { fmt } from "@/lib/mp/fmt";

const LOGO_WHITE = "/mp/5bib-logo-white.png";

// ---------- logo lockup (blue chip) ----------
export function PortalLogo({ sub = true }: { sub?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_WHITE} alt="5BIB" style={{ height: 26 }} />
      {sub && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.6)",
            borderLeft: "1px solid rgba(255,255,255,0.25)",
            paddingLeft: 10,
          }}
        >
          Merchant
        </span>
      )}
    </div>
  );
}

export interface MpUser {
  name: string;
  email: string;
  initials: string;
}

export type NavId = "races" | "tickets" | "revenue" | "settings";

interface SidebarProps {
  lang: Lang;
  /** true → finance role: shows Revenue nav item. */
  finance: boolean;
  active: NavId;
  user: MpUser;
  /** raceId of the currently-open race (drives tickets/revenue deep links). */
  currentRaceId?: number;
}

// ---------- Sidebar ----------
export function Sidebar({ lang, finance, active, user }: SidebarProps) {
  void finance; // báo cáo Vé/Doanh thu là TAB trong từng giải, KHÔNG phải nav global
  type NavItem = { id: NavId; icon: IconComponent; label: string; href: string };
  // Sidebar chỉ giữ điều hướng cấp ứng dụng. "Bán vé"/"Doanh thu" theo-giải nằm
  // trong race detail dưới dạng tab (tránh dead-link khi chưa chọn giải).
  const items: NavItem[] = [
    { id: "races", icon: Icons.Trophy, label: t("nav_races", lang), href: "/dashboard" },
    { id: "settings", icon: Icons.Settings, label: t("nav_settings", lang), href: "/settings" },
  ];

  return (
    <aside
      style={{
        width: 240,
        flex: "0 0 240px",
        background: "var(--5s-midnight)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ height: 56, display: "flex", alignItems: "center", padding: "0 18px", background: "var(--5s-blue-700)" }}>
        <PortalLogo />
      </div>
      <nav style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {items.map((it) => {
          const on = active === it.id;
          const Ico = it.icon;
          return (
            <a
              key={it.id}
              href={it.href}
              className="mp-focusable"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 12px",
                borderRadius: 9,
                cursor: "pointer",
                textDecoration: "none",
                background: on ? "var(--5s-blue)" : "transparent",
                color: on ? "#fff" : "rgba(255,255,255,0.62)",
                fontWeight: on ? 700 : 600,
                fontSize: 13.5,
                boxShadow: on ? "0 4px 14px rgba(29,73,255,0.4)" : "none",
                transition: "background .15s",
              }}
            >
              <Ico size={17} color={on ? "#fff" : "rgba(255,255,255,0.55)"} sw={2} />
              {it.label}
            </a>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 99,
            background: "var(--5s-blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            flex: "0 0 auto",
          }}
        >
          {user.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.name}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email}
          </div>
        </div>
        <a href="/api/logto/sign-out" title={t("logout", lang)} className="mp-focusable" style={{ display: "flex", borderRadius: 6 }}>
          <Icons.LogOut size={16} color="rgba(255,255,255,0.45)" />
        </a>
      </div>
    </aside>
  );
}

// ---------- IconBtn ----------
export function IconBtn({
  icon,
  title,
  onClick,
}: {
  icon: IconComponent;
  title?: string;
  onClick?: () => void;
}) {
  const Ico = icon;
  return (
    <button
      title={title}
      onClick={onClick}
      className="mp-focusable"
      style={{
        width: 34,
        height: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid var(--5s-border)",
        background: "#fff",
        borderRadius: 9,
        cursor: "pointer",
      }}
    >
      <Ico size={16} color="var(--5s-text-muted)" />
    </button>
  );
}

// ---------- Topbar ----------
interface TopbarProps {
  lang: Lang;
  onLang: () => void;
  breadcrumb: string[];
  center?: ReactNode;
  showRefresh?: boolean;
  onRefresh?: () => void;
}

export function Topbar({ lang, onLang, breadcrumb, center, showRefresh, onRefresh }: TopbarProps) {
  return (
    <header
      style={{
        height: 56,
        flex: "0 0 56px",
        borderBottom: "1px solid var(--5s-border)",
        background: "rgba(250,248,245,0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--5s-text-muted)", minWidth: 0 }}>
        {breadcrumb.map((b, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {i > 0 && <Icons.ChevR size={13} color="var(--5s-border-strong)" />}
            <span
              style={{
                fontWeight: i === breadcrumb.length - 1 ? 700 : 500,
                color: i === breadcrumb.length - 1 ? "var(--5s-text)" : "var(--5s-text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {b}
            </span>
          </span>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>{center}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {showRefresh && <IconBtn icon={Icons.Refresh} title={t("refresh", lang)} onClick={onRefresh} />}
        <button
          onClick={onLang}
          className="mp-focusable"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 34,
            padding: "0 11px",
            border: "1px solid var(--5s-border)",
            background: "#fff",
            borderRadius: 9,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: 12.5,
            color: "var(--5s-text)",
          }}
        >
          <Icons.Globe size={15} color="var(--5s-text-muted)" />
          {lang === "vi" ? "VI" : "EN"}
        </button>
      </div>
    </header>
  );
}

// ---------- AppShell ----------
interface AppShellProps {
  lang: Lang;
  onLang: () => void;
  finance: boolean;
  active: NavId;
  breadcrumb: string[];
  center?: ReactNode;
  showRefresh?: boolean;
  onRefresh?: () => void;
  user: MpUser;
  currentRaceId?: number;
  children: ReactNode;
}

export function AppShell({
  lang,
  onLang,
  finance,
  active,
  breadcrumb,
  center,
  showRefresh,
  onRefresh,
  user,
  currentRaceId,
  children,
}: AppShellProps) {
  return (
    <div className="mp-root" style={{ width: "100%", minHeight: "100vh", display: "flex", background: "var(--5s-bg)" }}>
      <Sidebar lang={lang} finance={finance} active={active} user={user} currentRaceId={currentRaceId} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar lang={lang} onLang={onLang} breadcrumb={breadcrumb} center={center} showRefresh={showRefresh} onRefresh={onRefresh} />
        <main className="mp-scroll" style={{ flex: 1, padding: "24px 28px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}

// ---------- Button ----------
type BtnVariant = "primary" | "secondary" | "ghost" | "destructive";

export function Btn({
  children,
  variant = "primary",
  icon,
  size = "md",
  onClick,
  disabled,
}: {
  children: ReactNode;
  variant?: BtnVariant;
  icon?: IconComponent;
  size?: "sm" | "md";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const Ico = icon;
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    borderRadius: 10,
    cursor: disabled ? "default" : "pointer",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
    fontSize: size === "sm" ? 12.5 : 13.5,
    padding: size === "sm" ? "7px 12px" : "9px 16px",
    transition: "all .15s",
    opacity: disabled ? 0.55 : 1,
  };
  const styles: Record<BtnVariant, CSSProperties> = {
    primary: { background: "var(--5s-blue)", color: "#fff", boxShadow: "0 4px 14px rgba(29,73,255,0.28)" },
    secondary: { background: "#fff", color: "var(--5s-text)", borderColor: "var(--5s-border)" },
    ghost: { background: "transparent", color: "var(--5s-text-muted)" },
    destructive: { background: "var(--5s-danger)", color: "#fff" },
  };
  return (
    <button onClick={onClick} disabled={disabled} className="mp-focusable" style={{ ...base, ...styles[variant] }}>
      {Ico && <Ico size={size === "sm" ? 14 : 16} color="currentColor" />}
      {children}
    </button>
  );
}

// ---------- Badges ----------
/** REAL backend race statuses: COMPLETE/ONGOING/GENERATED_CODE/CANCEL. */
export function RaceStatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const cfg =
    {
      GENERATED_CODE: { bg: "var(--5s-blue-50)", fg: "var(--5s-blue)", dot: "var(--5s-blue)", live: false },
      ONGOING: { bg: "var(--5s-danger-bg)", fg: "var(--5s-danger)", dot: "var(--5s-danger)", live: true },
      COMPLETE: { bg: "var(--5s-surface)", fg: "var(--5s-text-subtle)", dot: "var(--5s-border-strong)", live: false },
      CANCEL: { bg: "var(--5s-danger-bg)", fg: "var(--5s-danger)", dot: "var(--5s-danger)", live: false },
    }[status] ?? { bg: "var(--5s-surface)", fg: "var(--5s-text-subtle)", dot: "var(--5s-border-strong)", live: false };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 11px",
        borderRadius: 99,
        background: cfg.bg,
        color: cfg.fg,
        fontSize: 11.5,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: ".04em",
      }}
    >
      <span style={{ position: "relative", width: 7, height: 7, display: "inline-flex" }}>
        {cfg.live && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 99,
              background: cfg.dot,
              opacity: 0.7,
              animation: "mp-ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
        )}
        <span style={{ position: "relative", width: 7, height: 7, borderRadius: 99, background: cfg.dot }} />
      </span>
      {lab(L.raceStatus, status, lang)}
    </span>
  );
}

/** Backend financial_status (paid / voided / pending) + extras. */
export function OrderStatusBadge({ status, lang }: { status: string; lang: Lang }) {
  const cfg =
    {
      completed: { bg: "var(--5s-blue-50)", fg: "var(--5s-blue)" },
      paid: { bg: "var(--5s-success-bg)", fg: "var(--5s-success)" },
      pending: { bg: "var(--5s-warning-bg)", fg: "var(--5s-warning)" },
      cancelled: { bg: "var(--5s-danger-bg)", fg: "var(--5s-danger)" },
      refunded: { bg: "var(--5s-sky-100)", fg: "var(--5s-sky-600)" },
      voided: { bg: "var(--5s-surface)", fg: "var(--5s-text-subtle)" },
    }[status] ?? { bg: "var(--5s-surface)", fg: "var(--5s-text-subtle)" };
  return (
    <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 99, background: cfg.bg, color: cfg.fg, fontSize: 11.5, fontWeight: 700 }}>
      {lab(L.orderStatus, status, lang)}
    </span>
  );
}

export function PermBadge({ perms, lang }: { perms: string[]; lang: Lang }) {
  const finance = perms.includes("revenue_report");
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 11.5,
        fontWeight: 700,
        background: finance ? "#F3E8FF" : "var(--5s-blue-50)",
        color: finance ? "#7C3AED" : "var(--5s-blue)",
      }}
    >
      {finance ? t("role_finance", lang) : t("role_viewer", lang)}
    </span>
  );
}

// ---------- Card ----------
export function Card({ children, style, pad = 22 }: { children: ReactNode; style?: CSSProperties; pad?: number }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--5s-border)",
        borderRadius: 14,
        boxShadow: "var(--shadow-sm)",
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--5s-text)" }}>{children}</h3>
      {right}
    </div>
  );
}

// ---------- KPI card ----------
export function KpiCard({
  icon,
  iconBg,
  iconFg,
  label,
  value,
  delta,
  lang,
  accent,
  sub,
}: {
  icon: IconComponent;
  iconBg: string;
  iconFg: string;
  label: string;
  value: string;
  delta?: number;
  lang: Lang;
  accent?: string;
  sub?: string;
}) {
  const Ico = icon;
  return (
    <Card pad={18} style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--5s-text-muted)" }}>{label}</div>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
          <Ico size={16} color={iconFg} sw={2.2} />
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em", color: accent || "var(--5s-text)", lineHeight: 1 }}>
        {value}
      </div>
      {delta != null && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
          <DeltaPill value={delta} />
          <span style={{ fontSize: 11, color: "var(--5s-text-subtle)" }}>{t("vs_prev", lang)}</span>
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: "var(--5s-text-subtle)", marginTop: 8 }}>{sub}</div>}
    </Card>
  );
}

// ---------- empty state ----------
export function EmptyState({ icon, title, body }: { icon?: IconComponent; title: string; body: string }) {
  const Ico = icon || Icons.Inbox;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--5s-surface)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Ico size={26} color="var(--5s-text-subtle)" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--5s-text)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--5s-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

// ---------- updated-at footer ----------
export function UpdatedFooter({ lang, at }: { lang: Lang; at?: Date }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 18, fontSize: 12, color: "var(--5s-text-subtle)" }}>
      <Icons.Clock size={13} color="var(--5s-text-subtle)" />
      {t("updated_at", lang)}: <span className="mp-data">{fmt.dateTime(at ?? new Date())}</span>
    </div>
  );
}
