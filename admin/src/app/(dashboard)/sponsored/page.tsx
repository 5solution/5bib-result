"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Zap,
  Clock,
  ImageIcon,
  Tag,
  MapPin,
  Calendar,
  Link2,
  AlertTriangle,
  Star,
  Trophy,
  Medal,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type PackageTier = "diamond" | "gold" | "silver";

interface SponsoredItem {
  _id: string;
  race_slug: string;
  event_name: string;
  event_type: string | null;
  cover_image_url: string;
  event_date_start: string;
  event_date_end: string | null;
  event_location: string;
  price_from: number;
  cta_text: string;
  cta_url: string | null;
  promo_label: string | null;
  promo_label_expires_at: string | null;
  badge_labels: string[];
  show_countdown: boolean;
  countdown_target_at: string | null;
  item_order: number;
}

interface SponsoredSlot {
  _id: string;
  package_tier: PackageTier;
  display_order: number;
  is_hero: boolean;
  rotation_interval_seconds: number;
  display_start_at: string;
  display_end_at: string;
  is_active: boolean;
  items: SponsoredItem[];
  diamond_conflict?: boolean;
}

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  diamond: {
    label: "Diamond",
    Icon: Trophy,
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    badgeBg: "bg-violet-100",
    ring: "ring-violet-400",
    dot: "bg-violet-500",
  },
  gold: {
    label: "Gold",
    Icon: Star,
    gradient: "from-amber-400 to-orange-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badgeBg: "bg-amber-100",
    ring: "ring-amber-400",
    dot: "bg-amber-500",
  },
  silver: {
    label: "Silver",
    Icon: Medal,
    gradient: "from-slate-400 to-gray-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
    badgeBg: "bg-slate-100",
    ring: "ring-slate-400",
    dot: "bg-slate-400",
  },
} satisfies Record<PackageTier, unknown>;

function TierBadge({ tier, size = "sm" }: { tier: PackageTier; size?: "sm" | "md" }) {
  const c = TIER_CONFIG[tier];
  const Icon = c.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold border",
        c.bg, c.border, c.text,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-4"} />
      {c.label}
    </span>
  );
}

function SlotStatusDot({ slot }: { slot: SponsoredSlot }) {
  if (!slot.is_active)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-gray-300" />
        Tắt
      </span>
    );
  const now = Date.now();
  const start = new Date(slot.display_start_at).getTime();
  const end = new Date(slot.display_end_at).getTime();
  if (now < start)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
        Upcoming
      </span>
    );
  if (now > end)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-500">
        <span className="size-2 rounded-full bg-red-400" />
        Hết hạn
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
      Đang chạy
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

const API_BASE = "/api/admin/sponsored";

// ── Form defaults ─────────────────────────────────────────────────────────────

const emptySlotForm = {
  package_tier: "silver" as PackageTier,
  display_order: 99,
  is_hero: false,
  rotation_interval_seconds: 5,
  display_start_at: "",
  display_end_at: "",
  is_active: true,
};

