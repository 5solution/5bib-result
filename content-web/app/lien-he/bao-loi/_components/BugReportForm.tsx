"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Send } from "lucide-react";

const CATEGORIES = [
  { value: "payment", label: "Thanh toán & đơn hàng" },
  { value: "race_result", label: "Kết quả & xếp hạng giải" },
  { value: "bib_avatar", label: "BIB & Avatar" },
  { value: "account_login", label: "Tài khoản & đăng nhập" },
  { value: "ui_display", label: "Lỗi giao diện / hiển thị" },
  { value: "mobile_app", label: "App di động" },
  { value: "other", label: "Khác" },
] as const;

const SEVERITIES = [
  { value: "critical", label: "🔴 Khẩn cấp", desc: "Mất data, không vào được" },
  { value: "high", label: "🟠 Cao", desc: "Chức năng chính hỏng" },
  { value: "medium", label: "🟡 Trung bình", desc: "Lỗi giao diện" },
  { value: "low", label: "🟢 Thấp", desc: "Góp ý cải thiện" },
  { value: "unknown", label: "❔ Không chắc chắn", desc: "Để 5BIB đánh giá" },
] as const;

interface SubmitOk {
  publicId: string;
  status: "received";
  estimatedResponseTime: string;
}

export function BugReportForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [retryAfterMin, setRetryAfterMin] = useState<number | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setRetryAfterMin(null);
        const fd = new FormData(e.currentTarget);
        const payload = {
          title: String(fd.get("title") ?? "").trim(),
          category: String(fd.get("category") ?? ""),
          severity: String(fd.get("severity") ?? "unknown"),
          description: String(fd.get("description") ?? "").trim(),
          stepsToReproduce: String(fd.get("stepsToReproduce") ?? "").trim() || undefined,
          urlAffected: String(fd.get("urlAffected") ?? "").trim() || undefined,
          email: String(fd.get("email") ?? "").trim(),
          phoneNumber: String(fd.get("phoneNumber") ?? "").trim() || undefined,
          wantsUpdates: fd.get("wantsUpdates") === "on",
          consent: fd.get("consent") === "on",
          // Honeypot
          website: String(fd.get("website") ?? ""),
          // Metadata
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : "",
          viewport:
            typeof window !== "undefined"
              ? `${window.innerWidth}x${window.innerHeight}`
              : "",
          referrer: typeof document !== "undefined" ? document.referrer.slice(0, 500) : "",
        };

        startTransition(async () => {
          try {
            const res = await fetch("/api/bug-reports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (res.status === 429) {
              const data = (await res.json().catch(() => ({}))) as { retryAfterSec?: number };
              const min = Math.max(1, Math.ceil((data.retryAfterSec ?? 3600) / 60));
              setRetryAfterMin(min);
              return;
            }
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as {
                message?: string | string[];
              };
              const msg = Array.isArray(data.message)
                ? data.message[0]
                : data.message ?? `Lỗi ${res.status}`;
              setError(msg);
              return;
            }
            const data = (await res.json()) as SubmitOk;
            router.push(`/lien-he/bao-loi/cam-on?id=${encodeURIComponent(data.publicId)}`);
          } catch (err) {
            setError(`Lỗi mạng — ${(err as Error).message}`);
          }
        });
      }}
      className="grid gap-5"
    >
      {/* Honeypot — hidden, no human interaction */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] top-[-9999px] h-0 w-0 opacity-0"
        aria-hidden
      />

      <Field label="Tiêu đề lỗi" required>
        <input
          name="title"
          required
          minLength={5}
          maxLength={200}
          placeholder="VD: Không tải được kết quả giải VMM 2026"
          className="input"
        />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Loại lỗi" required>
          <select name="category" required defaultValue="" className="input">
            <option value="" disabled>
              — Chọn loại lỗi —
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mức độ khẩn cấp" hint="Nếu không chắc, để 5BIB đánh giá giúp">
          <select name="severity" defaultValue="unknown" className="input">
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} — {s.desc}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Mô tả chi tiết"
        required
        hint="Tối thiểu 20 ký tự — càng chi tiết càng tốt"
      >
        <textarea
          name="description"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          placeholder="Mô tả lỗi bạn gặp, xảy ra khi nào, ở đâu..."
          className="input resize-y"
        />
      </Field>

      <Field
        label="Bước tái tạo lỗi"
        hint="Optional — nếu nhớ, viết lại các bước để dev reproduce"
      >
        <textarea
          name="stepsToReproduce"
          maxLength={1000}
          rows={3}
          placeholder={"1. Vào trang X\n2. Click Y\n3. Lỗi xuất hiện..."}
          className="input resize-y"
        />
      </Field>

      <Field label="URL trang gặp lỗi" hint="Optional">
        <input
          name="urlAffected"
          type="text"
          maxLength={500}
          placeholder="https://5bib.com/races/..."
          className="input"
        />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Email liên hệ" required>
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="ban@email.com"
            className="input"
          />
        </Field>
        <Field label="Số điện thoại" hint="Optional">
          <input
            name="phoneNumber"
            type="tel"
            maxLength={30}
            placeholder="0901 234 567"
            className="input"
          />
        </Field>
      </div>

      <div className="space-y-2.5 rounded-xl border border-[var(--5s-border)] bg-[var(--5s-bg)] p-4">
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="wantsUpdates" defaultChecked className="mt-0.5" />
          <span>
            <strong>Nhận update qua email.</strong> 5BIB sẽ email khi báo cáo
            được xử lý hoặc cần thêm thông tin.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5" />
          <span>
            Tôi đồng ý 5BIB lưu thông tin tôi cung cấp để xử lý báo cáo này.{" "}
            <span className="text-[var(--5s-danger)]">*</span>
          </span>
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {retryAfterMin && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            Bạn đã báo nhiều lỗi gần đây. Vui lòng thử lại sau{" "}
            <strong>~{retryAfterMin} phút</strong> hoặc liên hệ qua Zalo OA để
            được hỗ trợ ngay.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--5s-text-muted)]">
          Cần đính kèm ảnh chụp màn hình? Hãy gửi qua{" "}
          <a
            href="https://zalo.me/1496901851017205971"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[var(--5s-blue)] underline"
          >
            Zalo OA
          </a>{" "}
          (file upload sẽ có ở phiên bản tới).
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--5s-magenta)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--5s-magenta-dim)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {pending ? "Đang gửi..." : "Gửi báo cáo"}
        </button>
      </div>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid var(--5s-border);
          background: white;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          line-height: 1.5;
          color: var(--5s-text);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          outline: none;
          border-color: var(--5s-blue);
          box-shadow: 0 0 0 3px var(--5s-blue-50);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-bold text-[var(--5s-text)]">
          {label}
          {required && <span className="ml-1 text-[var(--5s-danger)]">*</span>}
        </span>
        {hint && <span className="text-[11px] text-[var(--5s-text-muted)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
