"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicEvent, FormFieldConfig } from "@/lib/api";
import { namesMatch } from "@/lib/utils";

interface RegisterFormProps {
  event: PublicEvent;
}

export default function RegisterForm({ event }: RegisterFormProps): React.ReactElement {
  const router = useRouter();
  const [roleId, setRoleId] = useState<number | null>(event.roles[0]?.id ?? null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Admin-configured terms gate: when `event.terms_conditions` is set the
  // TNV must tick this checkbox before the submit button enables.
  const [termsAgreed, setTermsAgreed] = useState(false);
  const termsRequired = !!event.terms_conditions?.trim();

  const selectedRole = event.roles.find((r) => r.id === roleId) ?? null;

  function updateField(key: string, value: string) {
    // Strip non-digits from bank_account_number — backend regex is
    // `^\d{6,20}$`, so silently dropping other chars here keeps the UX
    // from showing a 400 later.
    const cleaned =
      key === "bank_account_number" ? value.replace(/[^\d]/g, "") : value;
    setFormData((prev) => ({ ...prev, [key]: cleaned }));
  }

  function handleFieldBlur(key: string): void {
    // Uppercase holder name on blur — VN convention when referencing bank
    // accounts. We don't remove diacritics client-side so the user can see
    // their own name; the server does the diacritic-insensitive match.
    if (key === "bank_holder_name") {
      setFormData((prev) => {
        const cur = prev[key] ?? "";
        const up = cur.toUpperCase();
        if (up === cur) return prev;
        return { ...prev, [key]: up };
      });
    }
  }

  // Client-side early reject — bank_holder_name must match full_name
  // (diacritic-insensitive, uppercase, trim). Matches the server rule.
  const holderName = (formData["bank_holder_name"] ?? "").toString();
  const holderMismatch =
    holderName.trim().length > 0 &&
    fullName.trim().length > 0 &&
    !namesMatch(holderName, fullName);

  async function handlePhotoUpload(
    key: string,
    file: File,
    photoType: "avatar" | "cccd",
  ): Promise<void> {
    const body = new FormData();
    body.append("file", file);
    body.append("photo_type", photoType);
    const res = await fetch("/api/public/team-upload-photo", { method: "POST", body });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(b?.message ?? `HTTP ${res.status}`);
    }
    const json = (await res.json()) as { url: string };
    updateField(key, json.url);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedRole) return;

    // Block submit if holder name doesn't match. Backend rejects with 400,
    // but showing the error up here is a lot nicer than waiting a round-trip.
    if (holderMismatch) {
      setMessage({
        type: "error",
        text: "Tên chủ tài khoản phải khớp với họ tên đăng ký (không phân biệt dấu / hoa thường).",
      });
      return;
    }
    // Client-side gate: required photo fields must be uploaded before submit.
    // file inputs don't support HTML5 `required` reliably — check the value
    // (set to the S3 URL after upload) instead.
    const missingPhoto = selectedRole.form_fields.find(
      (f) => f.type === "photo" && f.required && !formData[f.key],
    );
    if (missingPhoto) {
      setMessage({
        type: "error",
        text: `Vui lòng tải lên: ${missingPhoto.label}.`,
      });
      return;
    }

    // Client-side sanity check for account number — the field strips
    // non-digits on change already, but catch the length rule here.
    const acct = (formData["bank_account_number"] ?? "").toString();
    const acctField = selectedRole.form_fields.find(
      (f) => f.key === "bank_account_number",
    );
    if (acctField && acct.length > 0 && !/^\d{6,20}$/.test(acct)) {
      setMessage({
        type: "error",
        text: "Số tài khoản phải có 6–20 chữ số.",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/public/team-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: selectedRole.id,
          full_name: fullName,
          email,
          phone,
          form_data: formData,
        }),
      });
      const body = (await res.json()) as {
        message?: string;
        id?: number;
        status?: string;
      };
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      // SECURITY: do NOT redirect to the portal here. The backend returns
      // only id + status + message — no token, no link. The crew member
      // will receive a portal link by email ONLY after admin approves. This
      // prevents any anonymous register submission from reading/editing a
      // profile attached to someone else's email.
      //
      // Bug #9 fix: redirect to a dedicated success page instead of showing
      // the success message inline (which left the user stuck on the form).
      const successStatus = body.status ?? "pending_approval";
      router.push(
        `/events/${event.id}/register/success?status=${encodeURIComponent(successStatus)}`,
      );
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Vai trò muốn ứng tuyển</label>
        <select
          className="select"
          value={roleId ?? ""}
          onChange={(e) => setRoleId(Number(e.target.value))}
        >
          {event.roles.map((r) => (
            <option key={r.id} value={r.id} disabled={r.is_full && !r.waitlist_enabled}>
              {r.role_name}
              {r.is_full ? ` (đầy${r.waitlist_enabled ? " — vào waitlist" : ""})` : ""}
              {r.daily_rate > 0
                ? ` · ${r.daily_rate.toLocaleString("vi-VN")}đ/ngày`
                : " · tình nguyện"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Họ và tên"
          required
          value={fullName}
          onChange={setFullName}
          autoComplete="name"
        />
        <Field
          label="Số điện thoại"
          required
          value={phone}
          onChange={setPhone}
          type="tel"
          autoComplete="tel"
          placeholder="0901234567"
        />
      </div>
      <Field
        label="Email"
        required
        value={email}
        onChange={setEmail}
        type="email"
        autoComplete="email"
      />

      {selectedRole && selectedRole.form_fields.length > 0 && (
        <SectionDivider label="Thông tin bổ sung" className="mt-2 mb-1" />
      )}

      {selectedRole?.form_fields.map((field, idx) => {
        // Surface client-side errors on the specific field they apply to.
        const fieldError =
          field.key === "bank_holder_name" && holderMismatch
            ? "Tên chủ tài khoản phải khớp với họ tên đăng ký"
            : null;

        // Insert banking section divider before the first bank_* field.
        const isBankField = field.key.startsWith("bank_");
        const prevIsBankField = idx > 0 && selectedRole.form_fields[idx - 1].key.startsWith("bank_");
        const showBankingDivider = isBankField && !prevIsBankField;

        return (
          <div key={field.key}>
            {showBankingDivider && (
              <SectionDivider label="Thông tin thanh toán" className="mb-4" />
            )}
            <DynamicField
              field={field}
              value={formData[field.key] ?? ""}
              onChange={(v) => updateField(field.key, v)}
              onBlur={() => handleFieldBlur(field.key)}
              error={fieldError}
              onPhotoUpload={(file) =>
                handlePhotoUpload(
                  field.key,
                  file,
                  field.key === "avatar_photo" ? "avatar" : "cccd",
                )
              }
            />
          </div>
        );
      })}

      {message ? (
        message.type === "success" ? (
          <div className="text-center py-6 slide-up scale-in">
            <div
              className="mx-auto mb-3 grid size-12 place-items-center rounded-full"
              style={{ background: "#dcfce7" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#15803d"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h2
              className="font-display text-2xl font-bold mb-1"
              style={{ color: "#111827" }}
            >
              Đăng ký thành công!
            </h2>
            <p className="text-sm" style={{ color: "#6b7280" }}>
              {message.text}
            </p>
          </div>
        ) : (
          <div
            className="rounded-lg border p-3 text-sm"
            style={{
              borderColor: "#fca5a5",
              background: "#fee2e2",
              color: "#b91c1c",
            }}
          >
            {message.text}
          </div>
        )
      ) : null}

      {termsRequired ? (
        <section
          className="rounded-lg border p-4"
          style={{ borderColor: "#e5e7eb", background: "#f9fafb" }}
        >
          <h3
            className="font-semibold text-sm mb-2"
            style={{ color: "#111827" }}
          >
            Điều khoản & điều kiện đăng ký
          </h3>
          <div
            className="whitespace-pre-line text-sm leading-relaxed max-h-48 overflow-y-auto rounded border bg-white p-3"
            style={{ color: "#374151", borderColor: "#e5e7eb" }}
          >
            {event.terms_conditions}
          </div>
          <label className="mt-3 flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={(e) => setTermsAgreed(e.target.checked)}
              className="mt-0.5 size-4"
              aria-required="true"
            />
            <span className="text-sm">
              Tôi đã đọc và đồng ý với điều khoản và điều kiện tham gia sự kiện
              này.
            </span>
          </label>
        </section>
      ) : null}

      <button
        type="submit"
        disabled={
          submitting ||
          !selectedRole ||
          holderMismatch ||
          (termsRequired && !termsAgreed)
        }
        className="w-full rounded-xl py-3.5 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
      >
        {submitting ? "Đang gửi..." : "Gửi đăng ký"}
      </button>
      <p className="text-center text-xs text-[color:var(--color-muted)]">
        Thông tin của bạn chỉ dùng cho công tác tổ chức sự kiện và được bảo mật.
      </p>
    </form>
  );
}

function SectionDivider({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1 border-t" style={{ borderColor: "#e5e7eb" }} />
      <span
        className="shrink-0 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "#9ca3af" }}
      >
        {label}
      </span>
      <div className="flex-1 border-t" style={{ borderColor: "#e5e7eb" }} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
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
        onChange={(e) => onChange(e.target.value)}
        required={required}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
    </div>
  );
}

function DynamicField({
  field,
  value,
  onChange,
  onBlur,
  error,
  onPhotoUpload,
}: {
  field: FormFieldConfig;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
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
          {(field.options ?? ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]).map((size) => (
            <button
              type="button"
              key={size}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                value === size
                  ? "text-white"
                  : "hover:border-[color:var(--5bib-accent)]"
              }`}
              style={
                value === size
                  ? {
                      borderColor: "var(--5bib-accent)",
                      background: "var(--5bib-accent)",
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
          ))}
        </div>
        {field.note ? (
          <p className="mt-1 text-xs text-[color:var(--color-muted)]">{field.note}</p>
        ) : null}
      </div>
    );
  }

  if (field.type === "photo") {
    return (
      <PhotoField
        field={field}
        value={value}
        onUpload={async (file) => {
          await onPhotoUpload(file);
        }}
      />
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
          required={field.required}
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
          required={field.required}
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
        type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={field.required}
        inputMode={isAccountNumber ? "numeric" : undefined}
        pattern={isAccountNumber ? "\\d{6,20}" : undefined}
        autoCapitalize={field.key === "bank_holder_name" ? "characters" : undefined}
      />
      {field.hint ? (
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">{field.hint}</p>
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
        <p className="mb-1 text-xs text-[color:var(--color-muted)]">{field.hint}</p>
      ) : null}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--color-accent)] file:px-3 file:py-2 file:text-white"
      />
      {uploading ? <p className="mt-1 text-xs">Đang tải lên...</p> : null}
      {value ? (
        <p className="mt-1 text-xs text-green-700">
          ✔ Đã tải lên
          {field.key === "avatar_photo" ? (
            <>
              {" · "}
              <a href={value} target="_blank" rel="noreferrer" className="underline">
                xem ảnh
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
