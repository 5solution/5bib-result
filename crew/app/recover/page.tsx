"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  requestRecoverOtp,
  verifyRecoverOtp,
  type RecoveredRegistration,
} from "@/lib/api";

// Cloudflare Turnstile — client-side site key is public by design. If not
// configured (dev) the widget renders in a "test" state and the backend
// skips verification.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type Step = "email" | "otp" | "done";

export default function RecoverPage(): React.ReactElement {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [registrations, setRegistrations] = useState<RecoveredRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Countdown for "Resend OTP" button
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleRequest(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email.trim()) {
      setError("Vui lòng nhập email.");
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Vui lòng hoàn tất xác minh captcha.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await requestRecoverOtp(
        email.trim(),
        turnstileToken || "dev-skip",
      );
      setSentTo(res.sent_to);
      setStep("otp");
      setCooldown(60);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError("Mã OTP phải gồm 6 chữ số.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await verifyRecoverOtp(email.trim(), otp);
      setRegistrations(res.registrations);
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleBackToEmail(): void {
    setStep("email");
    setOtp("");
    setError(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block text-sm text-slate-500 hover:text-slate-700">
            ← Về trang chủ
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Khôi phục link Portal
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Mất email xác nhận? Nhập email đã đăng ký để nhận lại link truy cập.
          </p>
        </div>

        {/* Step 1: Email */}
        {step === "email" && (
          <form
            onSubmit={handleRequest}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email đã đăng ký
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vd: tnv@example.com"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              />
            </div>

            {TURNSTILE_SITE_KEY ? (
              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                onToken={setTurnstileToken}
              />
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠️ Dev mode — captcha skipped. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY in production.
              </p>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Đang gửi..." : "Gửi mã OTP"}
            </button>

            <p className="text-xs text-slate-500 text-center">
              Chúng tôi sẽ gửi mã 6 số về email của bạn. Mã có hiệu lực 10 phút.
            </p>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === "otp" && (
          <form
            onSubmit={handleVerify}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
          >
            <div>
              <p className="text-sm text-slate-700">
                Nếu email <strong>{sentTo}</strong> đã đăng ký, chúng tôi vừa
                gửi một mã OTP 6 chữ số. Kiểm tra hộp thư (cả Spam) và nhập mã
                vào ô dưới.
              </p>
            </div>

            <div>
              <label
                htmlFor="otp"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Mã OTP
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full rounded-md border border-slate-300 px-3 py-3 text-center text-2xl font-mono tracking-[0.5em] focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Đang xác minh..." : "Xác nhận"}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-slate-500 hover:text-slate-700"
              >
                ← Đổi email
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={() => {
                  // Resend — reuses the captcha token once; if that fails the
                  // user has to reload to re-solve the widget. Acceptable UX.
                  void handleRequest({
                    preventDefault: () => undefined,
                  } as React.FormEvent);
                }}
                className="text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Gửi lại mã"}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            {registrations.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-600">
                  Không tìm thấy đăng ký đang hoạt động gắn với email này.
                </p>
                <Link
                  href="/"
                  className="mt-4 inline-block text-sm text-blue-600 hover:underline"
                >
                  ← Về trang chủ
                </Link>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Các đăng ký của bạn
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Bấm &quot;Mở portal&quot; để vào trang trạng thái tương ứng.
                    Link có hiệu lực trong thời hạn đăng ký — lưu lại để dùng
                    sau.
                  </p>
                </div>

                <ul className="space-y-3">
                  {registrations.map((r) => (
                    <li
                      key={r.magic_link}
                      className="rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {r.event_name}
                          </p>
                          <p className="text-xs text-slate-600 truncate">
                            {r.role_name} · {r.full_name}
                          </p>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                            {r.status}
                          </p>
                        </div>
                        <a
                          href={r.magic_link}
                          className="shrink-0 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Mở portal →
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="text-[11px] text-slate-400 text-center pt-2 border-t">
                  Link truy cập đã hiển thị — không chia sẻ cho người khác.
                </p>
              </>
            )}
          </div>
        )}

        {/* Footer help */}
        <p className="text-center text-xs text-slate-500">
          Vẫn không truy cập được? Liên hệ BTC sự kiện để được hỗ trợ.
        </p>
      </div>
    </main>
  );
}

/**
 * Cloudflare Turnstile widget loader. Appends the script tag once per page
 * load, renders a <div> the script attaches to, and bubbles the solved
 * token back via onToken callback.
 */
function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (t: string) => void;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scriptId = "cf-turnstile-script";
    const existing = document.getElementById(scriptId);

    function renderWidget(): void {
      if (!ref.current) return;
      // Cloudflare mutates global window.turnstile at script load.
      const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (!ts) return;
      ref.current.innerHTML = "";
      ts.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    }

    if (existing) {
      renderWidget();
      return;
    }
    const s = document.createElement("script");
    s.id = scriptId;
    s.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => renderWidget();
    document.head.appendChild(s);
  }, [siteKey, onToken]);

  return <div ref={ref} className="min-h-[65px]" />;
}

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string;
}
