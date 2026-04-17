"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignForm({ token }: { token: string }): React.ReactElement {
  const router = useRouter();
  const [confirmedName, setConfirmedName] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!agree) {
      setError("Vui lòng tick xác nhận đồng ý trước khi ký.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/team-contract/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed_name: confirmedName }),
      });
      const body = (await res.json()) as { message?: string; pdf_url?: string };
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">
          Họ và tên xác nhận <span className="text-red-500">*</span>
        </label>
        <input
          className="input"
          value={confirmedName}
          onChange={(e) => setConfirmedName(e.target.value)}
          placeholder="Nhập đúng họ tên trên đăng ký"
          autoComplete="off"
          required
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-1"
        />
        <span>
          Tôi đã đọc, hiểu và đồng ý với toàn bộ nội dung hợp đồng. Việc bấm "Ký
          hợp đồng" có giá trị pháp lý như chữ ký tay.
        </span>
      </label>
      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={submitting || !agree || confirmedName.trim().length < 2}
      >
        {submitting ? "Đang ký..." : "Ký hợp đồng"}
      </button>
    </form>
  );
}
