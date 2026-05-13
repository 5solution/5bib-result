"use client";

/**
 * FEATURE-027 — SectionConfigDialog.
 *
 * Modal config editor per section type. Renders type-specific form
 * (hero / cta_buttons / stats / sponsors / …) + universal schedule
 * fieldset + visible toggle.
 *
 * KHÔNG validate field-level — chỉ collect form input → onSave callback
 * propagates lên PromoHubEditor → service write path. Backend re-validates
 * cuối cùng (defense in depth).
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import type { EditorSection } from "./SectionCard";
import { SECTION_TYPE_META } from "./section-types";

type Props = {
  open: boolean;
  section: EditorSection | null;
  onClose: () => void;
  onSave: (updated: EditorSection) => void;
};

export function SectionConfigDialog({ open, section, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<EditorSection | null>(section);

  useEffect(() => {
    setDraft(section ? structuredClone(section) : null);
  }, [section]);

  if (!draft) return null;

  const meta = SECTION_TYPE_META[draft.type];

  const updateConfig = (patch: Record<string, unknown>) => {
    setDraft({ ...draft, config: { ...draft.config, ...patch } });
  };

  const updateSchedule = (patch: Partial<NonNullable<EditorSection["schedule"]>>) => {
    setDraft({
      ...draft,
      schedule: {
        enabled: false,
        ...(draft.schedule ?? {}),
        ...patch,
      },
    });
  };

  const handleSave = () => {
    if (draft) onSave(draft);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary">{meta.label}</Badge>
            <span>Cấu hình section</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Type-specific form */}
          <TypeSpecificForm section={draft} onChange={updateConfig} />

          <Separator />

          {/* Visibility */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div>
              <div className="text-sm font-semibold">Hiển thị section</div>
              <div className="text-xs text-muted-foreground">
                Tắt để ẩn khỏi public site (giữ data trong draft).
              </div>
            </div>
            <Switch
              checked={draft.visible}
              onCheckedChange={(v) => setDraft({ ...draft, visible: v })}
            />
          </div>

          {/* Schedule */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Lịch hiển thị</div>
                <div className="text-xs text-muted-foreground">
                  Chỉ hiển thị section trong khoảng thời gian cụ thể. Timezone:
                  Asia/Ho_Chi_Minh (lưu UTC).
                </div>
              </div>
              <Switch
                checked={draft.schedule?.enabled ?? false}
                onCheckedChange={(v) => updateSchedule({ enabled: v })}
              />
            </div>

            {draft.schedule?.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="startDate">Bắt đầu</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={draft.schedule?.startDate?.slice(0, 16) ?? ""}
                    onChange={(e) =>
                      updateSchedule({
                        startDate: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : undefined,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Kết thúc</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={draft.schedule?.endDate?.slice(0, 16) ?? ""}
                    onChange={(e) =>
                      updateSchedule({
                        endDate: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : undefined,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSave}>Lưu section</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Type-specific form rendering — mỗi section type 1 form khác nhau
 * ──────────────────────────────────────────────────────────── */

function TypeSpecificForm({
  section,
  onChange,
}: {
  section: EditorSection;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const c = section.config;

  switch (section.type) {
    case "hero":
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="UTMB Việt Nam 2026"
            />
          </Field>
          <Field label="Phụ đề">
            <Input
              value={(c.subtitle as string) ?? ""}
              onChange={(e) => onChange({ subtitle: e.target.value })}
              placeholder="Giải chạy địa hình lớn nhất Đông Nam Á"
            />
          </Field>
          <Field label="Ảnh nền (URL)">
            <Input
              value={(c.backgroundImage as string) ?? ""}
              onChange={(e) => onChange({ backgroundImage: e.target.value })}
              placeholder="https://… .jpg"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nhãn CTA">
              <Input
                value={(c.ctaLabel as string) ?? ""}
                onChange={(e) => onChange({ ctaLabel: e.target.value })}
                placeholder="Đăng ký ngay"
              />
            </Field>
            <Field label="URL CTA">
              <Input
                value={(c.ctaUrl as string) ?? ""}
                onChange={(e) => onChange({ ctaUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          </div>
          <Field label="Căn lề">
            <Select
              value={(c.align as string) ?? "center"}
              onValueChange={(v) => v && onChange({ align: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Trái</SelectItem>
                <SelectItem value="center">Giữa</SelectItem>
                <SelectItem value="right">Phải</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      );

    case "race_calendar":
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field label="Số giải hiển thị">
            <Input
              type="number"
              min={1}
              max={20}
              value={(c.limit as number) ?? 6}
              onChange={(e) => onChange({ limit: Number(e.target.value) })}
            />
          </Field>
          <Field label="Lọc theo trạng thái">
            <Select
              value={(((c.filter as Record<string, string> | undefined)?.status) ?? "pre_race") as string}
              onValueChange={(v) =>
                v && onChange({ filter: { ...(c.filter as object), status: v } })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre_race">Sắp diễn ra</SelectItem>
                <SelectItem value="live">Đang diễn ra</SelectItem>
                <SelectItem value="ended">Đã kết thúc</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      );

    case "featured_races":
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field
            label="Race IDs (mỗi ID 1 dòng)"
            hint="Lấy MongoDB ObjectId từ /races/[slug] admin URL hoặc race-detail"
          >
            <Textarea
              rows={4}
              value={((c.raceIds as string[]) ?? []).join("\n")}
              onChange={(e) =>
                onChange({
                  raceIds: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder={"67451abc1234567890abcdef\n67451def…"}
              className="font-mono text-xs"
            />
          </Field>
        </div>
      );

    case "promo_banner":
      return (
        <div className="space-y-3">
          <Field label="URL ảnh banner">
            <Input
              value={(c.imageUrl as string) ?? ""}
              onChange={(e) => onChange({ imageUrl: e.target.value })}
              placeholder="https://… .jpg"
            />
          </Field>
          <Field label="Link khi click">
            <Input
              value={(c.linkUrl as string) ?? ""}
              onChange={(e) => onChange({ linkUrl: e.target.value })}
            />
          </Field>
          <Field label="Alt text (SEO + accessibility)">
            <Input
              value={(c.alt as string) ?? ""}
              onChange={(e) => onChange({ alt: e.target.value })}
            />
          </Field>
        </div>
      );

    case "cta_buttons": {
      const buttons =
        (c.buttons as Array<{ label: string; url: string; variant: string }>) ??
        [];
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề (tùy chọn)">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <Label>Danh sách nút</Label>
            {buttons.map((btn, i) => (
              <div key={i} className="flex items-end gap-2 rounded border bg-muted/30 p-2">
                <div className="flex-1 space-y-2">
                  <Input
                    value={btn.label}
                    onChange={(e) => {
                      const next = [...buttons];
                      next[i] = { ...btn, label: e.target.value };
                      onChange({ buttons: next });
                    }}
                    placeholder="Nhãn nút"
                  />
                  <Input
                    value={btn.url}
                    onChange={(e) => {
                      const next = [...buttons];
                      next[i] = { ...btn, url: e.target.value };
                      onChange({ buttons: next });
                    }}
                    placeholder="URL"
                  />
                </div>
                <Select
                  value={btn.variant ?? "primary"}
                  onValueChange={(v) => {
                    if (!v) return;
                    const next = [...buttons];
                    next[i] = { ...btn, variant: v };
                    onChange({ buttons: next });
                  }}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Chính</SelectItem>
                    <SelectItem value="secondary">Phụ</SelectItem>
                    <SelectItem value="outline">Outline</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = buttons.filter((_, j) => j !== i);
                    onChange({ buttons: next });
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  buttons: [
                    ...buttons,
                    { label: "", url: "", variant: "primary" },
                  ],
                })
              }
            >
              <Plus className="mr-1 size-4" /> Thêm nút
            </Button>
          </div>
        </div>
      );
    }

    case "sponsors": {
      const levels = (c.levels as string[]) ?? [];
      const toggleLevel = (lvl: string) => {
        const next = levels.includes(lvl)
          ? levels.filter((l) => l !== lvl)
          : [...levels, lvl];
        onChange({ levels: next });
      };
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field label="Hạng nhà tài trợ">
            <div className="flex gap-2">
              {(["diamond", "gold", "silver"] as const).map((lvl) => (
                <Button
                  key={lvl}
                  type="button"
                  variant={levels.includes(lvl) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleLevel(lvl)}
                >
                  {lvl === "diamond" ? "💎 Kim cương" : lvl === "gold" ? "🥇 Vàng" : "🥈 Bạc"}
                </Button>
              ))}
            </div>
          </Field>
        </div>
      );
    }

    case "stats": {
      const items =
        (c.items as Array<{ label: string; value: string }>) ?? [];
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <Label>Các số liệu</Label>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={it.label}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, label: e.target.value };
                    onChange({ items: next });
                  }}
                  placeholder="Nhãn (vd: VĐV đã tham gia)"
                />
                <Input
                  value={it.value}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, value: e.target.value };
                    onChange({ items: next });
                  }}
                  placeholder="Giá trị (vd: 94K+)"
                  className="w-[140px] font-mono"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ items: items.filter((_, j) => j !== i) })}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange({ items: [...items, { label: "", value: "" }] })}
            >
              <Plus className="mr-1 size-4" /> Thêm số liệu
            </Button>
          </div>
        </div>
      );
    }

    case "rich_text":
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề (tùy chọn)">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field
            label="Nội dung HTML"
            hint="Backend sanitize-html sẽ strip <script>, event handlers, javascript: URIs."
          >
            <Textarea
              rows={8}
              value={(c.html as string) ?? ""}
              onChange={(e) => onChange({ html: e.target.value })}
              placeholder="<p>Nội dung…</p>"
              className="font-mono text-xs"
            />
          </Field>
        </div>
      );

    case "recent_results":
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field label="Race ID">
            <Input
              value={(c.raceId as string) ?? ""}
              onChange={(e) => onChange({ raceId: e.target.value })}
              placeholder="ObjectId của race"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Số kết quả">
            <Input
              type="number"
              min={1}
              max={20}
              value={(c.limit as number) ?? 5}
              onChange={(e) => onChange({ limit: Number(e.target.value) })}
            />
          </Field>
        </div>
      );

    default:
      return (
        <div className="text-sm text-muted-foreground">
          Section type chưa có form config.
        </div>
      );
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
