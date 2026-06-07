"use client";

/**
 * F-069 M3 — Logto user lookup field (BR-MP-36).
 *
 * Admin gõ email hoặc userId → "Tra cứu" → GET /admin/merchant-portal/logto-lookup.
 *  - found  → onFound(user) để form prefill userId/userName/email
 *  - not found / 503 (Logto unreachable) → KHÔNG block: admin nhập tay
 *    (graceful degrade per Manager plan + DTO doc).
 */
import { useState } from "react";
import { Search, CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/api";
import { merchantPortalAdminControllerLookupLogto } from "@/lib/api-generated/sdk.gen";
import type { LogtoLookupUserDto } from "@/lib/api-generated/types.gen";

type Props = {
  onFound: (user: LogtoLookupUserDto) => void;
};

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; source: string }
  | { kind: "notfound" }
  | { kind: "unavailable" };

export function LogtoLookupField({ onFound }: Props) {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [state, setState] = useState<LookupState>({ kind: "idle" });

  const tooShort = q.trim().length < 3;

  async function handleLookup() {
    if (!token || tooShort) return;
    setState({ kind: "loading" });
    try {
      const { data, error } = await merchantPortalAdminControllerLookupLogto({
        query: { q: q.trim() },
        ...authHeaders(token),
      });
      if (error) throw error;
      if (data?.found && data.user) {
        onFound(data.user);
        setState({ kind: "found", source: data.source });
      } else {
        setState({ kind: "notfound" });
      }
    } catch {
      // 503 Logto unreachable hoặc lỗi khác — cho nhập tay, không block form.
      setState({ kind: "unavailable" });
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted,#78716C)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLookup();
              }
            }}
            placeholder="Email hoặc Logto User ID..."
            className="pl-8"
            aria-label="Tra cứu user Logto"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleLookup}
          disabled={tooShort || state.kind === "loading"}
        >
          {state.kind === "loading" ? "Đang tra..." : "Tra cứu"}
        </Button>
      </div>

      {state.kind === "found" && (
        <p className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle2 className="size-3.5" />
          Đã tìm thấy user — đã điền sẵn thông tin bên dưới.
        </p>
      )}
      {state.kind === "notfound" && (
        <p className="flex items-center gap-1 text-xs text-amber-700">
          <AlertCircle className="size-3.5" />
          Không tìm thấy user Logto khớp — bạn có thể nhập tay bên dưới.
        </p>
      )}
      {state.kind === "unavailable" && (
        <p className="flex items-center gap-1 text-xs text-amber-700">
          <AlertCircle className="size-3.5" />
          Không kết nối được Logto lúc này — nhập tay User ID + tên + email bên dưới.
        </p>
      )}
      {tooShort && q.length > 0 && (
        <p className="text-xs text-[var(--text-muted,#78716C)]">
          Nhập tối thiểu 3 ký tự để tra cứu.
        </p>
      )}
    </div>
  );
}
