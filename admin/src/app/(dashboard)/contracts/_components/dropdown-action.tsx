"use client";

/**
 * Lightweight controlled dropdown action wrapper (no @base-ui/react Menu yet).
 * Used by document-download-btn.tsx and contract-list-table.tsx row actions.
 *
 * KEEPS THINGS SIMPLE: state lives in this component, native focus restore via
 * `onBlur`. F-024 Phase 2B scope — not full shadcn DropdownMenu. Sufficient for
 * the few actions per row.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MenuProps = {
  label: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost";
};

export function DropdownActionMenu({
  label,
  children,
  disabled,
  variant = "outline",
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <Button
        type="button"
        variant={variant === "primary" ? "default" : variant === "ghost" ? "ghost" : "outline"}
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 mt-1 min-w-44 rounded-md border border-[var(--border,#E7E2D9)] bg-white shadow-lg",
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownActionTrigger({
  onSelect,
  children,
}: {
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F3F0EB]"
    >
      {children}
    </button>
  );
}