const emptyItemForm = {
  race_slug: "",
  event_name: "",
  event_type: "",
  event_date_start: "",
  event_date_end: "",
  event_location: "",
  cover_image_url: "",
  price_from: 0,
  cta_text: "Đăng ký →",
  cta_url: "",
  promo_label: "",
  badge_labels: "",
  show_countdown: false,
  countdown_target_at: "",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="flex items-center justify-center size-6 rounded-md bg-muted">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Tier Selector ─────────────────────────────────────────────────────────────

function TierSelector({
  value,
  onChange,
}: {
  value: PackageTier;
  onChange: (v: PackageTier) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["diamond", "gold", "silver"] as PackageTier[]).map((tier) => {
        const c = TIER_CONFIG[tier];
        const Icon = c.Icon;
        const selected = value === tier;
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            className={cn(
              "relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all",
              selected
                ? cn("border-current shadow-sm", c.text, c.bg)
                : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center size-8 rounded-lg",
                selected ? cn("bg-gradient-to-br text-white", c.gradient) : "bg-muted"
              )}
            >
              <Icon className="size-4" />
            </div>
            <span className="text-xs font-semibold">{c.label}</span>
            {selected && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-current opacity-80" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  slotId,
  onEdit,
  onDelete,
}: {
  item: SponsoredItem;
  slotId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 group hover:border-border/80 hover:shadow-sm transition-all">
      <div className="flex-shrink-0 relative">
        {item.cover_image_url ? (
          <img
            src={item.cover_image_url}
            alt={item.event_name}
            className="h-12 w-20 rounded-md border object-cover"
          />
        ) : (
          <div className="h-12 w-20 rounded-md border bg-muted flex items-center justify-center">
            <ImageIcon className="size-5 text-muted-foreground" />
          </div>
        )}
        {item.promo_label && (
          <span className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
            {item.promo_label}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.event_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">{item.race_slug}</span>
          {item.badge_labels?.length > 0 && (
            <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-medium">
              {item.badge_labels.length} badge
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs font-semibold text-emerald-600">{formatPrice(item.price_from)}</span>
          <span className="text-xs text-muted-foreground">
            {formatDate(item.event_date_start)}
          </span>
          {item.show_countdown && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
              <Clock className="size-3" />Countdown
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Sửa item">
          <Pencil className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Xóa item">
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
      <div className="flex-shrink-0 text-xs text-muted-foreground tabular-nums opacity-50">
        #{item.item_order}
      </div>
    </div>
  );
}

// ── Slot Card ─────────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onToggleActive,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: {
  slot: SponsoredSlot;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onAddItem: () => void;
  onEditItem: (item: SponsoredItem) => void;
  onDeleteItem: (item: SponsoredItem) => void;
}) {
  const c = TIER_CONFIG[slot.package_tier];

  return (
    <div className={cn("rounded-xl border-2 bg-card transition-all overflow-hidden", expanded ? "border-border shadow-md" : "border-border/60 hover:border-border")}>
      {/* Tier accent bar */}
      <div className={cn("h-1 bg-gradient-to-r", c.gradient)} />

      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Expand icon */}
        <div className="flex-shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </div>

        {/* Tier badge + title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TierBadge tier={slot.package_tier} />
          <span className="text-sm font-semibold text-foreground">
            Slot #{slot.display_order}
          </span>
          {slot.is_hero && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-blue-600 border-blue-200 bg-blue-50">
              Hero
            </Badge>
          )}
          <span className="text-xs text-muted-foreground hidden sm:block">
            · {slot.items.length} item{slot.items.length !== 1 ? "s" : ""}
            · xoay {slot.rotation_interval_seconds}s
          </span>
        </div>

        {/* Schedule */}
        <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <Calendar className="size-3.5" />
          {formatDate(slot.display_start_at)} → {formatDate(slot.display_end_at)}
        </div>

        {/* Status */}
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <SlotStatusDot slot={slot} />
        </div>

        {/* Active toggle */}
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Switch checked={slot.is_active} onCheckedChange={onToggleActive} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onAddItem}>
            <Plus className="size-3" />
            Item
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Diamond conflict warning */}
      {slot.diamond_conflict && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="size-3.5 flex-shrink-0" />
          Đã có Diamond slot khác đang active — mỗi lúc chỉ nên có 1 Diamond slot
        </div>
      )}

      {/* Items (expanded) */}
      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/20">
          {slot.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                <Layers className="size-5" />
              </div>
              <p className="text-sm">Slot trống. Thêm item để bắt đầu hiển thị banner.</p>
              <Button variant="outline" size="sm" onClick={onAddItem} className="mt-1">
                <Plus className="size-3.5 mr-1" />
                Thêm item đầu tiên
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-3">
              {slot.items
                .slice()
                .sort((a, b) => a.item_order - b.item_order)
                .map((item) => (
                  <ItemCard
                    key={item._id}
                    item={item}
                    slotId={slot._id}
                    onEdit={() => onEditItem(item)}
                    onDelete={() => onDeleteItem(item)}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ slots }: { slots: SponsoredSlot[] }) {
  const now = Date.now();
  const running = slots.filter(
    (s) => s.is_active && now >= new Date(s.display_start_at).getTime() && now <= new Date(s.display_end_at).getTime()
  );
  const diamond = slots.find((s) => s.package_tier === "diamond" && s.is_active);
  const totalItems = slots.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        {
          label: "Đang chạy",
          value: `${running.length}/4`,
          sub: "slot active",
          icon: Zap,
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          border: "border-emerald-100",
        },
        {
          label: "Diamond",
          value: diamond ? `${diamond.items.length} items` : "Trống",
          sub: diamond ? "đang chiếm slot hero" : "chưa có slot diamond",
          icon: Trophy,
          color: "text-violet-600",
          bg: "bg-violet-50",
          border: "border-violet-100",
        },
        {
          label: "Tổng items",
          value: String(totalItems),
          sub: `trên ${slots.length} slots`,
          icon: Layers,
          color: "text-blue-600",
          bg: "bg-blue-50",
          border: "border-blue-100",
        },
      ].map(({ label, value, sub, icon: Icon, color, bg, border }) => (
        <div key={label} className={cn("rounded-xl border p-4 flex items-start gap-3", bg, border)}>
          <div className={cn("flex items-center justify-center size-9 rounded-lg bg-white shadow-sm flex-shrink-0", color)}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={cn("text-xl font-bold leading-tight", color)}>{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SponsoredPage() {
  const { token } = useAuth();
  const [slots, setSlots] = useState<SponsoredSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SponsoredSlot | null>(null);
  const [slotForm, setSlotForm] = useState({ ...emptySlotForm });
  const [savingSlot, setSavingSlot] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemTargetSlotId, setItemTargetSlotId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<SponsoredItem | null>(null);
  const [itemForm, setItemForm] = useState({ ...emptyItemForm });
  const [savingItem, setSavingItem] = useState(false);

  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ slotId: string; item: SponsoredItem } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────

  const fetchSlots = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error(await res.text());
      const data: SponsoredSlot[] = await res.json();
      setSlots(data);
    } catch {
      toast.error("Không thể tải danh sách sponsored slots");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Slot CRUD ─────────────────────────────────────────────────────────────

  function openCreateSlot() {
    setEditingSlot(null);
    setSlotForm({ ...emptySlotForm });
    setSlotDialogOpen(true);
  }

  function openEditSlot(slot: SponsoredSlot) {
    setEditingSlot(slot);
    setSlotForm({
      package_tier: slot.package_tier,
      display_order: slot.display_order,
      is_hero: slot.is_hero,
      rotation_interval_seconds: slot.rotation_interval_seconds,
      display_start_at: slot.display_start_at.slice(0, 16),
      display_end_at: slot.display_end_at.slice(0, 16),
      is_active: slot.is_active,
    });
    setSlotDialogOpen(true);
  }

  async function handleSaveSlot() {
    if (!slotForm.display_start_at || !slotForm.display_end_at) {
      toast.error("Vui lòng chọn ngày bắt đầu và kết thúc");
      return;
    }
    setSavingSlot(true);
    try {
      const body = {
        ...slotForm,
        display_start_at: new Date(slotForm.display_start_at).toISOString(),
        display_end_at: new Date(slotForm.display_end_at).toISOString(),
      };
      const res = editingSlot
        ? await fetch(`${API_BASE}/${editingSlot._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      if (saved?.diamond_conflict) {
        toast.warning("⚠️ Đã có Diamond slot đang chạy — mỗi lúc chỉ nên có 1 Diamond slot active");
      }
      toast.success(editingSlot ? "Cập nhật slot thành công!" : "Tạo slot thành công!");
      setSlotDialogOpen(false);
      fetchSlots();
    } catch {
      toast.error("Lưu slot thất bại");
    } finally {
      setSavingSlot(false);
    }
  }

  async function handleDeleteSlot() {
    if (!deleteSlotId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/${deleteSlotId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      toast.success("Đã xóa slot!");
      setDeleteSlotId(null);
      fetchSlots();
    } catch {
      toast.error("Xóa slot thất bại");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive(slot: SponsoredSlot) {
    try {
      const res = await fetch(`${API_BASE}/${slot._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !slot.is_active }),
      });
      if (!res.ok) throw new Error(await res.text());
      fetchSlots();
    } catch {
      toast.error("Cập nhật trạng thái thất bại");
    }
  }

  // ── Item CRUD ─────────────────────────────────────────────────────────────

  function openAddItem(slotId: string) {
    setItemTargetSlotId(slotId);
    setEditingItem(null);
    setItemForm({ ...emptyItemForm });
    setItemDialogOpen(true);
  }

  function openEditItem(slotId: string, item: SponsoredItem) {
    setItemTargetSlotId(slotId);
    setEditingItem(item);
    setItemForm({
      race_slug: item.race_slug,
      event_name: item.event_name,
      event_type: item.event_type ?? "",
      event_date_start: item.event_date_start.slice(0, 10),
      event_date_end: item.event_date_end?.slice(0, 10) ?? "",
      event_location: item.event_location,
      cover_image_url: item.cover_image_url,
      price_from: item.price_from,
      cta_text: item.cta_text,
      cta_url: item.cta_url ?? "",
      promo_label: item.promo_label ?? "",
      badge_labels: item.badge_labels.join(", "),
      show_countdown: item.show_countdown,
      countdown_target_at: item.countdown_target_at?.slice(0, 16) ?? "",
    });
    setItemDialogOpen(true);
  }

  async function handleSaveItem() {
    if (!itemTargetSlotId) return;
    if (!itemForm.race_slug || !itemForm.event_name || !itemForm.cover_image_url) {
      toast.error("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }
    setSavingItem(true);
    try {
      const body = {
        race_slug: itemForm.race_slug,
        event_name: itemForm.event_name,
        event_type: itemForm.event_type || null,
        event_date_start: itemForm.event_date_start
          ? new Date(itemForm.event_date_start).toISOString()
          : undefined,
        event_date_end: itemForm.event_date_end
          ? new Date(itemForm.event_date_end).toISOString()
          : null,
        event_location: itemForm.event_location,
        cover_image_url: itemForm.cover_image_url,
        price_from: Number(itemForm.price_from),
        cta_text: itemForm.cta_text || "Đăng ký →",
        cta_url: itemForm.cta_url || null,
        promo_label: itemForm.promo_label || null,
        badge_labels: itemForm.badge_labels
          ? itemForm.badge_labels.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        show_countdown: itemForm.show_countdown,
        countdown_target_at: itemForm.countdown_target_at
          ? new Date(itemForm.countdown_target_at).toISOString()
          : null,
      };

      const url = editingItem
        ? `${API_BASE}/${itemTargetSlotId}/items/${editingItem._id}`
        : `${API_BASE}/${itemTargetSlotId}/items`;

      const res = await fetch(url, {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());

      toast.success(editingItem ? "Cập nhật item thành công!" : "Thêm item thành công!");
      setItemDialogOpen(false);
      fetchSlots();
    } catch {
      toast.error("Lưu item thất bại");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleDeleteItem() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `${API_BASE}/${deleteItem.slotId}/items/${deleteItem.item._id}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({ message: "Lỗi không xác định" }));
        throw new Error(err?.message ?? "Lỗi");
      }
      toast.success("Đã xóa item!");
      setDeleteItem(null);
      fetchSlots();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Xóa item thất bại");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Sponsored Banner Zone
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý quảng cáo hiển thị trên homepage 5bib.com
          </p>
        </div>
        <div className="flex items-center gap-2 mt-3 sm:mt-0">
          <a
            href="https://5bib.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink className="size-3.5" />
            Xem live
          </a>
          <Button onClick={openCreateSlot} className="gap-1.5">
            <Plus className="size-4" />
            Thêm Slot
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && slots.length > 0 && <StatsBar slots={slots} />}

      {/* Slot list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border overflow-hidden">
              <div className="h-1 bg-muted animate-pulse" />
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <div className="flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-9 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed py-16 text-center">
          <div className="flex items-center justify-center size-14 rounded-2xl bg-muted">
            <Layers className="size-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Chưa có sponsored slot</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tạo slot đầu tiên để bắt đầu hiển thị banner quảng cáo trên homepage.
            </p>
          </div>
          <Button onClick={openCreateSlot} className="gap-1.5">
            <Plus className="size-4" />
            Tạo Slot đầu tiên
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {slots.map((slot) => (
            <SlotCard
              key={slot._id}
              slot={slot}
              expanded={expandedIds.has(slot._id)}
              onToggle={() => toggleExpand(slot._id)}
              onEdit={() => openEditSlot(slot)}
              onDelete={() => setDeleteSlotId(slot._id)}
              onToggleActive={() => handleToggleActive(slot)}
              onAddItem={() => openAddItem(slot._id)}
              onEditItem={(item) => openEditItem(slot._id, item)}
              onDeleteItem={(item) => setDeleteItem({ slotId: slot._id, item })}
            />
          ))}
        </div>
      )}

      {/* ── Slot Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="size-5 text-muted-foreground" />
              {editingSlot ? "Chỉnh sửa Slot" : "Tạo Slot mới"}
            </DialogTitle>
            <DialogDescription>
              Cấu hình vị trí và lịch hiển thị. Thêm item sau khi tạo slot.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Package Tier */}
            <SectionLabel icon={Trophy}>Gói quảng cáo</SectionLabel>
            <TierSelector
              value={slotForm.package_tier}
              onChange={(v) => setSlotForm((p) => ({ ...p, package_tier: v }))}
            />

            {/* Position & rotation */}
            <SectionLabel icon={Layers}>Vị trí & Rotation</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Display Order" hint="1–99, nhỏ hơn = hiển thị trước">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={slotForm.display_order}
                  onChange={(e) => setSlotForm((p) => ({ ...p, display_order: Number(e.target.value) }))}
                />
              </FormField>
              <FormField label="Rotation (giây)" hint="3–30 giây mỗi lần xoay">
                <Input
                  type="number"
                  min={3}
                  max={30}
                  value={slotForm.rotation_interval_seconds}
                  onChange={(e) =>
                    setSlotForm((p) => ({ ...p, rotation_interval_seconds: Number(e.target.value) }))
                  }
                />
              </FormField>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Hero Card</p>
                <p className="text-xs text-muted-foreground">Chiếm 2/3 chiều rộng banner zone</p>
              </div>
              <Switch
                checked={slotForm.is_hero}
                onCheckedChange={(v) => setSlotForm((p) => ({ ...p, is_hero: v }))}
              />
            </div>

            {/* Schedule */}
            <SectionLabel icon={Calendar}>Lịch hiển thị</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Bắt đầu" required>
                <Input
                  type="datetime-local"
                  value={slotForm.display_start_at}
                  onChange={(e) => setSlotForm((p) => ({ ...p, display_start_at: e.target.value }))}
                />
              </FormField>
              <FormField label="Kết thúc" required>
                <Input
                  type="datetime-local"
                  value={slotForm.display_end_at}
                  onChange={(e) => setSlotForm((p) => ({ ...p, display_end_at: e.target.value }))}
                />
              </FormField>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Kích hoạt ngay</p>
                <p className="text-xs text-muted-foreground">Slot sẽ hiển thị khi đến lịch</p>
              </div>
              <Switch
                checked={slotForm.is_active}
                onCheckedChange={(v) => setSlotForm((p) => ({ ...p, is_active: v }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveSlot} disabled={savingSlot}>
              {savingSlot ? "Đang lưu..." : editingSlot ? "Cập nhật Slot" : "Tạo Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Item Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="size-5 text-muted-foreground" />
              {editingItem ? "Chỉnh sửa Item" : "Thêm Item vào Slot"}
            </DialogTitle>
            <DialogDescription>Thông tin event hiển thị trong carousel banner</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Basic info */}
            <SectionLabel icon={Tag}>Thông tin cơ bản</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Race Slug" required>
                <Input
                  value={itemForm.race_slug}
                  onChange={(e) => setItemForm((p) => ({ ...p, race_slug: e.target.value }))}
                  placeholder="vietnam-mountain-marathon-2026"
                />
              </FormField>
              <FormField label="Tên giải" required>
                <Input
                  value={itemForm.event_name}
                  onChange={(e) => setItemForm((p) => ({ ...p, event_name: e.target.value }))}
                  placeholder="Vietnam Mountain Marathon 2026"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Loại giải" hint="Ví dụ: ULTRA TRAIL · UTMB 4★">
                <Input
                  value={itemForm.event_type}
                  onChange={(e) => setItemForm((p) => ({ ...p, event_type: e.target.value }))}
                  placeholder="ULTRA TRAIL · UTMB 4★"
                />
              </FormField>
              <FormField label="Địa điểm" required>
                <Input
                  value={itemForm.event_location}
                  onChange={(e) => setItemForm((p) => ({ ...p, event_location: e.target.value }))}
                  placeholder="Mù Cang Chải, Yên Bái"
                />
              </FormField>
            </div>

            {/* Dates */}
            <SectionLabel icon={Calendar}>Thời gian sự kiện</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ngày bắt đầu" required>
                <Input
                  type="date"
                  value={itemForm.event_date_start}
                  onChange={(e) => setItemForm((p) => ({ ...p, event_date_start: e.target.value }))}
                />
              </FormField>
              <FormField label="Ngày kết thúc" hint="Để trống nếu chỉ 1 ngày">
                <Input
                  type="date"
                  value={itemForm.event_date_end}
                  onChange={(e) => setItemForm((p) => ({ ...p, event_date_end: e.target.value }))}
                />
              </FormField>
            </div>

            {/* Cover image */}
            <SectionLabel icon={ImageIcon}>Ảnh bìa</SectionLabel>
            <FormField label="Cover Image URL" required>
              <Input
                value={itemForm.cover_image_url}
                onChange={(e) => setItemForm((p) => ({ ...p, cover_image_url: e.target.value }))}
                placeholder="https://s3.amazonaws.com/..."
              />
            </FormField>
            {itemForm.cover_image_url && (
              <div className="relative rounded-xl overflow-hidden border bg-muted h-36">
                <img
                  src={itemForm.cover_image_url}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <span className="absolute bottom-2 left-3 text-white text-xs font-medium">Preview</span>
              </div>
            )}

            {/* Pricing & CTA */}
            <SectionLabel icon={Link2}>Giá & CTA</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Giá từ (VNĐ)" required>
                <Input
                  type="number"
                  min={0}
                  value={itemForm.price_from}
                  onChange={(e) => setItemForm((p) => ({ ...p, price_from: Number(e.target.value) }))}
                  placeholder="550000"
                />
              </FormField>
              <FormField label="CTA Text">
                <Input
                  value={itemForm.cta_text}
                  onChange={(e) => setItemForm((p) => ({ ...p, cta_text: e.target.value }))}
                  placeholder="Đăng ký →"
                />
              </FormField>
            </div>
            <FormField label="CTA URL" hint="Để trống → tự dùng /races/{race_slug}">
              <Input
                value={itemForm.cta_url}
                onChange={(e) => setItemForm((p) => ({ ...p, cta_url: e.target.value }))}
                placeholder="https://5bib.com/races/..."
              />
            </FormField>

            {/* Promo & badges */}
            <SectionLabel icon={Tag}>Nhãn & Badge</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Promo Label" hint="Ví dụ: GIẢM 15%">
                <Input
                  value={itemForm.promo_label}
                  onChange={(e) => setItemForm((p) => ({ ...p, promo_label: e.target.value }))}
                  placeholder="GIẢM 15%"
                />
              </FormField>
              <FormField label="Badge Labels" hint="Cách nhau bởi dấu phẩy">
                <Input
                  value={itemForm.badge_labels}
                  onChange={(e) => setItemForm((p) => ({ ...p, badge_labels: e.target.value }))}
                  placeholder="UTMB, Trail, VN Exclusive"
                />
              </FormField>
            </div>

            {/* Countdown */}
            <SectionLabel icon={Clock}>Đếm ngược</SectionLabel>
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Hiển thị đếm ngược</p>
                <p className="text-xs text-muted-foreground">Đồng hồ đếm ngược tới ngày đua</p>
              </div>
              <Switch
                checked={itemForm.show_countdown}
                onCheckedChange={(v) => setItemForm((p) => ({ ...p, show_countdown: v }))}
              />
            </div>
            {itemForm.show_countdown && (
              <FormField label="Race Day (countdown target)" required>
                <Input
                  type="datetime-local"
                  value={itemForm.countdown_target_at}
                  onChange={(e) => setItemForm((p) => ({ ...p, countdown_target_at: e.target.value }))}
                />
              </FormField>
            )}
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={
                savingItem ||
                !itemForm.race_slug ||
                !itemForm.event_name ||
                !itemForm.cover_image_url ||
                !itemForm.event_date_start ||
                !itemForm.event_location
              }
            >
              {savingItem ? "Đang lưu..." : editingItem ? "Cập nhật Item" : "Thêm Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Slot ────────────────────────────────────────────────────── */}
      <Dialog open={deleteSlotId !== null} onOpenChange={(o) => !o && setDeleteSlotId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10 mx-auto mb-2">
              <Trash2 className="size-5 text-destructive" />
            </div>
            <DialogTitle className="text-center">Xóa Slot?</DialogTitle>
            <DialogDescription className="text-center">
              Slot và toàn bộ items bên trong sẽ bị xóa vĩnh viễn. Không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setDeleteSlotId(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteSlot} disabled={deleting}>
              {deleting ? "Đang xóa..." : "Xóa Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Item ────────────────────────────────────────────────────── */}
      <Dialog open={deleteItem !== null} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10 mx-auto mb-2">
              <Trash2 className="size-5 text-destructive" />
            </div>
            <DialogTitle className="text-center">Xóa Item?</DialogTitle>
            <DialogDescription className="text-center">
              {deleteItem && (
                <>
                  Xóa <span className="font-medium text-foreground">&quot;{deleteItem.item.event_name}&quot;</span> khỏi slot?
                  {" "}Nếu đây là item cuối, hãy xóa cả slot thay vì xóa item.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteItem} disabled={deleting}>
              {deleting ? "Đang xóa..." : "Xóa Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
