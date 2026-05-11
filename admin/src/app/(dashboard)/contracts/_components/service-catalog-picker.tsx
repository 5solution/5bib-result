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
 * Admin có thể switch sang "Tất cả" trong modal.
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
import { toast } from "sonner";

const TYPE_TO_CATEGORY: Record<ContractType, ServiceCategory> = {
  TIMING: "TIMING",
  RACEKIT: "RACEKIT",
  OPERATIONS: "OPERATIONS",
  TICKET_SALES: "GENERAL",
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
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
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
                <SelectItem value="ALL">Tất cả</SelectItem>
                <SelectItem value="TIMING">Timing</SelectItem>
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
          <div className="max-h-96 overflow-y-auto rounded-md border border-[var(--border,#E7E2D9)] bg-white">
            {loading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-muted,#78716C)]">
                Chưa có dịch vụ trong danh mục — vào "Danh mục dịch vụ" để thêm
              </div>
            ) : (
              <ul>
                {items.map((it) => (
                  <li key={it._id}>
                    <button
                      type="button"
                      onClick={() => pick(it)}
                      className="flex w-full items-center justify-between gap-3 border-b border-[var(--border,#E7E2D9)] px-3 py-2 text-left last:border-b-0 hover:bg-[#F3F0EB]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {it.name}
                        </div>
                        <div className="truncate text-xs text-[var(--text-muted,#78716C)]">
                          {it.category} · {it.unit || "—"}
                        </div>
                      </div>
                      <div className="font-mono text-sm">
                        {formatVND(it.referencePrice ?? 0)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
