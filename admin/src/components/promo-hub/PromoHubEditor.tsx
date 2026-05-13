"use client";

/**
 * FEATURE-027 — PromoHubEditor.
 *
 * Main editor surface. Compose:
 *   - Section list (sortable via @dnd-kit/sortable)
 *   - Add Section panel (9 types theo SECTION_TYPE_META)
 *   - SectionConfigDialog (modal per-section edit)
 *
 * State held in parent edit page. Editor là controlled component:
 * `sections` prop + `onChange(sections)` callback. Parent persists
 * to backend via promoHubControllerUpdate.
 */

import { useCallback, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, type EditorSection } from "./SectionCard";
import { SectionConfigDialog } from "./SectionConfigDialog";
import { SECTION_TYPE_META, type SectionType, SECTION_TYPES } from "./section-types";
import { cn } from "@/lib/utils";

type Props = {
  sections: EditorSection[];
  onChange: (next: EditorSection[]) => void;
};

export function PromoHubEditor({ sections, onChange }: Props) {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 5px activation distance — avoid triggering drag on edit/delete click
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = sections.findIndex((s) => s._id === active.id);
      const newIdx = sections.findIndex((s) => s._id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      const moved = arrayMove(sections, oldIdx, newIdx).map((s, i) => ({
        ...s,
        order: i,
      }));
      onChange(moved);
    },
    [sections, onChange],
  );

  const handleAdd = (type: SectionType) => {
    const meta = SECTION_TYPE_META[type];
    const newSection: EditorSection = {
      _id: cryptoRandomId(),
      type,
      order: sections.length,
      visible: true,
      config: structuredClone(meta.defaultConfig),
    };
    onChange([...sections, newSection]);
    setShowAddPanel(false);
    setEditingId(newSection._id);
    toast.success(`Đã thêm section: ${meta.label}`);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Xóa section này?")) return;
    onChange(
      sections
        .filter((s) => s._id !== id)
        .map((s, i) => ({ ...s, order: i })),
    );
  };

  const handleToggleVisible = (id: string) => {
    onChange(
      sections.map((s) =>
        s._id === id ? { ...s, visible: !s.visible } : s,
      ),
    );
  };

  const handleSaveSection = (updated: EditorSection) => {
    onChange(
      sections.map((s) => (s._id === updated._id ? updated : s)),
    );
    setEditingId(null);
    toast.success("Đã cập nhật section");
  };

  const editingSection =
    editingId != null ? sections.find((s) => s._id === editingId) ?? null : null;

  return (
    <div className="space-y-3">
      {/* Sortable section list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s._id)}
          strategy={verticalListSortingStrategy}
        >
          {sections.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 py-10 text-center">
              <div className="text-sm font-medium text-muted-foreground">
                Chưa có section nào
              </div>
              <div className="text-xs text-muted-foreground">
                Bấm "Thêm section" bên dưới để bắt đầu.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {sections.map((s) => (
                <SectionCard
                  key={s._id}
                  section={s}
                  onEdit={() => setEditingId(s._id)}
                  onToggleVisible={() => handleToggleVisible(s._id)}
                  onDelete={() => handleDelete(s._id)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>

      {/* Add section trigger */}
      {!showAddPanel ? (
        <Button
          variant="outline"
          onClick={() => setShowAddPanel(true)}
          className="w-full justify-center gap-2 border-dashed"
        >
          <Plus className="size-4" />
          Thêm section
        </Button>
      ) : (
        <div className="rounded-xl border bg-card p-3 shadow-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Chọn loại section</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddPanel(false)}
            >
              Hủy
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SECTION_TYPES.map((t) => {
              const meta = SECTION_TYPE_META[t];
              const Icon = meta.icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleAdd(t)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-lg border bg-card p-3 text-left transition-colors",
                    "hover:border-[var(--admin-blue)] hover:bg-blue-50/40",
                  )}
                >
                  <Icon className="size-5 text-[var(--admin-blue)]" aria-hidden />
                  <div className="text-sm font-semibold">{meta.label}</div>
                  <div className="text-[11px] leading-tight text-muted-foreground">
                    {meta.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <SectionConfigDialog
        open={editingId !== null}
        section={editingSection}
        onClose={() => setEditingId(null)}
        onSave={handleSaveSection}
      />
    </div>
  );
}

/**
 * Stable client-side id for new sections before persisting.
 * Backend will re-assign real ObjectId on save — we just need
 * uniqueness within the editor state for dnd-kit `id`.
 */
function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
