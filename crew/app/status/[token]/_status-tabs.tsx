"use client";

import { useState } from "react";
import type { StatusResponse } from "@/lib/api";
import type { LeaderPortalResponse } from "@/lib/leader-api";
import type {
  TeamDirectoryResponse,
  PublicEventContactsResponse,
} from "@/lib/directory-api";
import type { MyStationView } from "@/lib/station-api";
import type { LeaderSupplyView } from "@/lib/supply-api";
import { PersonalTab } from "./_personal-tab";
import { ContactsTab } from "./_contacts-tab";
import { LeaderManagementTab } from "./_leader-management-tab";

type TabKey = "self" | "contacts" | "management";

/**
 * Status page shell.
 *  - "Thông tin cá nhân" — always shown (default); now includes v1.6 station
 *    section + crew supply confirmation.
 *  - "Liên lạc" — always shown. Hub for chat group, emergency contacts, my-team
 *    directory, cross-team leaders.
 *  - "Quản lý nhóm" — leaders only. Combines the old "Nhóm của tôi" roster
 *    with v1.6 station + supply management.
 */
export function StatusTabs({
  token,
  status,
  signedPdfUrl,
  leaderPortal,
  directory,
  contacts,
  myStation,
  leaderSupply,
}: {
  token: string;
  status: StatusResponse;
  signedPdfUrl: string | null;
  leaderPortal: LeaderPortalResponse | null;
  directory: TeamDirectoryResponse | null;
  contacts: PublicEventContactsResponse | null;
  myStation: MyStationView | null;
  leaderSupply: LeaderSupplyView | null;
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
            active={tab === "management"}
            label={`Quản lý nhóm (${leaderPortal?.members.length ?? 0})`}
            shortLabel={`Quản lý (${leaderPortal?.members.length ?? 0})`}
            onClick={() => setTab("management")}
          />
        ) : null}
      </div>

      {tab === "self" ? (
        <PersonalTab
          token={token}
          status={status}
          signedPdfUrl={signedPdfUrl}
          myStation={myStation}
          leaderSupply={leaderSupply}
        />
      ) : null}

      {tab === "contacts" ? (
        <ContactsTab
          status={status}
          directory={directory}
          contacts={contacts}
        />
      ) : null}

      {isLeader && tab === "management" && leaderPortal ? (
        <LeaderManagementTab
          token={token}
          leaderPortal={leaderPortal}
          leaderSupply={leaderSupply}
        />
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
