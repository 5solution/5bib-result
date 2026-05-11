"use client";

/**
 * F-024 Provider Picker — toggle 5BIB vs 5SOLUTION (BR-CM-01).
 *
 * Static config — không fetch từ DB. Default association:
 *   - TICKET_SALES / TIMING / RACEKIT → 5BIB
 *   - OPERATIONS                      → 5SOLUTION
 * Admin override per-contract.
 */
import type { ProviderId, ContractType } from "@/lib/contracts-api";
import { cn } from "@/lib/utils";

type Props = {
  value: ProviderId;
  onChange: (id: ProviderId) => void;
  contractType?: ContractType;
};

const PROVIDERS: { id: ProviderId; name: string; mst: string }[] = [
  { id: "5BIB", name: "Công ty CP 5BIB", mst: "0110398986" },
  { id: "5SOLUTION", name: "Công ty CP Công nghệ 5Solution", mst: "0111213998" },
];

export function ProviderPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PROVIDERS.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={cn(
              "flex flex-col rounded-lg border-2 p-4 text-left transition-colors",
              active
                ? "border-[var(--admin-blue,#1D49FF)] bg-[#E6ECFF]"
                : "border-[var(--border,#E7E2D9)] bg-white hover:border-[#CCD9FF]",
            )}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted,#78716C)]">
              Provider {p.id}
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--text,#1C1917)]">
              {p.name}
            </div>
            <div className="mt-1 font-mono text-xs text-[var(--text-muted,#78716C)]">
              MST: {p.mst}
            </div>
          </button>
        );
      })}
    </div>
  );
}
