"use client";

/**
 * FEATURE-027 — PromoHubPreview.
 *
 * Lightweight preview pane (admin-only mockup). KHÔNG render đầy đủ
 * như public site — chỉ skeleton block để admin hình dung thứ tự
 * section + nội dung config. Full render trên public 5bib.com/hub/[slug]
 * (Phase A3).
 *
 * BR-PH-06 (preview iframe) — Phase A2 dùng inline mock; Phase A3 link
 * sang public URL với `?preview=draft` query nếu cần preview chính xác.
 */

import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";
import { SECTION_TYPE_META } from "./section-types";
import type { EditorSection } from "./SectionCard";

export function PromoHubPreview({
  title,
  sections,
  primaryColor,
}: {
  title: string;
  sections: EditorSection[];
  primaryColor?: string;
}) {
  const visible = sections.filter((s) => s.visible);

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div
        className="border-b p-4"
        style={{ borderTopColor: primaryColor ?? "#1d4ed8", borderTopWidth: 4 }}
      >
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Preview Hub (mock)
        </div>
        <div className="mt-1 text-lg font-bold">{title || "(Chưa có tiêu đề)"}</div>
      </div>

      <div className="space-y-3 p-4">
        {sections.length === 0 && (
          <div className="rounded-lg border border-dashed bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            Chưa có section nào. Thêm section ở cột trái để bắt đầu.
          </div>
        )}

        {sections.map((s) => {
          const meta = SECTION_TYPE_META[s.type];
          const Icon = meta.icon;
          const titleHint =
            (s.config?.title as string | undefined) ||
            (s.config?.ctaLabel as string | undefined) ||
            "(chưa cấu hình)";
          return (
            <div
              key={s._id}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                s.visible ? "bg-card" : "bg-muted/40 opacity-50"
              }`}
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted">
                <Icon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    #{s.order + 1}
                  </Badge>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {titleHint}
                </div>
              </div>
              <div className="shrink-0 text-muted-foreground">
                {s.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </div>
            </div>
          );
        })}

        <div className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
          {visible.length}/{sections.length} section đang hiển thị
        </div>
      </div>
    </div>
  );
}
