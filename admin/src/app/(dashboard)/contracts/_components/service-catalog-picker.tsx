"use client";

/**
 * F-024 Service Catalog Picker — modal pick item vào line item.
 *
 * BR-CM-16 (b)+(c): admin có 2 cách thêm line item:
 *   (a) Pick từ catalog → auto-fill description + unit + referencePrice
 *   (b) Gõ tay tự do (LineItemsEditor "Thêm dòng" button)
 *
 * Catalog items lọc theo category — wizard pass contract type → mapping
 * TICKET_SALES→GENERAL, TIMING→TIMING, RACEKIT→RACEKIT, OPERATIONS→OPERATIONS.
 * Admin có thể switch sang "Tất cả nhóm" trong modal.
 *
 * F-024 UI consistency fix (2026-05-12): align picker với Service Catalog
 * table style — VN labels (Display Convention từ f18da46) + table-like
 * columns (Tên | Nhóm badge VN | ĐVT | Giá bán | Giá vốn | Lãi gộp badge).
 */
import { useEffect, useState } from "react";
import {
  listServiceCatalog,
  type ContractType,
  type ServiceCatalogItem,
  type ServiceCategory,
  type LineItemInput,
  formatVND,
} from "@/lib/contracts-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Package } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "./empty-state";

const TYPE_TO_CATEGORY: Record<ContractType, ServiceCategory> = {
  TIMING: "TIMING",
  RACEKIT: "RACEKIT",
  OPERATIONS: "OPERATIONS",
  TICKET_SALES: "GENERAL",
};

// Đồng bộ với ServiceCatalogTable CATEGORY_LABEL (Display Convention f18da46).
const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  TIMING: "Tính giờ",
  RACEKIT: "Racekit",
  OPERATIONS: "Vận hành",
  GENERAL: "Chung",
};

/**
 * F-028 Phase 3 — compute lãi gộp % từ giá bán × giá vốn (port từ
 * ServiceCatalogTable để picker hiển thị KPI giống y catalog page).
 */
type MarginTier = "high" | "mid" | "low" | "unknown";
type MarginResult = { value: number; tier: MarginTier };

function computeMargin(price: number, cost: number): MarginResult {
  if (!price || price <= 0 || !cost || cost <= 0) {
    return { value: 0, tier: "unknown" };
  }
  const margin = ((price - cost) / price) * 100;
  let tier: MarginTier = "low";
  if (margin > 40) tier = "high";
  else if (margin >= 20) tier = "mid";
  return { value: Math.round(margin), tier };
}

const MARGIN_TIER_CLASS: Record<Exclude<MarginTier, "unknown">, string> = {
  high: "border-emerald-300 bg-emerald-50 text-emerald-800",
  mid: "border-amber-300 bg-amber-50 text-amber-800",
  low: "border-rose-300 bg-rose-50 text-rose-800",
};

const MARGIN_TIER_DOT: Record<Exclude<MarginTier, "unknown">, string> = {
  high: "🟢",
  mid: "🟡",
  low: "🔴",
};

type Props = {
  open: boolean;
  onClose: () => void;
  contractType?: ContractType;
  /** Called with the line item to insert. Caller appends to its items state. */
  onPick: (item: LineItemInput) => void;
};

export function ServiceCatalogPicker({
  open,
  onClose,
  contractType,
  onPick,
}: Props) {
  const initial = contractType ? TYPE_TO_CATEGORY[contractType] : undefined;
  const [category, setCategory] = useState<ServiceCategory | "ALL">(
    initial ?? "ALL",
  );
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listServiceCatalog({
      category: category === "ALL" ? undefined : category,
      q: q.trim() || undefined,
    })
      .then(setItems)
      .catch((err) => toast.error(`Không tải được danh mục: ${err.message}`))
      .finally(() => setLoading(false));
  }, [open, category, q]);

  function pick(it: ServiceCatalogItem) {
    onPick({
      stt: 0, // caller renumbers
      description: it.name,
      unit: it.unit ?? "",
      quantity: 1,
      unitPrice: it.referencePrice ?? 0,
      discount: 0,
      selected: true,
      note: it.description,
      // F-028 Phase 3 — snapshot catalog._id để cost-suggestions endpoint
      // lookup ServiceCatalog.referenceCost × quantity → gợi ý chi phí P&L.
      catalogItemId: it._id,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Chọn dịch vụ từ danh mục</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ServiceCategory | "ALL")}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả nhóm</SelectItem>
                <SelectItem value="TIMING">Tính giờ</SelectItem>
                <SelectItem value="RACEKIT">Racekit</SelectItem>
                <SelectItem value="OPERATIONS">Vận hành</SelectItem>
                <SelectItem value="GENERAL">Chung</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên dịch vụ"
            />
          </div>
          <div className="max-h-[28rem] overflow-y-auto rounded-md border border-[var(--border,#E7E2D9)] bg-white">
            {loading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Chưa có dịch vụ trong danh mục"
                description={
                  q || category !== "ALL"
                    ? "Không khớp filter — thử bỏ filter hoặc đổi từ khoá."
                    : "Thêm dịch vụ vào catalog để pick reference từ wizard."
                }
                cta={
                  // UX-21: Link + button styling — mở tab mới giữ wizard state.
                  <Link
                    href="/contracts/services"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-[var(--border,#E7E2D9)] bg-white px-3 py-1.5 text-sm font-medium hover:bg-[#F3F0EB]"
                  >
                    <ExternalLink className="size-4" /> Mở Danh mục dịch vụ
                  </Link>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên dịch vụ</TableHead>
                    <TableHead>Nhóm</TableHead>
                    <TableHead>ĐVT</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead className="text-right">Giá vốn</TableHead>
                    <TableHead
                      className="text-right"
                      title="Lãi gộp ước tính = (giá bán - giá vốn) / giá bán × 100%"
                    >
                      Lãi gộp
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const m = computeMargin(
                      it.referencePrice ?? 0,
                      it.referenceCost ?? 0,
                    );
                    return (
                      <TableRow
                        key={it._id}
                        onClick={() => pick(it)}
                        className="cursor-pointer hover:bg-[#F3F0EB]"
                        tabIndex={0}
                        role="button"
                        aria-label={`Chọn ${it.name}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            pick(it);
                          }
                        }}
                      >
                        <TableCell className="font-medium">
                          <div className="truncate">{it.name}</div>
                          {it.description ? (
                            <div className="truncate text-xs text-[var(--text-muted,#78716C)]">
                              {it.description}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {CATEGORY_LABEL[it.category]}
                          </Badge>
                        </TableCell>
                        <TableCell>{it.unit || "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatVND(it.referencePrice ?? 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {it.referenceCost == null
                            ? "—"
                            : formatVND(it.referenceCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.tier === "unknown" ? (
                            <span
                              className="text-muted-foreground"
                              title="Cần nhập cả Giá bán và Giá vốn để tính"
                            >
                              —
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs font-semibold ${MARGIN_TIER_CLASS[m.tier]}`}
                              title="Lãi gộp ước tính"
                            >
                              <span aria-hidden>{MARGIN_TIER_DOT[m.tier]}</span>
                              {m.value}%
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
