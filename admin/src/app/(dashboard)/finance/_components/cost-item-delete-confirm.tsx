"use client";

/**
 * F-028 Screen 6 — soft-delete confirm dialog (UX-09 F-024 pattern).
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  COST_CATEGORY_LABELS,
  deleteCostItem,
  formatVnd,
  type CostItemView,
} from "@/lib/finance-api";

interface Props {
  contractId: string;
  open: boolean;
  item: CostItemView | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function CostItemDeleteConfirm({
  contractId,
  open,
  item,
  onClose,
  onDeleted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  async function confirmDelete() {
    if (!item) return;
    setSubmitting(true);
    try {
      await deleteCostItem(contractId, item.id);
      toast.success("Đã xóa chi phí");
      onDeleted();
      onClose();
    } catch (e) {
      toast.error(`Lỗi xóa: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => !o && !submitting && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa chi phí?</AlertDialogTitle>
          <AlertDialogDescription>
            {item ? (
              <>
                Bạn sắp xóa chi phí: <strong>{item.description}</strong> (Nhóm:{" "}
                {COST_CATEGORY_LABELS[item.category]}, Số tiền:{" "}
                {formatVnd(item.amount)}
                {item.incurredDate ? `, Phát sinh: ${item.incurredDate}` : ""}).
                Thao tác này có thể khôi phục bởi admin từ database.
                <br />
                <span className="text-xs italic text-stone-600">
                  Chi phí xóa sẽ KHÔNG tính vào tổng P&amp;L của HĐ.
                </span>
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting} onClick={onClose}>
            Huỷ
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            onClick={confirmDelete}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {submitting ? "Đang xóa..." : "Xác nhận xóa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
