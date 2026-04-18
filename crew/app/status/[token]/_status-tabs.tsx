"use client";

import { useState } from "react";
import type { StatusResponse } from "@/lib/api";
import type { LeaderPortalResponse } from "@/lib/leader-api";
import type {
  TeamDirectoryResponse,
  PublicEventContactsResponse,
} from "@/lib/directory-api";
import { LeaderTeamTab } from "./_team-tab";
import { PersonalTab } from "./_personal-tab";
import { ContactsTab } from "./_contacts-tab";

type TabKey = "self" | "contacts" | "team";

/**
 * Status page shell.
 *  - "Thông tin cá nhân" — always shown (default).
 *  - "Liên lạc" — v1.5: always shown. Hub for chat group link, emergency
 *    contacts, my-team directory, cross-team leaders.
 *  - "Nhóm của tôi" — only for tokens the backend confirms as leader.
 */
export function StatusTabs({
  token,
  status,
  signedPdfUrl,
  leaderPortal,
  directory,
  contacts,
}: {
  token: string;
  status: StatusResponse;
  signedPdfUrl: string | null;
  leaderPortal: LeaderPortalResponse | null;
  directory: TeamDirectoryResponse | null;
  contacts: PublicEventContactsResponse | null;
}): React.ReactElement {
  const isLeader = leaderPortal != null;
  const [tab, setTab] = useState<TabKey>("self");

  return (
    <div className="space-y-4 slide-up">
      <div
        className="flex gap-1 rounded-full border p-1 text-xs font-medium"
        role="tablist"
        aria-label="Status tabs"
        style={{ background: "#f9fafb" }}
      >
        <TabButton
          active={tab === "self"}
          label="Thông tin cá nhân"
          shortLabel="Cá nhân"
          onClick={() => setTab("self")}
        />
        <TabButton
          active={tab === "contacts"}
          label="Liên lạc 📞"
          shortLabel="Liên lạc"
          onClick={() => setTab("contacts")}
        />
        {isLeader ? (
          <TabButton
            active={tab === "team"}
            label={`Nhóm của tôi (${leaderPortal?.members.length ?? 0})`}
            shortLabel={`Nhóm (${leaderPortal?.members.length ?? 0})`}
            onClick={() => setTab("team")}
          />
        ) : null}
      </div>

      {tab === "self" ? (
        <PersonalTab
          token={token}
          status={status}
          signedPdfUrl={signedPdfUrl}
        />
      ) : null}

      {tab === "contacts" ? (
        <ContactsTab
          status={status}
          directory={directory}
          contacts={contacts}
        />
      ) : null}

      {isLeader && tab === "team" ? (
        <section className="card">
          <h2 className="font-semibold mb-3">Nhóm của tôi</h2>
          <LeaderTeamTab token={token} initial={leaderPortal} />
        </section>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  label,
  shortLabel,
  onClick,
}: {
  active: boolean;
  label: string;
  shortLabel?: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="flex-1 rounded-full px-2 py-1.5 transition-colors whitespace-nowrap"
      style={
        active
          ? {
              background: "#1d4ed8",
              color: "#ffffff",
            }
          : {
              background: "transparent",
              color: "#374151",
            }
      }
    >
      {/* Short label on <400px viewports, full label otherwise. */}
      <span className="hidden min-[400px]:inline">{label}</span>
      <span className="inline min-[400px]:hidden">{shortLabel ?? label}</span>
    </button>
  );
}
