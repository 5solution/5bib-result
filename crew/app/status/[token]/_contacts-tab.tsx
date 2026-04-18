"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StatusResponse } from "@/lib/api";
import type {
  DirectoryMember,
  EventContact,
  LeaderContact,
  PublicEventContactsResponse,
  TeamDirectoryResponse,
  ContactType,
} from "@/lib/directory-api";
import { StatusBadge, deriveStatusKey } from "@/lib/status-style";

/* ────────────────────────────── Config ─────────────────────────────── */

type ChatPlatform = "zalo" | "telegram" | "whatsapp" | "other";

const PLATFORM_CONFIG: Record<
  ChatPlatform,
  { label: string; color: string; icon: string }
> = {
  zalo: { label: "Tham gia nhóm Zalo", color: "#0068FF", icon: "💙" },
  telegram: { label: "Tham gia nhóm Telegram", color: "#229ED9", icon: "✈️" },
  whatsapp: { label: "Tham gia nhóm WhatsApp", color: "#25D366", icon: "💬" },
  other: { label: "Tham gia nhóm chat", color: "#374151", icon: "🔗" },
};

const CONTACT_TYPE_CONFIG: Record<
  ContactType,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  medical: {
    label: "Y TẾ",
    icon: "🏥",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fca5a5",
  },
  rescue: {
    label: "CỨU HỘ",
    icon: "🚨",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fcd34d",
  },
  police: {
    label: "CÔNG AN",
    icon: "👮",
    color: "#374151",
    bg: "#f9fafb",
    border: "#d1d5db",
  },
  btc: {
    label: "BAN TỔ CHỨC",
    icon: "📋",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  other: {
    label: "KHÁC",
    icon: "📞",
    color: "#6b7280",
    bg: "#f3f4f6",
    border: "#e5e7eb",
  },
};

const CONTACT_TYPE_ORDER: ContactType[] = [
  "medical",
  "rescue",
  "police",
  "btc",
  "other",
];

/* ────────────────────────────── Helpers ────────────────────────────── */

