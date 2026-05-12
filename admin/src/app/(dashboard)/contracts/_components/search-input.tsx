"use client";

/**
 * F-024 UX-30 — Search input wrapper với clear (X) button conditional.
 *
 * Wraps shadcn `<Input>` + Search icon left + X clear button right (chỉ hiển
 * thị khi value !== ""). Forward additional props as-is.
 *
 * Replaces 5 search inputs scattered across contracts module.
 */
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: string;
  onChange: (next: string) => void;
  /** Placeholder, defaults "Tìm kiếm". */
  placeholder?: string;
  /** Optional aria-label cho input. */
  ariaLabel?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm",
  ariaLabel,
  className,
  ...rest
}: SearchInputProps) {
  const has = value.length > 0;
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
      <Input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`pl-8 ${has ? "pr-8" : ""} ${className ?? ""}`.trim()}
      />
      {has && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Xoá ô tìm"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-[var(--text-muted,#78716C)] hover:text-[var(--text,#1c1917)]"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
