"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  slug: string;
  initialYes: number;
  initialNo: number;
}

const STORAGE_PREFIX = "helpful-voted:";

type FlashState = null | { kind: "thanks" | "alreadyVoted" | "error"; text: string };

export function HelpfulVote({ slug, initialYes, initialNo }: Props) {
  const [yes, setYes] = useState(initialYes);
  const [no, setNo] = useState(initialNo);
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<FlashState>(null);

  // Restore "already voted" state from localStorage (per-slug per-browser dedup
  // beyond backend's IP-based 24h window).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_PREFIX + slug)) setVoted(true);
  }, [slug]);

  const submit = async (helpful: boolean) => {
    if (voted || submitting) return;
    setSubmitting(true);
    try {
      // Proxy through our route handler so we don't expose API key in browser.
      const res = await fetch(`/api/helpful/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        helpfulYes: number;
        helpfulNo: number;
        alreadyVoted: boolean;
      };
      setYes(data.helpfulYes);
      setNo(data.helpfulNo);
      setVoted(true);
      localStorage.setItem(STORAGE_PREFIX + slug, "1");
      // B-26: tell user explicitly when their vote was deduped vs accepted.
      // Backend silently returns alreadyVoted:true on dup — without this UI cue
      // user is left wondering whether the click registered.
      setFlash(
        data.alreadyVoted
          ? {
              kind: "alreadyVoted",
              text: "Bạn đã đánh giá bài này rồi — vote này không được tính.",
            }
          : { kind: "thanks", text: "Cảm ơn phản hồi của bạn!" },
      );
    } catch {
      setFlash({ kind: "error", text: "Lỗi mạng — thử lại sau." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="my-12 flex items-center justify-between gap-4 rounded-2xl border border-[var(--5s-border)] bg-white p-6">
      <div>
        <div className="mb-1 font-[var(--font-display)] text-[17px] font-extrabold">
          Bài viết này có hữu ích không?
        </div>
        {flash ? (
          <div
            className={`inline-flex items-center gap-1.5 text-[13px] ${
              flash.kind === "thanks"
                ? "text-emerald-700"
                : flash.kind === "alreadyVoted"
                  ? "text-amber-700"
                  : "text-[var(--5s-danger)]"
            }`}
          >
            {flash.kind === "thanks" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            {flash.text}
          </div>
        ) : (
          <div className="text-[13px] text-[var(--5s-text-muted)]">
            Phản hồi của bạn giúp chúng tôi cải thiện bài viết.
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={voted || submitting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--5s-border)] bg-white px-4 py-2 text-sm font-bold transition-colors hover:border-[var(--5s-blue)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {voted ? <CheckCircle2 className="size-4 text-emerald-600" /> : <ThumbsUp className="size-4" />}
          Có ({yes})
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={voted || submitting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--5s-border)] bg-white px-4 py-2 text-sm font-bold transition-colors hover:border-[var(--5s-blue)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ThumbsDown className="size-4" />
          Không ({no})
        </button>
      </div>
    </div>
  );
}
