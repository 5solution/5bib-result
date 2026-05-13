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

    /* ────────── Phase B — Landing-page expansion ────────── */

    case "link_grid": {
      const items =
        (c.items as Array<{ imageUrl: string; title: string; url: string }>) ?? [];
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field label="Số cột">
            <Select
              value={String((c.columns as number) ?? 3)}
              onValueChange={(v) => v && onChange({ columns: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 cột</SelectItem>
                <SelectItem value="3">3 cột</SelectItem>
                <SelectItem value="4">4 cột</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="space-y-2">
            <Label>Các liên kết</Label>
            {items.map((it, i) => (
              <div key={i} className="space-y-2 rounded border bg-muted/30 p-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={it.title}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...it, title: e.target.value };
                      onChange({ items: next });
                    }}
                    placeholder="Tiêu đề"
                    className="flex-1"
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
                <Input
                  value={it.imageUrl}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, imageUrl: e.target.value };
                    onChange({ items: next });
                  }}
                  placeholder="URL ảnh"
                />
                <Input
                  value={it.url}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, url: e.target.value };
                    onChange({ items: next });
                  }}
                  placeholder="URL đích khi click"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({ items: [...items, { imageUrl: "", title: "", url: "" }] })
              }
            >
              <Plus className="mr-1 size-4" /> Thêm liên kết
            </Button>
          </div>
        </div>
      );
    }

    case "social_links": {
      const links =
        (c.links as Array<{ platform: string; url: string }>) ?? [];
      const PLATFORMS = [
        "facebook",
        "instagram",
        "tiktok",
        "youtube",
        "twitter",
        "linkedin",
        "telegram",
        "zalo",
        "email",
        "custom",
      ];
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề (tùy chọn)">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field label="Căn lề">
            <Select
              value={(c.align as string) ?? "center"}
              onValueChange={(v) => v && onChange({ align: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Trái</SelectItem>
                <SelectItem value="center">Giữa</SelectItem>
                <SelectItem value="right">Phải</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="space-y-2">
            <Label>Liên kết mạng xã hội</Label>
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  value={l.platform}
                  onValueChange={(v) => {
                    if (!v) return;
                    const next = [...links];
                    next[i] = { ...l, platform: v };
                    onChange({ links: next });
                  }}
                >
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={l.url}
                  onChange={(e) => {
                    const next = [...links];
                    next[i] = { ...l, url: e.target.value };
                    onChange({ links: next });
                  }}
                  placeholder="URL"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ links: links.filter((_, j) => j !== i) })}
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
                onChange({ links: [...links, { platform: "facebook", url: "" }] })
              }
            >
              <Plus className="mr-1 size-4" /> Thêm liên kết
            </Button>
          </div>
        </div>
      );
    }

    case "faq": {
      const items = (c.items as Array<{ question: string; answer: string }>) ?? [];
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? "Câu hỏi thường gặp"}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <Label>Danh sách câu hỏi</Label>
            {items.map((q, i) => (
              <div key={i} className="space-y-2 rounded border bg-muted/30 p-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={q.question}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...q, question: e.target.value };
                      onChange({ items: next });
                    }}
                    placeholder="Câu hỏi"
                    className="flex-1 font-semibold"
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
                <Textarea
                  rows={3}
                  value={q.answer}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...q, answer: e.target.value };
                    onChange({ items: next });
                  }}
                  placeholder="Trả lời"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange({ items: [...items, { question: "", answer: "" }] })}
            >
              <Plus className="mr-1 size-4" /> Thêm câu hỏi
            </Button>
          </div>
        </div>
      );
    }

    case "countdown":
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field label="Thời điểm đếm tới">
            <Input
              type="datetime-local"
              value={((c.targetDate as string) ?? "").slice(0, 16)}
              onChange={(e) =>
                onChange({
                  targetDate: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : "",
                })
              }
            />
          </Field>
          <Field label="Thông điệp khi hết hạn">
            <Input
              value={(c.message as string) ?? ""}
              onChange={(e) => onChange({ message: e.target.value })}
              placeholder="Sự kiện đã bắt đầu!"
            />
          </Field>
        </div>
      );

    case "video_embed":
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề (tùy chọn)">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field label="Nhà cung cấp">
            <Select
              value={(c.provider as string) ?? "youtube"}
              onValueChange={(v) => v && onChange({ provider: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="vimeo">Vimeo</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Video ID hoặc URL"
            hint="VD: dQw4w9WgXcQ (YouTube ID) hoặc paste full URL"
          >
            <Input
              value={(c.videoId as string) ?? ""}
              onChange={(e) => onChange({ videoId: e.target.value })}
              placeholder="dQw4w9WgXcQ"
            />
          </Field>
          <Field label="Chú thích dưới video">
            <Input
              value={(c.caption as string) ?? ""}
              onChange={(e) => onChange({ caption: e.target.value })}
            />
          </Field>
        </div>
      );

    case "image_gallery": {
      const images = (c.images as Array<{ url: string; alt: string }>) ?? [];
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field label="Số cột">
            <Select
              value={String((c.columns as number) ?? 3)}
              onValueChange={(v) => v && onChange({ columns: Number(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 cột</SelectItem>
                <SelectItem value="3">3 cột</SelectItem>
                <SelectItem value="4">4 cột</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="space-y-2">
            <Label>Ảnh</Label>
            {images.map((img, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={img.url}
                  onChange={(e) => {
                    const next = [...images];
                    next[i] = { ...img, url: e.target.value };
                    onChange({ images: next });
                  }}
                  placeholder="URL ảnh"
                  className="flex-1"
                />
                <Input
                  value={img.alt}
                  onChange={(e) => {
                    const next = [...images];
                    next[i] = { ...img, alt: e.target.value };
                    onChange({ images: next });
                  }}
                  placeholder="Alt text"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ images: images.filter((_, j) => j !== i) })}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange({ images: [...images, { url: "", alt: "" }] })}
            >
              <Plus className="mr-1 size-4" /> Thêm ảnh
            </Button>
          </div>
        </div>
      );
    }

    case "testimonial": {
      const items =
        (c.items as Array<{ quote: string; author: string; role: string; avatarUrl: string }>) ?? [];
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề (tùy chọn)">
            <Input
              value={(c.title as string) ?? ""}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <Label>Cảm nhận</Label>
            {items.map((it, i) => (
              <div key={i} className="space-y-2 rounded border bg-muted/30 p-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={it.author}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...it, author: e.target.value };
                      onChange({ items: next });
                    }}
                    placeholder="Tên người chia sẻ"
                    className="flex-1"
                  />
                  <Input
                    value={it.role}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...it, role: e.target.value };
                      onChange({ items: next });
                    }}
                    placeholder="Vai trò (VĐV / KOL / ...)"
                    className="flex-1"
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
                <Input
                  value={it.avatarUrl}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, avatarUrl: e.target.value };
                    onChange({ items: next });
                  }}
                  placeholder="URL avatar (tùy chọn)"
                />
                <Textarea
                  rows={3}
                  value={it.quote}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, quote: e.target.value };
                    onChange({ items: next });
                  }}
                  placeholder='"Trải nghiệm tuyệt vời..."'
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  items: [
                    ...items,
                    { quote: "", author: "", role: "", avatarUrl: "" },
                  ],
                })
              }
            >
              <Plus className="mr-1 size-4" /> Thêm cảm nhận
            </Button>
          </div>
        </div>
      );
    }

    case "map_embed":
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? "Địa điểm"}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field
            label="Google Maps embed URL"
            hint="Lấy từ Google Maps → Share → Embed a map → copy src của iframe"
          >
            <Textarea
              rows={3}
              value={(c.embedUrl as string) ?? ""}
              onChange={(e) => onChange({ embedUrl: e.target.value })}
              placeholder="https://www.google.com/maps/embed?pb=..."
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Địa chỉ hiển thị">
            <Input
              value={(c.address as string) ?? ""}
              onChange={(e) => onChange({ address: e.target.value })}
              placeholder="Mộc Châu, Sơn La"
            />
          </Field>
        </div>
      );

    case "schedule_timeline": {
      const items =
        (c.items as Array<{ time: string; title: string; description: string }>) ?? [];
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? "Lịch trình race day"}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <Label>Các mốc thời gian</Label>
            {items.map((it, i) => (
              <div key={i} className="space-y-2 rounded border bg-muted/30 p-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={it.time}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...it, time: e.target.value };
                      onChange({ items: next });
                    }}
                    placeholder="04:00"
                    className="w-[100px] font-mono"
                  />
                  <Input
                    value={it.title}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...it, title: e.target.value };
                      onChange({ items: next });
                    }}
                    placeholder="Tiêu đề mốc"
                    className="flex-1 font-semibold"
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
                <Input
                  value={it.description}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...it, description: e.target.value };
                    onChange({ items: next });
                  }}
                  placeholder="Mô tả chi tiết (tùy chọn)"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  items: [...items, { time: "", title: "", description: "" }],
                })
              }
            >
              <Plus className="mr-1 size-4" /> Thêm mốc
            </Button>
          </div>
        </div>
      );
    }

    case "form_embed":
      return (
        <div className="space-y-3">
          <Field label="Tiêu đề khối">
            <Input
              value={(c.title as string) ?? "Đăng ký nhận tin"}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <Field label="Mô tả ngắn">
            <Textarea
              rows={2}
              value={(c.description as string) ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </Field>
          <Field label="Nhà cung cấp">
            <Select
              value={(c.provider as string) ?? "iframe"}
              onValueChange={(v) => v && onChange({ provider: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iframe">iframe (Google Form / Tally)</SelectItem>
                <SelectItem value="link">Link bên ngoài (CTA button)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Embed URL / Link form">
            <Input
              value={(c.embedUrl as string) ?? ""}
              onChange={(e) => onChange({ embedUrl: e.target.value })}
              placeholder="https://docs.google.com/forms/.../viewform?embedded=true"
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
