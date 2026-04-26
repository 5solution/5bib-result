"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  FormFieldConfig,
  StatusResponse,
  UpdateProfilePatch,
} from "@/lib/api";
import { updateProfile } from "@/lib/api";
import { StatusBadge, deriveStatusKey } from "@/lib/status-style";
import { namesMatch } from "@/lib/utils";
import type { MyStationView } from "@/lib/station-api";
import type { LeaderSupplyView } from "@/lib/supply-api";
import { StationSection } from "./_station-section";

/**
 * v1.4.1 — Personal profile tab with avatar + editable info + read-only
 * status block. When status ∈ {approved, contract_sent, ...}, edits go into
 * pending_changes awaiting admin re-approval. When pending_approval, edits
 * apply immediately.
 */
export function PersonalTab({
  token,
  status,
  signedPdfUrl,
  myStation,
  leaderSupply,
  featureMode = "full",
}: {
  token: string;
  status: StatusResponse;
  signedPdfUrl: string | null;
  myStation: MyStationView | null;
  leaderSupply: LeaderSupplyView | null;
  featureMode?: "full" | "lite";
}): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  // v037+ — When email link contains ?missing=photo,personal,..., open the
  // edit form immediately and scroll to the section.
  const missingTags = useMemo(() => {
    const raw = searchParams?.get("missing") ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [searchParams]);
  const [editing, setEditing] = useState(false);

  // Auto-open edit + scroll if user came from welcome email.
  useEffect(() => {
    if (missingTags.length > 0 && !editing) {
      setEditing(true);
      // Small delay to wait for form mount.
      setTimeout(() => {
        const el = document.querySelector(
          missingTags.includes("photo")
            ? '[data-field="cccd_photo"]'
            : missingTags.includes("personal")
              ? '[data-field="cccd"]'
              : '[data-field="bank_account_number"]',
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          (el as HTMLElement).focus?.();
        }
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formFields = (status.form_fields ?? []) as FormFieldConfig[];
  const initialFormData = (status.form_data ?? {}) as Record<string, unknown>;

  const [fullName, setFullName] = useState(status.full_name);
  const [phone, setPhone] = useState(status.phone ?? "");
  const [formData, setFormData] = useState<Record<string, unknown>>(
    initialFormData,
  );
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const statusKey = deriveStatusKey(status);
  const hasPending = Boolean(status.has_pending_changes);
  const isTerminal =
    status.status === "rejected" || status.status === "cancelled";
  const showQr =
    status.qr_code != null &&
    (status.status === "qr_sent" ||
      status.status === "checked_in" ||
      status.status === "completed");

  const avatarUrl =
    (typeof formData.avatar_photo === "string" && formData.avatar_photo) ||
    status.avatar_photo_url ||
    null;

  const holderNameRaw =
    typeof formData.bank_holder_name === "string"
      ? formData.bank_holder_name
      : "";
  const holderMismatch =
    holderNameRaw.trim().length > 0 &&
    fullName.trim().length > 0 &&
    !namesMatch(holderNameRaw, fullName);

  // Build the patch to submit: only changed top-level values + changed
  // form_data keys, to keep payloads minimal.
  const patch: UpdateProfilePatch = useMemo(() => {
    const out: UpdateProfilePatch = {};
    if (fullName.trim() && fullName !== status.full_name) {
      out.full_name = fullName.trim();
    }
    if (phone.trim() && phone !== (status.phone ?? "")) {
      out.phone = phone.trim();
    }
    const diff: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(formData)) {
      if (JSON.stringify(v) !== JSON.stringify(initialFormData[k])) {
        diff[k] = v;
      }
    }
    if (Object.keys(diff).length > 0) out.form_data = diff;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, phone, formData, status.full_name, status.phone]);

  const hasChanges = Object.keys(patch).length > 0;

  async function handlePhotoUpload(
    key: string,
    file: File,
    photoType: "avatar" | "cccd" | "cccd_back",
  ): Promise<void> {
    const body = new FormData();
    body.append("file", file);
    body.append("photo_type", photoType);
    const res = await fetch("/api/public/team-upload-photo", {
      method: "POST",
      body,
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(b?.message ?? `HTTP ${res.status}`);
    }
    const json = (await res.json()) as { url: string };
    setFormData((prev) => ({ ...prev, [key]: json.url }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (holderMismatch) {
      setMsg({
        type: "error",
        text: "Tên chủ tài khoản phải khớp với họ tên đăng ký (không dấu / hoa thường).",
      });
      return;
    }
    if (!hasChanges) {
      setMsg({ type: "error", text: "Chưa có trường nào được thay đổi." });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await updateProfile(token, patch);
      setMsg({ type: "success", text: res.message });
      setEditing(false);
      // Reload server data so the banner + values update.
      setTimeout(() => router.refresh(), 800);
    } catch (err) {
      setMsg({ type: "error", text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel(): void {
    setFullName(status.full_name);
    setPhone(status.phone ?? "");
    setFormData(initialFormData);
    setMsg(null);
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      {/* ---------- Profile hero card ---------- */}
      <section className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar url={avatarUrl} name={status.full_name} />
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-gradient-warm">
                {status.full_name}
              </h1>
              <p
                className="text-sm"
                style={{ color: "var(--5bib-text-muted)" }}
              >
                {status.role_name} · {status.event_name}
              </p>
            </div>
          </div>
          <StatusBadge status={statusKey} />
        </div>

        {/* v037+ — Missing profile banner. Shows when admin imported the
            registration from Excel and key fields haven't been filled. */}
        {(() => {
          const missing: string[] = [];
          if (!status.cccd_photo_url && !formData.cccd_photo)
            missing.push("Ảnh CCCD mặt trước");
          if (!status.cccd_back_photo_url && !formData.cccd_back_photo)
            missing.push("Ảnh CCCD mặt sau");
          if (!status.avatar_photo_url && !formData.avatar_photo)
            missing.push("Ảnh chân dung");
          if (!status.birth_date && !formData.birth_date && !formData.dob)
            missing.push("Ngày sinh");
          if (!status.cccd_issue_date && !formData.cccd_issue_date)
            missing.push("Ngày cấp CCCD");
          if (!status.cccd_issue_place && !formData.cccd_issue_place)
            missing.push("Nơi cấp CCCD");
          if (missing.length === 0 || isTerminal) return null;
          return (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{
                borderColor: "#fb923c",
                background: "#fff7ed",
                color: "#9a3412",
              }}
            >
              <p className="font-semibold">Hồ sơ chưa đầy đủ</p>
              <p className="mt-0.5 text-xs">
                Bạn cần bổ sung: {missing.join(", ")}.
              </p>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mt-2 inline-block rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-700"
                >
                  Bổ sung ngay
                </button>
              ) : null}
            </div>
          );
        })()}

        {hasPending ? (
          <div
            className="rounded-lg border p-3 text-sm"
            style={{
              borderColor: "#fcd34d",
              background: "#fef3c7",
              color: "#92400e",
            }}
            data-testid="pending-changes-banner"
          >
            <p className="font-semibold">Bạn đã gửi yêu cầu sửa thông tin</p>
            <p className="mt-0.5 text-xs">
              Đang chờ admin duyệt
              {status.pending_changes_submitted_at
                ? ` — gửi lúc ${new Date(
                    status.pending_changes_submitted_at,
                  ).toLocaleString("vi-VN")}`
                : ""}
              .
            </p>
          </div>
        ) : null}

        {!editing && !isTerminal && !hasPending ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
              style={{ borderColor: "var(--5bib-border)" }}
              data-testid="edit-profile-btn"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              Chỉnh sửa
            </button>
          </div>
        ) : null}
      </section>

      {/* ---------- v1.6: Vị trí & nhiệm vụ — hidden in Lite mode (v1.9) ---------- */}
      {featureMode !== "lite" ? (
        <StationSection
          token={token}
          myStation={myStation}
          leaderSupply={leaderSupply}
          roleName={status.role_name}
        />
      ) : null}

      {/* ---------- QR code (second, for quick scan) ---------- */}
      {showQr ? (
        <section className="card flex flex-col items-center gap-2">
          <h2 className="font-semibold mb-2">QR check-in</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={status.qr_code!}
            alt="QR check-in"
            width={220}
            height={220}
            className="rounded-lg border"
          />
          <p className="text-xs text-[color:var(--color-muted)]">
            Đưa mã QR này để check-in vào ngày vận hành.
          </p>
        </section>
      ) : null}

      {/* ---------- Check-in status ---------- */}
      {status.checked_in_at ? (
        <section className="card border-green-300 bg-green-50">
          <h2 className="font-semibold text-green-800">Đã check-in</h2>
          <p className="text-sm text-green-700">
            {new Date(status.checked_in_at).toLocaleString("vi-VN")}
          </p>
        </section>
      ) : null}

      {/* ---------- Info grid / edit form ---------- */}
      {editing ? (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-semibold">Chỉnh sửa thông tin</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput
              label="Họ và tên"
              required
              value={fullName}
              onChange={setFullName}
            />
            <LabeledInput
              label="Số điện thoại"
              required
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="0901234567"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              className="input bg-gray-50 text-gray-500"
              value={status.email ?? ""}
              readOnly
              title="Email không thể thay đổi sau khi đăng ký"
            />
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              Email không thể thay đổi sau khi đăng ký.
            </p>
          </div>

          {formFields.map((field) => {
            const v = formData[field.key];
            const stringVal = typeof v === "string" ? v : v == null ? "" : String(v);
            const error =
              field.key === "bank_holder_name" && holderMismatch
                ? "Tên chủ tài khoản phải khớp với họ tên đăng ký"
                : null;
            return (
              <DynamicField
                key={field.key}
                field={field}
                value={stringVal}
                onChange={(next) =>
                  setFormData((prev) => ({ ...prev, [field.key]: next }))
                }
                error={error}
                onPhotoUpload={(file) =>
                  handlePhotoUpload(
                    field.key,
                    file,
                    field.key === "avatar_photo"
                      ? "avatar"
                      : field.key === "cccd_back_photo"
                        ? "cccd_back"
                        : "cccd",
                  )
                }
              />
            );
          })}

          {msg ? (
            <div
              className="rounded-lg border p-3 text-sm"
              style={
                msg.type === "success"
                  ? {
                      borderColor: "#86efac",
                      background: "#dcfce7",
                      color: "#15803d",
                    }
                  : {
                      borderColor: "#fca5a5",
                      background: "#fee2e2",
                      color: "#b91c1c",
                    }
              }
            >
              {msg.text}
            </div>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting || !hasChanges || holderMismatch}
              className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="submit-profile-edit"
            >
              {submitting ? "Đang gửi..." : "Gửi yêu cầu duyệt"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="rounded-xl border px-4 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              style={{ borderColor: "var(--5bib-border)" }}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <section className="card space-y-3">
          <h2 className="font-semibold">Thông tin cá nhân</h2>
          <InfoGrid
            fullName={status.full_name}
            phone={status.phone ?? ""}
            email={status.email ?? ""}
            formData={initialFormData}
            formFields={formFields}
          />
        </section>
      )}

      {/* ---------- Status block (bottom, smaller) ---------- */}
      <section className="card">
        <h2 className="font-semibold mb-2">Tình trạng hợp đồng</h2>
        <p className="text-sm">{labelForContract(status.contract_status)}</p>
        {signedPdfUrl ? (
          <a
            href={signedPdfUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-accent)] hover:underline"
          >
            Xem hợp đồng đã ký →
          </a>
        ) : null}
      </section>

    </div>
  );
}

function Avatar({
  url,
  name,
}: {
  url: string | null;
  name: string;
}): React.ReactElement {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={80}
        height={80}
        className="rounded-full border object-cover"
        style={{ width: 80, height: 80 }}
      />
    );
  }
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="grid place-items-center rounded-full text-lg font-bold text-white"
      style={{ width: 80, height: 80, background: "#1d4ed8" }}
    >
      {initials || "?"}
    </div>
  );
}

function InfoGrid({
  fullName,
  phone,
  email,
  formData,
  formFields,
}: {
  fullName: string;
  phone: string;
  email: string;
  formData: Record<string, unknown>;
  formFields: FormFieldConfig[];
}): React.ReactElement {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Họ và tên", value: fullName },
    { label: "Số điện thoại", value: phone },
    { label: "Email", value: email },
  ];
  for (const field of formFields) {
    if (field.type === "photo") continue;
    const raw = formData[field.key];
    let display: string;
    if (raw == null || raw === "") display = "—";
    else if (typeof raw === "string") display = raw;
    else display = JSON.stringify(raw);
    rows.push({ label: field.label, value: display });
  }

  return (
    <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label}>
          <dt
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--5bib-text-muted)" }}
          >
            {r.label}
          </dt>
          <dd className="mt-0.5 text-sm font-medium break-words">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        className="input"
        value={value}
        type={type}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function DynamicField({
  field,
  value,
  onChange,
  error,
  onPhotoUpload,
}: {
  field: FormFieldConfig;
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  onPhotoUpload: (file: File) => Promise<void>;
}): React.ReactElement {
  if (field.type === "shirt_size") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </label>
        <div className="flex flex-wrap gap-2">
          {(field.options ?? ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]).map(
            (size) => (
              <button
                type="button"
                key={size}
                className="rounded-lg border px-3 py-2 text-sm font-medium transition-all"
                style={
                  value === size
                    ? {
                        borderColor: "var(--5bib-accent)",
                        background: "var(--5bib-accent)",
                        color: "#fff",
                        boxShadow: "var(--shadow-glow)",
                      }
                    : {
                        background: "white",
                        borderColor: "var(--5bib-border)",
                      }
                }
                onClick={() => onChange(size)}
              >
                {size}
              </button>
            ),
          )}
        </div>
      </div>
    );
  }

  if (field.type === "photo") {
    return (
      <PhotoField field={field} value={value} onUpload={onPhotoUpload} />
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </label>
        <textarea
          className="textarea"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </label>
        <select
          className="select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">-- Chọn --</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const isAccountNumber = field.key === "bank_account_number";
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        className="input"
        type={
          field.type === "tel"
            ? "tel"
            : field.type === "email"
              ? "email"
              : field.type === "date"
                ? "date"
                : "text"
        }
        value={value}
        onChange={(e) => {
          const next = isAccountNumber ? e.target.value.replace(/[^\d]/g, "") : e.target.value;
          onChange(next);
        }}
        inputMode={isAccountNumber ? "numeric" : undefined}
        pattern={isAccountNumber ? "\\d{6,20}" : undefined}
        autoCapitalize={field.key === "bank_holder_name" ? "characters" : undefined}
      />
      {field.hint ? (
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">
          {field.hint}
        </p>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function PhotoField({
  field,
  value,
  onUpload,
}: {
  field: FormFieldConfig;
  value: string;
  onUpload: (file: File) => Promise<void>;
}): React.ReactElement {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      await onUpload(file);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      {field.hint ? (
        <p className="mb-1 text-xs text-[color:var(--color-muted)]">
          {field.hint}
        </p>
      ) : null}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--color-accent)] file:px-3 file:py-2 file:text-white"
      />
      {uploading ? <p className="mt-1 text-xs">Đang tải lên...</p> : null}
      {value ? (
        <p className="mt-1 text-xs text-green-700">✔ Đã tải lên</p>
      ) : null}
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}

function labelForContract(s: string): string {
  switch (s) {
    case "not_sent":
      return "Chưa gửi hợp đồng";
    case "sent":
      return "Đã gửi hợp đồng — chờ bạn ký";
    case "signed":
      return "Đã ký hợp đồng";
    case "expired":
      return "Link hợp đồng đã hết hạn";
    default:
      return s;
  }
}
