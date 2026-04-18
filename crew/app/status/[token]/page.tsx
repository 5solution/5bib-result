import type { Metadata } from "next";
import { getStatus } from "@/lib/api";
import { getLeaderTeam, type LeaderPortalResponse } from "@/lib/leader-api";
import {
  getDirectory,
  getContacts,
  type TeamDirectoryResponse,
  type PublicEventContactsResponse,
} from "@/lib/directory-api";
import { getMyStation, type MyStationView } from "@/lib/station-api";
import { getLeaderSupplyView, type LeaderSupplyView } from "@/lib/supply-api";
import { StatusTabs } from "./_status-tabs";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  try {
    const s = await getStatus(token);
    const title = `${s.full_name} — ${s.event_name}`;
    const description = `Trạng thái đăng ký vai trò "${s.role_name}" cho sự kiện ${s.event_name}. Xem QR check-in và thông tin tham gia.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "Không tìm thấy thông tin",
      robots: { index: false, follow: false },
    };
  }
}

async function fetchSignedPdfUrl(token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/public/team-contract-pdf/${token}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { url?: string };
    return body.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Try to fetch leader portal data. A 403 simply means "not a leader" —
 * swallow into null so the status page can still render without the
 * management tab.
 */
async function tryFetchLeaderPortal(
  token: string,
): Promise<LeaderPortalResponse | null> {
  try {
    return await getLeaderTeam(token);
  } catch {
    return null;
  }
}

async function tryFetchLeaderSupply(
  token: string,
): Promise<LeaderSupplyView | null> {
  try {
    return await getLeaderSupplyView(token);
  } catch {
    return null;
  }
}

async function tryFetchMyStation(
  token: string,
): Promise<MyStationView | null> {
  try {
    return await getMyStation(token);
  } catch {
    return null;
  }
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let status;
  let errorMessage: string | null = null;
  try {
    status = await getStatus(token);
  } catch (e) {
    errorMessage = (e as Error).message;
  }

  if (errorMessage || !status) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold">Không tìm thấy thông tin</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          {errorMessage ?? "Link không hợp lệ hoặc đã hết hạn."}
        </p>
      </div>
    );
  }

  // Fetch signed PDF + leader probe + directory + contacts + station +
  // leader supply in parallel — all are best-effort. Unauthorized fetches
  // degrade to null so the tabs render graceful empty states.
  const [
    signedPdfUrl,
    leaderPortal,
    directory,
    contacts,
    myStation,
    leaderSupply,
  ]: [
    string | null,
    LeaderPortalResponse | null,
    TeamDirectoryResponse | null,
    PublicEventContactsResponse | null,
    MyStationView | null,
    LeaderSupplyView | null,
  ] = await Promise.all([
    status.contract_status === "signed"
      ? fetchSignedPdfUrl(token)
      : Promise.resolve(null),
    tryFetchLeaderPortal(token),
    getDirectory(token).catch(() => null),
    getContacts(token).catch(() => null),
    tryFetchMyStation(token),
    tryFetchLeaderSupply(token),
  ]);

  return (
    <StatusTabs
      token={token}
      status={status}
      signedPdfUrl={signedPdfUrl}
      leaderPortal={leaderPortal}
      directory={directory}
      contacts={contacts}
      myStation={myStation}
      leaderSupply={leaderSupply}
    />
  );
}
