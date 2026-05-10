"use client";

/**
 * 5BIB Admin Global Search — FEATURE-022 BR-DESIGN-11.
 *
 * Pill ⌘K trigger + modal placeholder (Giai doan 1).
 *
 * PAUSE-CODER-V22-CMDK quyet dinh:
 *   `cmdk` library KHONG co trong package.json.
 *   Repo dung @base-ui/react thay vi @radix-ui — Manager note "command shadcn"
 *   khong ap dung 1-1.
 *   Giai doan 1 chi can placeholder modal (thong bao "Tinh nang tim kiem
 *   dang duoc phat trien"), dung Dialog co san. KHONG `pnpm install`.
 *   Full search engine integrate o giai doan sau (FEATURE-023+).
 */

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);

  // Cmd+K / Ctrl+K → toggle modal.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Mở tìm kiếm tổng (Cmd K)"
            className="flex h-[34px] w-[280px] items-center gap-2 rounded-input border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 text-[13px] text-[var(--admin-text-muted)] transition-colors hover:bg-[var(--admin-surface-3)]"
          />
        }
      >
        <Search className="size-3.5" aria-hidden />
        <span className="flex-1 text-left">Tìm kiếm…</span>
        <kbd className="rounded border border-[var(--admin-border)] bg-white px-1.5 py-px font-mono text-[10px] text-[var(--admin-text-muted)]">
          ⌘K
        </kbd>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tìm kiếm tổng</DialogTitle>
          <DialogDescription>
            Tính năng tìm kiếm đang được phát triển. Trong giai đoạn này bạn có thể
            điều hướng nhanh qua sidebar bên trái.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-input border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-6 text-center text-[13px] text-[var(--admin-text-muted)]">
          Mở giai đoạn 2 — full search across race, athlete, claim, reconciliation.
        </div>
      </DialogContent>
    </Dialog>
  );
}
