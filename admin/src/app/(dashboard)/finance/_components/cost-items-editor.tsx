"use client";

/**
 * F-028 Screen 3 — Cost Items Editor table.
 *
 * Pattern clone `contracts/_components/line-items-editor.tsx`. Differences:
 *   - Server-side persistence (KHÔNG inline edit) — open dialog cho add/edit
 *   - Soft delete (BR-PNL-10) qua AlertDialog confirm
 *   - Pagination 20/page (KHÔNG dùng MVP — list all qua page=1, limit=200)
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COST_CATEGORY_COLORS,
  COST_CATEGORY_LABELS,
  formatVnd,
  listCostItems,
  type CostItemView,
} from "@/lib/finance-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CostItemDialog } from "./cost-item-dialog";
import { CostItemDeleteConfirm } from "./cost-item-delete-confirm";

interface Props {
  contractId: string;
}

export function CostItemsEditor({ contractId }: Props) {
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["finance", "cost-items", contractId],
    queryFn: () => listCostItems(contractId, { page: 1, limit: 200 }),
    staleTime: 15_000,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editTarget, setEditTarget] = useState<CostItemView | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CostItemView | null>(null);

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ["finance", "cost-items", contractId] });
    qc.invalidateQueries({ queryKey: ["finance", "pnl", contractId] });
    refetch();
  }

  function openCreate() {
    setEditTarget(undefined);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function openEdit(item: CostItemView) {
    setEditTarget(item);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  function openDelete(item: CostItemView) {
    setDeleteTarget(item);
    setDeleteOpen(true);
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-stone-900">
          Chi phí phát sinh
          {data && (
            <span className="ml-2 text-sm font-normal text-stone-500">
              ({data.total} mục)
            </span>
          )}
        </h2>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 size-4" aria-hidden />
          Thêm chi phí
        </Button>
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Lỗi tải danh sách: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
          <p className="text-sm text-stone-600">
            Chưa có chi phí phát sinh. Click <strong>Thêm chi phí</strong> để
            bắt đầu.
          </p>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-600">
              <tr>
                <th className="w-12 px-3 py-2 text-left">STT</th>
                <th className="px-3 py-2 text-left">Mô tả</th>
                <th className="w-32 px-3 py-2 text-left">Nhóm</th>
                <th className="w-32 px-3 py-2 text-left">Ngày phát sinh</th>
                <th className="w-32 px-3 py-2 text-right">Số tiền</th>
                <th className="w-48 px-3 py-2 text-left">Ghi chú</th>
                <th className="w-24 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((it, idx) => (
                <tr key={it.id} className="hover:bg-stone-50">
                  <td className="px-3 py-2 text-stone-500">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-stone-900">
                    {it.description}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${COST_CATEGORY_COLORS[it.category]}`}
                    >
                      {COST_CATEGORY_LABELS[it.category]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    {it.incurredDate ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatVnd(it.amount)}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{it.note ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label="Sửa"
                        onClick={() => openEdit(it)}
                        className="rounded p-1 text-stone-500 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Xóa"
                        onClick={() => openDelete(it)}
                        className="rounded p-1 text-stone-500 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CostItemDialog
        contractId={contractId}
        open={dialogOpen}
        mode={dialogMode}
        initial={editTarget}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
      <CostItemDeleteConfirm
        contractId={contractId}
        open={deleteOpen}
        item={deleteTarget}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onDeleted={handleSaved}
      />
    </div>
  );
}
