"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "signature_pad";

/**
 * Acceptance (biên bản nghiệm thu) signing form — mirrors the contract
 * sign flow. Submits to `/api/public/team-acceptance/:token/sign` which
 * flips acceptance_status → 'signed' and unlocks the payment gate on the
 * admin side.
 */
export default function SignForm({
  token,
  expectedName,
}: {
  token: string;
  expectedName?: string;
}): React.ReactElement {
  const router = useRouter();
  const [confirmedName, setConfirmedName] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sigEmpty, setSigEmpty] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);

  // HiDPI signature pad init — identical recipe to contract sign form.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resizeCanvas(): void {
      if (!canvas || !padRef.current) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = padRef.current.toData();
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      canvas.width = cssWidth * ratio;
      canvas.height = cssHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      padRef.current.clear();
      if (data.length > 0) padRef.current.fromData(data);
      setSigEmpty(padRef.current.isEmpty());
    }

    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgba(255,255,255,1)",
      penColor: "#0f172a",
    });
    padRef.current = pad;

    pad.addEventListener("endStroke", () => {
      setSigEmpty(pad.isEmpty());
    });

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      pad.off();
      padRef.current = null;
    };
  }, []);

  function handleClearSignature(): void {
    padRef.current?.clear();
    setSigEmpty(true);
  }

  const normalized = confirmedName.trim().toLowerCase();
  const expected = (expectedName ?? "").trim().toLowerCase();
  const showMismatch =
    expected.length > 0 && normalized.length >= 2 && normalized !== expected;
  const disabled =
    submitting ||
    !agree ||
    confirmedName.trim().length < 2 ||
    (expected.length > 0 && showMismatch) ||
    sigEmpty;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!agree) {
      setError("Vui lòng tick xác nhận đồng ý trước khi ký.");
      return;
    }
    if (expected.length > 0 && normalized !== expected) {
      setError("Họ tên chưa khớp với đăng ký.");
      return;
    }
    if (!padRef.current || padRef.current.isEmpty()) {
      setError("Vui lòng ký tên vào ô chữ ký.");
      return;
    }
    const signatureImage = padRef.current.toDataURL("image/png");
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/team-acceptance/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed_name: confirmedName,
          signature_image: signatureImage,
        }),
      });
      const body = (await res.json()) as {
        message?: string;
        pdf_url?: string;
      };
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
        {showMismatch ? (
          <p className="mt-1 text-xs text-red-600">
            Họ tên chưa khớp với đăng ký.
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Chữ ký của bạn <span className="text-red-500">*</span>
        </label>
        <div className="relative rounded border border-slate-300 bg-white">
          <canvas
            ref={canvasRef}
            className="block w-full rounded"
            style={{ height: "160px", touchAction: "none" }}
            aria-label="Ô ký tên"
          />
          {sigEmpty ? (
            <span className="pointer-events-none absolute left-3 top-2 select-none text-xs text-slate-400">
              Chưa có chữ ký
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Dùng chuột hoặc ngón tay để ký vào ô trên.
          </p>
          <button
            type="button"
            onClick={handleClearSignature}
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
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
              aria-hidden
            >
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
              <path d="M22 21H7" />
              <path d="m5 11 9 9" />
            </svg>
            Xóa
          </button>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-1"
        />
        <span>
          Tôi xác nhận số liệu trên biên bản là đúng. Việc bấm &quot;Ký biên
          bản&quot; có giá trị pháp lý như chữ ký tay và là cơ sở để 5BIB
          tiến hành thanh toán.
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
        disabled={disabled}
      >
        {submitting ? "Đang ký..." : "Ký biên bản nghiệm thu"}
      </button>
    </form>
  );
}
