"use client";

/**
 * FEATURE-027 Phase B — Countdown section.
 *
 * Config: { title, targetDate (ISO), message }
 *
 * MUST be Client Component — counter updates every second. SSR renders
 * initial values từ targetDate; client tick refreshes. If targetDate
 * passed, hiển thị message thay vì counter.
 */

import { useEffect, useState } from "react";
import type { SectionResponseDto } from "@/lib/api-generated";

type CountdownConfig = {
  title?: string;
  targetDate?: string;
  message?: string;
};

type Parts = { days: number; hours: number; minutes: number; seconds: number; expired: boolean };

function diff(target: number, now: number): Parts {
  const ms = target - now;
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    expired: false,
  };
}

export function CountdownSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as CountdownConfig;
  const target = c.targetDate ? new Date(c.targetDate).getTime() : null;
  const [parts, setParts] = useState<Parts>(() =>
    target ? diff(target, Date.now()) : { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true },
  );

  useEffect(() => {
    if (!target || parts.expired) return;
    const id = setInterval(() => setParts(diff(target, Date.now())), 1000);
    return () => clearInterval(id);
  }, [target, parts.expired]);

  if (!target) return null;

  return (
    <section
      className="px-6 py-16 text-center text-white"
      style={{ background: "linear-gradient(135deg, var(--promo-primary), var(--promo-secondary))" }}
    >
      <div className="mx-auto max-w-[var(--promo-max-width,1200px)]">
        {c.title && (
          <h2 className="mb-8 font-[var(--promo-font)] text-3xl font-black tracking-tight md:text-4xl">
            {c.title}
          </h2>
        )}
        {parts.expired ? (
          <div className="text-2xl font-bold opacity-95 md:text-3xl">
            {c.message || "Sự kiện đã bắt đầu!"}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 md:gap-6">
            {[
              { value: parts.days, label: "Ngày" },
              { value: parts.hours, label: "Giờ" },
              { value: parts.minutes, label: "Phút" },
              { value: parts.seconds, label: "Giây" },
            ].map((p) => (
              <div
                key={p.label}
                className="min-w-[68px] rounded-xl bg-white/15 px-3 py-4 backdrop-blur-sm md:min-w-[100px]"
              >
                <div className="font-mono text-3xl font-black tracking-tight md:text-5xl">
                  {String(p.value).padStart(2, "0")}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-90 md:text-xs">
                  {p.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
