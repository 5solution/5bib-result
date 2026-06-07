"use client";

/**
 * FEATURE-027 — SectionCard.
 *
 * Sortable row trong PromoHubEditor. Mỗi card hiển thị: icon section type,
 * label, badge visible/schedule, nút edit / toggle visible / delete + drag handle.
 *
 * @dnd-kit/sortable wraps sortable behavior — `useSortable({ id })`.
 */

import { useSortable } from "@dnd-kit/sortable";
import {
  GripVertical,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SECTION_TYPE_META, type SectionType } from "./section-types";

export type EditorSection = {
  _id: string;
  type: SectionType;
  order: number;
  visible: boolean;
  config: Record<string, unknown>;
  schedule?: {
    enabled: boolean;
    startDate?: string;
    endDate?: string;
  };
};

export function SectionCard({
  section,
  onEdit,
  onToggleVisible,
  onDelete,
}: {
  section: EditorSection;
  onEdit: () => void;
  onToggleVisible: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section._id });

  const meta = SECTION_TYPE_META[section.type];
  const Icon = meta.icon;

  // Inline CSS transform — avoid @dnd-kit/utilities dep
  const transformStr = transform
    ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
    : undefined;
  const style: React.CSSProperties = {
    transform: transformStr,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const titleHint =
    (section.config?.title as string | undefined) ||
    (section.config?.ctaLabel as string | undefined) ||
    "(chưa cấu hình)";

  const scheduleActive = section.schedule?.enabled === true;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs transition-shadow",
        isDragging && "shadow-lg ring-2 ring-[var(--admin-blue)]",
        !section.visible && "bg-muted/30",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Kéo để sắp xếp"
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-5" />
      </button>

      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
        <Icon className="size-5" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{meta.label}</span>
          {!section.visible && (
            <Badge variant="outline" className="border-muted-foreground/30 bg-muted text-muted-foreground">
              Đã ẩn
            </Badge>
          )}
          {scheduleActive && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              <Clock className="mr-1 size-3" /> Có lịch
            </Badge>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{titleHint}</div>
      </div>

      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleVisible}
          aria-label={section.visible ? "Ẩn section" : "Hiện section"}
        >
          {section.visible ? (
            <Eye className="size-4" />
          ) : (
            <EyeOff className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label="Chỉnh sửa"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label="Xóa"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
