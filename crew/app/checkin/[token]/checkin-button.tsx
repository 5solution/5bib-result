"use client";

import { useState } from "react";

interface CheckinResult {
  full_name: string;
  role_name: string;
  checked_in_at: string;
}

export default function CheckinButton({ token }: { token: string }): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ GPS.");
      return;
    }
    setError(null);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/public/team-checkin/${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          const body = (await res.json()) as {
            message?: string;
            full_name?: string;
            role_name?: string;
            checked_in_at?: string;
          };
          if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
          setResult({
            full_name: body.full_name ?? "",
            role_name: body.role_name ?? "",
            checked_in_at: body.checked_in_at ?? new Date().toISOString(),
          });
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setBusy(false);
        setError(`Không lấy được vị trí: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  if (result) {
    return (
      <section className="card border-green-300 bg-green-50">
        <h2 className="text-lg font-bold text-green-800">Check-in thành công!</h2>
        <p className="text-sm text-green-700 mt-1">
          {result.full_name} — {result.role_name}
        </p>
        <p className="text-sm text-green-700">
          Thời gian: {new Date(result.checked_in_at).toLocaleString("vi-VN")}
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <button
        type="button"
        className="btn-primary w-full"
        onClick={handleClick}
        disabled={busy}
      >
        {busy ? "Đang kiểm tra vị trí..." : "Chia sẻ vị trí và check-in"}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-red-700">{error}</p>
      ) : (
        <p className="mt-3 text-xs text-[color:var(--color-muted)]">
          Nếu trình duyệt không hiện hộp thoại cho phép vị trí, vui lòng kiểm
          tra cài đặt quyền truy cập và thử lại.
        </p>
      )}
    </section>
  );
}
