"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicEvent, FormFieldConfig } from "@/lib/api";

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

  const selectedRole = event.roles.find((r) => r.id === roleId) ?? null;

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

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
      const body = (await res.json()) as { message?: string; magic_link?: string; id?: number };
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      setMessage({ type: "success", text: body.message ?? "Đăng ký thành công" });
      // Forward to status page after a short beat
      if (body.magic_link) {
        const token = body.magic_link.split("/status/")[1];
        if (token) {
          setTimeout(() => router.push(`/status/${token}`), 1200);
        }
      }
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

      {selectedRole?.form_fields.map((field) => (
        <DynamicField
          key={field.key}
          field={field}
          value={formData[field.key] ?? ""}
          onChange={(v) => updateField(field.key, v)}
          onPhotoUpload={(file) =>
            handlePhotoUpload(
              field.key,
              file,
              field.key === "avatar_photo" ? "avatar" : "cccd",
            )
          }
        />
      ))}

      {message ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <button className="btn-primary w-full" type="submit" disabled={submitting || !selectedRole}>
        {submitting ? "Đang gửi..." : "Gửi đăng ký"}
      </button>
      <p className="text-center text-xs text-[color:var(--color-muted)]">
        Thông tin của bạn chỉ dùng cho công tác tổ chức sự kiện và được bảo mật.
      </p>
    </form>
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
  onPhotoUpload,
}: {
  field: FormFieldConfig;
  value: string;
  onChange: (v: string) => void;
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
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                value === size
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white"
                  : "bg-white hover:border-[color:var(--color-accent)]"
              }`}
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
        required={field.required}
      />
      {field.hint ? (
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">{field.hint}</p>
      ) : null}
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
