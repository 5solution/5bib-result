"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";

const POPULAR = ["hoàn vé", "đổi size áo", "COD BIB", "certificate PDF", "đổi cự ly", "5Pix tìm ảnh"];

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    // Phase 1: search not implemented backend-side; navigate to /tin-tuc with q param
    // (placeholder until we add full-text search to backend).
    router.push(`/tin-tuc?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <>
      <form
        onSubmit={submit}
        className="flex gap-2 rounded-2xl bg-white p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]"
      >
        <div className="relative flex flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-4 size-5 text-[var(--5s-blue)]"
            strokeWidth={2.4}
          />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ví dụ: hoàn vé, đổi size áo, nhận BIB COD…"
            className="w-full border-none bg-transparent py-4 pl-12 pr-4 text-base font-medium text-[var(--5s-text)] outline-none placeholder:text-[var(--5s-text-subtle)]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--5s-blue)] px-5 font-bold text-white transition-colors hover:bg-[var(--5s-blue-600)]"
        >
          Tìm kiếm
          <ArrowRight className="size-4" />
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-65">
          Tìm kiếm phổ biến:
        </span>
        {POPULAR.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQ(s);
              router.push(`/tin-tuc?q=${encodeURIComponent(s)}`);
            }}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            {s}
          </button>
        ))}
      </div>
    </>
  );
}