function normalizePhone(raw: string): string {
  // Strip all whitespace + common separators so the tel: URI is dialable
  // without hyphens. Keep a leading `+` for international numbers.
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/* ────────────────────────────── Main tab ───────────────────────────── */

export function ContactsTab({
  status,
  directory,
  contacts,
}: {
  status: StatusResponse;
  directory: TeamDirectoryResponse | null;
  contacts: PublicEventContactsResponse | null;
}): React.ReactElement {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = (): void => {
    setRefreshing(true);
    router.refresh();
    // Give the server round-trip a beat before re-enabling — router.refresh()
    // doesn't return a promise we can await, so this is best-effort.
    window.setTimeout(() => setRefreshing(false), 1000);
  };

  const chatPlatform = (status.chat_platform ?? null) as ChatPlatform | null;
  const chatUrl = status.chat_group_url ?? null;

  const emergencyGroups = contacts?.contacts;
  const hasAnyEmergency =
    emergencyGroups != null &&
    CONTACT_TYPE_ORDER.some(
      (t) => (emergencyGroups[t]?.length ?? 0) > 0,
    );

  const myTeamMembers = directory?.my_team.members ?? [];
  const myTeamRoleName = directory?.my_team.role_name ?? "";
  const teamLeaders = directory?.team_leaders ?? [];

  return (
    <section
      className="card space-y-6"
      aria-label="Liên lạc"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <span aria-hidden>📞</span>
          <span>Liên lạc</span>
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="text-xs font-medium rounded-full px-3 py-1.5 border transition-colors disabled:opacity-60"
          style={{
            borderColor: "#d1d5db",
            color: "#374151",
            background: "#ffffff",
          }}
          aria-label="Làm mới dữ liệu liên lạc"
        >
          {refreshing ? "Đang tải..." : "🔄 Làm mới"}
        </button>
      </div>

      {/* 1. Chat group */}
      <section aria-labelledby="h-chat">
        <h3
          id="h-chat"
          className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
        >
          💬 Nhóm chat
        </h3>
        {chatUrl ? (
          <ChatGroupButton platform={chatPlatform ?? "other"} url={chatUrl} />
        ) : (
          <p className="text-xs text-gray-500">
            💬 Nhóm chat chưa được thiết lập. Liên hệ BTC để biết thêm.
          </p>
        )}
      </section>

      {/* 2. Emergency contacts */}
      <section aria-labelledby="h-emergency" className="mt-6">
        <h3
          id="h-emergency"
          className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
        >
          🚨 Liên lạc khẩn cấp
        </h3>
        {hasAnyEmergency && emergencyGroups ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CONTACT_TYPE_ORDER.flatMap((type) =>
              (emergencyGroups[type] ?? []).map((c) => (
                <EmergencyContactCard key={c.id} contact={c} />
              )),
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            BTC chưa cấu hình liên lạc khẩn cấp. Liên hệ admin để biết thêm.
          </p>
        )}
      </section>

      {/* 3. My team directory */}
      <section aria-labelledby="h-myteam" className="mt-6">
        <h3
          id="h-myteam"
          className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
        >
          👥 Nhóm tôi{myTeamRoleName ? ` — ${myTeamRoleName}` : ""} (
          {myTeamMembers.length} người)
        </h3>
        {myTeamMembers.length > 0 ? (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
            {myTeamMembers.map((m) => (
              <DirectoryMemberRow key={m.id} member={m} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">
            Chưa có thành viên nào được xác nhận trong nhóm này.
          </p>
        )}
      </section>

      {/* 4. Cross-team leaders — hide section entirely if empty */}
      {teamLeaders.length > 0 ? (
        <section aria-labelledby="h-leaders" className="mt-6">
          <h3
            id="h-leaders"
            className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3"
          >
            📞 Đầu mối các team khác
          </h3>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
            {teamLeaders.map((l) => (
              <LeaderContactRow key={l.id} leader={l} />
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

/* ────────────────────────────── Subcomponents ──────────────────────── */

function ChatGroupButton({
  platform,
  url,
}: {
  platform: ChatPlatform;
  url: string;
}): React.ReactElement {
  const cfg = PLATFORM_CONFIG[platform];
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: cfg.color, minHeight: 44 }}
      aria-label={cfg.label}
    >
      <span aria-hidden>{cfg.icon}</span>
      <span>{cfg.label}</span>
      <span aria-hidden>→</span>
    </a>
  );
}

function EmergencyContactCard({
  contact,
}: {
  contact: EventContact;
}): React.ReactElement {
  const cfg = CONTACT_TYPE_CONFIG[contact.contact_type];
  const primary = normalizePhone(contact.phone);
  const secondary = contact.phone2 ? normalizePhone(contact.phone2) : null;
  return (
    <article
      className="rounded-xl p-4 border"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <p
        className="text-xs font-bold tracking-wider mb-1.5"
        style={{ color: cfg.color }}
      >
        <span aria-hidden>{cfg.icon}</span> {cfg.label}
      </p>
      <p className="text-sm font-semibold text-gray-900 mb-2">
        {contact.contact_name}
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`tel:${primary}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: cfg.color, minHeight: 44 }}
          aria-label={`Gọi ${contact.contact_name} số ${contact.phone}`}
        >
          <span aria-hidden>📲</span>
          <span className="mono-data">{contact.phone}</span>
        </a>
        {secondary ? (
          <a
            href={`tel:${secondary}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-90"
            style={{
              color: cfg.color,
              borderColor: cfg.border,
              background: "#ffffff",
              minHeight: 44,
            }}
            aria-label={`Gọi số phụ ${contact.contact_name} số ${contact.phone2 ?? ""}`}
          >
            <span aria-hidden>📲</span>
            <span className="mono-data">{contact.phone2}</span>
            <span className="text-xs opacity-80">(phụ)</span>
          </a>
        ) : null}
      </div>
      {contact.note ? (
        <p className="text-xs text-gray-500 mt-2 italic">ℹ️ {contact.note}</p>
      ) : null}
    </article>
  );
}

function DirectoryMemberRow({
  member,
}: {
  member: DirectoryMember;
}): React.ReactElement {
  const statusKey = deriveStatusKey(member);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 bg-white">
      <Avatar name={member.full_name} url={member.avatar_url} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {member.is_leader ? (
            <span className="text-amber-500 mr-1" aria-label="Leader">
              👑
            </span>
          ) : null}
          {member.full_name}
        </p>
        <div className="mt-0.5">
          <StatusBadge status={statusKey} />
        </div>
      </div>
      <PhoneLink name={member.full_name} phone={member.phone} />
    </li>
  );
}

function LeaderContactRow({
  leader,
}: {
  leader: LeaderContact;
}): React.ReactElement {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 bg-white">
      <Avatar name={leader.full_name} url={null} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {leader.is_leader ? (
            <span className="text-amber-500 mr-1" aria-label="Leader">
              👑
            </span>
          ) : null}
          {leader.full_name}
          <span className="text-gray-500 font-normal">
            {" "}
            — {leader.role_name}
          </span>
        </p>
      </div>
      <PhoneLink name={leader.full_name} phone={leader.phone} />
    </li>
  );
}

function Avatar({
  name,
  url,
}: {
  name: string;
  url: string | null;
}): React.ReactElement {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="w-9 h-9 rounded-full object-cover bg-gray-100 flex-shrink-0"
      />
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center flex-shrink-0"
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

function PhoneLink({
  name,
  phone,
}: {
  name: string;
  phone: string;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const normalized = normalizePhone(phone);

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard write can fail on insecure origin / iOS old; silently ignore
    }
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <a
        href={`tel:${normalized}`}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-blue-700 transition-opacity hover:opacity-90"
        style={{ minHeight: 44 }}
        aria-label={`Gọi ${name} số ${phone}`}
      >
        <span aria-hidden>📲</span>
        <span>Gọi</span>
        <span className="mono-data font-normal opacity-90 hidden min-[480px]:inline">
          {phone}
        </span>
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="px-2 py-2 rounded-lg text-xs font-medium border text-gray-600 bg-white transition-colors hover:bg-gray-50"
        style={{ minHeight: 44, borderColor: "#e5e7eb" }}
        aria-label="Copy số điện thoại"
        title={copied ? "Đã copy" : "Copy số"}
      >
        {copied ? "✓" : "📋"}
      </button>
    </div>
  );
}
