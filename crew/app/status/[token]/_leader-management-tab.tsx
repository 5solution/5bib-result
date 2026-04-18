"use client";

import { useState } from "react";
import type { LeaderPortalResponse } from "@/lib/leader-api";
import type { LeaderSupplyView } from "@/lib/supply-api";
import { LeaderTeamTab } from "./_team-tab";
import { LeaderStationsView } from "./_leader-stations-view";
import { LeaderSupplyManager } from "./_leader-supply-manager";

/**
 * v1.6 — Combined "Quản lý nhóm" tab. Replaces the old "Nhóm của tôi" tab
 * with two sub-tabs:
 *  1. Thành viên — existing team roster + QR check-in + bulk confirm
 *  2. Trạm & Vật tư — read-only station coverage + full supply workflow
 *     (order → allocation → supplements)
 */
type SubTab = "members" | "stations-supply";

export function LeaderManagementTab({
  token,
  leaderPortal,
  leaderSupply,
}: {
  token: string;
  leaderPortal: LeaderPortalResponse;
  leaderSupply: LeaderSupplyView | null;
}): React.ReactElement {
  const [sub, setSub] = useState<SubTab>("members");

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-semibold flex items-center gap-2">
          <span aria-hidden>🏁</span>
          <span>Quản lý nhóm</span>
        </h2>
        <p
          className="text-xs"
          style={{ color: "var(--5bib-text-muted)" }}
        >
          {leaderPortal.leader.role_name} · {leaderPortal.members.length} thành viên
        </p>
      </div>

      <div
        className="flex gap-1 rounded-lg border p-1 text-xs font-medium"
        role="tablist"
        aria-label="Quản lý nhóm sub-tabs"
        style={{ background: "#f9fafb" }}
      >
        <SubTabButton
          active={sub === "members"}
          label="👥 Thành viên"
          onClick={() => setSub("members")}
        />
        <SubTabButton
          active={sub === "stations-supply"}
          label="📦 Trạm & Vật tư"
          onClick={() => setSub("stations-supply")}
        />
      </div>

      {sub === "members" ? (
        <LeaderTeamTab token={token} initial={leaderPortal} />
      ) : null}

      {sub === "stations-supply" ? (
        <StationsAndSupply
          token={token}
          leaderSupply={leaderSupply}
        />
      ) : null}
    </section>
  );
}

function SubTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex-1 rounded-md px-2 py-1.5 transition-colors whitespace-nowrap"
      style={
        active
          ? { background: "#1d4ed8", color: "#ffffff" }
          : { background: "transparent", color: "#374151" }
      }
    >
      {label}
    </button>
  );
}

function StationsAndSupply({
  token,
  leaderSupply,
}: {
  token: string;
  leaderSupply: LeaderSupplyView | null;
}): React.ReactElement {
  const [view, setView] = useState<"stations" | "supply">("stations");

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        <ToggleButton
          active={view === "stations"}
          onClick={() => setView("stations")}
        >
          📍 Trạm
        </ToggleButton>
        <ToggleButton
          active={view === "supply"}
          onClick={() => setView("supply")}
        >
          📦 Vật tư
        </ToggleButton>
      </div>

      {view === "stations" ? (
        <LeaderStationsView leaderSupply={leaderSupply} />
      ) : null}

      {view === "supply" ? (
        <LeaderSupplyManager token={token} initial={leaderSupply} />
      ) : null}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 font-medium transition-colors"
      style={
        active
          ? {
              background: "#1d4ed8",
              color: "#ffffff",
              borderColor: "#1d4ed8",
            }
          : {
              background: "#ffffff",
              color: "#374151",
              borderColor: "#d1d5db",
            }
      }
    >
      {children}
    </button>
  );
}
