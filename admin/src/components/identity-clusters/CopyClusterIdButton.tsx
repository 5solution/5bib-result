/**
 * F-049 — Copy cluster UUID to clipboard với toast feedback.
 *
 * BR-49-01 + BR-49-18: click icon → navigator.clipboard.writeText(fullUUID)
 * → toast 2s "Đã sao chép ID hồ sơ: <full-uuid>".
 */

"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ACTION_LABEL } from "@/lib/identity-cluster-labels";

interface Props {
  clusterId: string;
  /** "icon" → 24px ghost icon button. "inline" → wider button with text. */
  size?: "icon" | "inline";
}

export function CopyClusterIdButton({ clusterId, size = "icon" }: Props) {
  const handleCopy = async () => {
    try {
      // Modern API (HTTPS required) — graceful fallback for legacy environments
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(clusterId);
        toast.success(`Đã sao chép ID hồ sơ: ${clusterId}`, { duration: 2000 });
        return;
      }
      throw new Error("Clipboard API unavailable");
    } catch {
      toast.error("Không thể sao chép — trình duyệt không hỗ trợ");
    }
  };

  if (size === "inline") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        title={ACTION_LABEL.copyId}
        className="gap-1"
      >
        <Copy className="size-3.5" />
        <span>{ACTION_LABEL.copyId}</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      title={ACTION_LABEL.copyId}
      aria-label={ACTION_LABEL.copyId}
      className="size-7 p-0"
    >
      <Copy className="size-3.5" />
    </Button>
  );
}
