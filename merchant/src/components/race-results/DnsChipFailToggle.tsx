"use client";

/**
 * F-010 BR-FC-07 — DNS Chip Fail admin toggle button.
 *
 * Inline mutation button shown on athletes có DNS status (no Start time).
 * Single-click toggle: PATCH /api/race-results/:id/dns-chip-fail.
 *
 * UX: optimistic toggle state with rollback on error. After mutation invalidates
 * `dashboard-snapshot` query (handled by parent if available; else relies on
 * 15s TTL cache + backend cache invalidation in service).
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/api";
import { client } from "@/lib/api-generated/client.gen";

interface Props {
  resultId: string;
  initial: boolean;
  /** Optional callback after mutation success */
  onChanged?: (newValue: boolean) => void;
}

export default function DnsChipFailToggle({
  resultId,
  initial,
  onChanged,
}: Props) {
  const [value, setValue] = useState<boolean>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (pending) return;
    const next = !value;
    const prev = value;
    setPending(true);
    setError(null);
    setValue(next); // optimistic

    try {
      const res = await client.patch({
        url: `/api/race-results/${resultId}/dns-chip-fail`,
        body: { dnsChipFail: next },
        headers: authHeaders(),
        throwOnError: true,
      });
      const data = res.data as { success: boolean; dnsChipFail: boolean };
      if (data && typeof data.dnsChipFail === "boolean") {
        setValue(data.dnsChipFail);
        onChanged?.(data.dnsChipFail);
      }
    } catch (e) {
      setValue(prev); // rollback
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={value ? "destructive" : "outline"}
        size="sm"
        onClick={toggle}
        disabled={pending}
        title={
          value
            ? "Hủy đánh dấu chip fail (revert to No Start)"
            : "Đánh dấu là DNS_CHIP_FAIL (vendor chip equipment fail)"
        }
      >
        {pending
          ? "Đang lưu..."
          : value
            ? "Bỏ đánh dấu Chip Fail"
            : "Đánh dấu Chip Fail"}
      </Button>
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
